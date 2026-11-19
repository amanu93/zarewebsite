-- ============================================================================
-- Zare Bench — 0005 calculated overall score with a bounded override
--
-- Overall used to be typed in by hand, independent of the sub-scores, so a
-- 3.0 communicator could be recorded as 4.6 overall and nothing would object.
-- Now the database calculates a default and the assessor may move it, but
-- only a little and only with a reason:
--
--   overall_score_calculated  weighted mean of the sub-scores, per archetype.
--                             Set by trigger; a client cannot write it.
--   overall_score             defaults to the calculated value. May differ by
--                             at most 0.5, and any difference needs a reason.
--   overall_override_reason   why the assessor moved it. Internal only; never
--                             exported.
--
-- The calculated value is a SNAPSHOT taken when the scores are written. Re-
-- weighting an archetype later does not silently rescore people assessed
-- under the old weights; re-scoring them does.
-- ============================================================================

-- --------------------------------------------------------- 1. weights -----
alter table public.archetypes
  add column communication_weight numeric(3,2) not null default 0.50
    check (communication_weight between 0 and 1),
  add column technical_weight     numeric(3,2) not null default 0.50
    check (technical_weight between 0 and 1),
  add constraint weights_sum_to_one
    check (communication_weight + technical_weight = 1.00);

-- Support roles are judged mostly on communication, engineers mostly on
-- technical ability. Seed.sql sets the same values for fresh environments.
update public.archetypes set communication_weight = 0.70, technical_weight = 0.30 where code = 'CSR';
update public.archetypes set communication_weight = 0.40, technical_weight = 0.60 where code = 'SWE';

-- ------------------------------------------------------ 2. calculation -----
-- Weighted mean over the sub-scores that exist. A missing sub-score drops out
-- and the remaining weights are renormalised, so a CSR assessed on
-- communication alone gets their communication score, not 70% of it.
create or replace function public.calculate_overall_score(
  p_archetype_id  uuid,
  p_communication numeric,
  p_technical     numeric
)
returns numeric(2,1)
language sql
stable
as $$
  select case when w.total = 0 then null else round(w.weighted / w.total, 1) end
  from (
    select
      coalesce(a.communication_weight * p_communication, 0)
        + coalesce(a.technical_weight * p_technical, 0)                       as weighted,
      (case when p_communication is not null then a.communication_weight else 0 end)
        + (case when p_technical is not null then a.technical_weight else 0 end) as total
    from public.archetypes a
    where a.id = p_archetype_id
  ) w;
$$;

-- ------------------------------------------------------------ 3. columns -----
alter table public.candidates
  add column overall_score_calculated numeric(2,1)
    check (overall_score_calculated between 1.0 and 5.0),
  add column overall_override_reason  text;

create or replace function public.set_overall_score()
returns trigger
language plpgsql
as $$
begin
  new.overall_score_calculated :=
    public.calculate_overall_score(new.archetype_id, new.communication_score, new.technical_score);

  -- No overall supplied: take the calculated one.
  if new.overall_score is null then
    new.overall_score := new.overall_score_calculated;
  end if;

  -- Not overridden: a stale reason would explain a change that no longer
  -- exists, so it goes.
  if new.overall_score is not distinct from new.overall_score_calculated then
    new.overall_override_reason := null;
  end if;

  return new;
end;
$$;

-- Fires only when scores are (re)written, so an availability update never
-- rescores anyone against today's weights.
create trigger candidates_set_overall_score
  before insert or update of communication_score, technical_score, overall_score, archetype_id
  on public.candidates
  for each row execute function public.set_overall_score();

-- Backfill. Rows scored before this migration keep their overall; where it
-- disagrees with the calculation the difference is recorded as historical.
update public.candidates c
   set overall_score_calculated =
         public.calculate_overall_score(c.archetype_id, c.communication_score, c.technical_score)
 where c.communication_score is not null or c.technical_score is not null;

update public.candidates
   set overall_override_reason = 'Recorded before overall scores were calculated.'
 where overall_score_calculated is not null
   and overall_score is distinct from overall_score_calculated
   and overall_override_reason is null;

-- NOT VALID: enforced for every new write, without failing on historical
-- rows that may sit further than 0.5 from the calculation. Review those, then
--   alter table public.candidates validate constraint overall_within_override_band;
alter table public.candidates
  add constraint overall_within_override_band check (
    overall_score is null
    or overall_score_calculated is null
    or abs(overall_score - overall_score_calculated) <= 0.5
  ) not valid,
  add constraint override_needs_reason check (
    overall_score is null
    or overall_score_calculated is null
    or overall_score = overall_score_calculated
    or length(trim(coalesce(overall_override_reason, ''))) >= 10
  );

grant execute on function public.calculate_overall_score(uuid, numeric, numeric) to authenticated;

-- --------------------------------------------------- 4. rebuild views -----
-- Same reason as 0004: `c.*` in candidates_view expands at creation time, so
-- the new columns only appear if the view is rebuilt, and they land mid-list
-- so it cannot be replaced in place. Definitions below are unchanged from
-- 0004.
drop view if exists public.call_queue;
drop view if exists public.bench_health;
drop view if exists public.candidates_view;

create view public.candidates_view with (security_invoker = true) as
select
  c.*,
  a.code  as archetype_code,
  a.name  as archetype_name,
  a.color as archetype_color,
  a.freshness_days,
  (c.last_verified_at + make_interval(days => a.freshness_days)) as expires_at,
  case
    when c.last_verified_at is null then null
    else floor(extract(epoch from
      (c.last_verified_at + make_interval(days => a.freshness_days)) - now()) / 86400)::int
  end as days_until_expiry,
  case
    when c.archived_reason is not null then 'archived'
    when c.assessed_at is null         then 'raw'
    when c.availability_status = 'available'
     and c.last_verified_at is not null
     and c.last_verified_at > now() - make_interval(days => a.freshness_days)
                                       then 'ready'
    else 'known'
  end as layer
from public.candidates c
join public.archetypes a on a.id = c.archetype_id
where c.deleted_at is null;

comment on view public.candidates_view is
  'Candidates with derived layer. Anonymised (do_not_contact) rows are excluded here so no screen can surface them. Use candidate_refs for shortlist history.';

create view public.bench_health with (security_invoker = true) as
select
  a.id            as archetype_id,
  a.code,
  a.name,
  a.color,
  a.target_ready,
  a.freshness_days,
  count(*) filter (where v.layer = 'ready')    as ready_count,
  count(*) filter (where v.layer = 'known')    as known_count,
  count(*) filter (where v.layer = 'raw')      as raw_count,
  count(*) filter (where v.layer = 'archived') as archived_count,
  count(*) filter (where v.layer = 'known')    as one_call_away,
  count(*) filter (where v.layer = 'ready' and v.days_until_expiry between 0 and 7)
                                               as expiring_this_week,
  round(
    (count(*) filter (where v.layer = 'ready'))::numeric / a.target_ready, 2
  ) as coverage,
  case
    when (count(*) filter (where v.layer = 'ready'))::numeric / a.target_ready >= 1.0 then 'green'
    when (count(*) filter (where v.layer = 'ready'))::numeric / a.target_ready >= 0.6 then 'amber'
    else 'red'
  end as status
from public.archetypes a
left join public.candidates_view v on v.archetype_id = a.id
group by a.id, a.code, a.name, a.color, a.target_ready, a.freshness_days;

create view public.call_queue with (security_invoker = true) as
select * from (
  select
    v.id,
    v.ref_code,
    v.full_name,
    v.phone,
    v.owner_id,
    v.archetype_id,
    v.archetype_code,
    v.archetype_name,
    v.archetype_color,
    v.layer,
    v.availability_status,
    v.last_verified_at,
    v.expires_at,
    v.days_until_expiry,
    v.recall_at,
    lc.outcome   as last_outcome,
    lc.called_at as last_called_at,
    case
      when v.layer = 'archived'                            then 4
      when v.layer = 'ready'  and lc.outcome = 'no_answer'  then 3
      when v.layer = 'ready'                                then 2
      else 1
    end as priority,
    case
      when v.layer = 'archived'                             then 'recall_due'
      when v.layer = 'ready' and lc.outcome = 'no_answer'   then 'no_answer_retry'
      when v.layer = 'ready'                                then 'expiring_soon'
      when v.last_verified_at is null                       then 'never_verified'
      else 'expired'
    end as reason,
    coalesce(v.expires_at, 'epoch'::timestamptz) as sort_key
  from public.candidates_view v
  left join lateral (
    select outcome, called_at
    from public.call_logs
    where candidate_id = v.id
    order by called_at desc
    limit 1
  ) lc on true
  where
    not (lc.outcome = 'no_answer' and lc.called_at > now() - interval '48 hours')
    and (
      (v.layer = 'known' and (v.last_verified_at is null or v.expires_at <= now()))
      or (v.layer = 'ready' and v.days_until_expiry <= 7)
      or (v.layer = 'ready' and lc.outcome = 'no_answer')
      or (v.layer = 'archived' and v.recall_at is not null and v.recall_at <= current_date)
    )
) q
order by q.priority, q.sort_key;

comment on view public.call_queue is
  'Prioritised verification work list. A 48h cooldown applies after any unanswered call.';
