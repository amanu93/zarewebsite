-- ============================================================================
-- Zare Bench — 0002 derived state and the availability write path
--
-- Everything the product judges itself by is computed here, on read, from
-- last_verified_at against the archetype's freshness window. Nothing about a
-- candidate's layer is ever stored, because it is only true for a while.
--
-- All views are security_invoker so the caller's RLS applies. Without this a
-- view would run as its owner and quietly become a way around 0003.
-- ============================================================================

-- ------------------------------------------------- the freshness guard -----
-- last_verified_at is the one field the whole system trusts. If any screen
-- could set it, "verified" would come to mean "someone edited a form", and
-- the bench would look healthy while being stale. So: it moves only inside
-- log_call(), which sets a session flag first.
create or replace function public.guard_last_verified_at()
returns trigger language plpgsql as $$
begin
  if new.last_verified_at is distinct from old.last_verified_at
     and coalesce(current_setting('zare.logging_call', true), 'off') <> 'on' then
    raise exception
      'last_verified_at is set only by logging a call. Use log_call().'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger candidates_guard_last_verified_at
  before update on public.candidates
  for each row execute function public.guard_last_verified_at();

-- ---------------------------------------------------- candidates_view -----
-- The canonical read model. Application code should select from this, never
-- from candidates directly, so layer can never be computed two ways.
create view public.candidates_view with (security_invoker = true) as
select
  c.*,
  a.code           as archetype_code,
  a.name           as archetype_name,
  a.color          as archetype_color,
  a.freshness_days,

  -- When this candidate's availability claim runs out. Null if never verified.
  (c.last_verified_at + make_interval(days => a.freshness_days)) as expires_at,

  -- Negative once expired. Null if never verified.
  case
    when c.last_verified_at is null then null
    else floor(extract(epoch from
      (c.last_verified_at + make_interval(days => a.freshness_days)) - now()) / 86400)::int
  end as days_until_expiry,

  -- Order matters. Archived wins over everything: an archived candidate is
  -- out of the bench regardless of how good or how fresh they are.
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
join public.archetypes a on a.id = c.archetype_id;

comment on view public.candidates_view is
  'Candidates with their derived layer. Computed on read; layer is never stored.';

-- -------------------------------------------------------- bench_health -----
-- one_call_away is the number that makes a scarcity alert actionable: people
-- already assessed who would be Ready if a call went well. It is exactly the
-- Known layer — assessed, not archived, but failing availability or freshness.
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

-- ----------------------------------------------------------- call_queue ----
-- The work list. One prioritised queue, four reasons to be on it.
--
--   1 expired / never verified   assessed, not archived, past the window
--   2 expiring_soon              Ready, but out within 7 days
--   3 no_answer_retry            unreached, 48h+ since the attempt
--   4 recall_due                 archived, recall_at has come round
--
-- Two judgement calls worth knowing about, both flagged for review:
--
--   * A 48-hour cooldown applies to EVERY bucket, not just bucket 3. Someone
--     who did not pick up an hour ago should not reappear at the top of the
--     queue just because they are also expired. The spec's "retry in 48
--     hours" is read as a property of the candidate, not of one bucket.
--   * Assessed candidates who have never been verified have no bucket in the
--     spec. They are put in bucket 1 with reason 'never_verified' and sorted
--     ahead of the merely expired, since nothing is known about them at all.
--
-- Raw candidates are excluded: they need assessing, not phoning.
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
      when v.layer = 'archived'                                   then 4
      when v.layer = 'ready'  and lc.outcome = 'no_answer'         then 3
      when v.layer = 'ready'                                       then 2
      else 1
    end as priority,

    case
      when v.layer = 'archived'                                    then 'recall_due'
      when v.layer = 'ready' and lc.outcome = 'no_answer'          then 'no_answer_retry'
      when v.layer = 'ready'                                       then 'expiring_soon'
      when v.last_verified_at is null                              then 'never_verified'
      else 'expired'
    end as reason,

    -- Within a bucket: longest waiting first. Never-verified sorts ahead of
    -- everything by virtue of a null expires_at.
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
    -- 48h cooldown after an unanswered call, whatever else is true.
    not (lc.outcome = 'no_answer' and lc.called_at > now() - interval '48 hours')
    and (
      -- 1: assessed, live, and out of date (or never dated)
      (v.layer = 'known' and (v.last_verified_at is null or v.expires_at <= now()))
      -- 2 and 3: Ready but within 7 days of dropping out, or unreached
      or (v.layer = 'ready' and v.days_until_expiry <= 7)
      or (v.layer = 'ready' and lc.outcome = 'no_answer')
      -- 4: archived and due back
      or (v.layer = 'archived' and v.recall_at is not null and v.recall_at <= current_date)
    )
) q
order by q.priority, q.sort_key;

comment on view public.call_queue is
  'Prioritised verification work list. A 48h cooldown applies after any unanswered call.';

-- ------------------------------------------------------------- log_call ----
-- The ONLY way availability changes. Writes the audit row and the candidate
-- in one transaction, so a logged call and a fresh timestamp cannot diverge.
--
--   available      -> status available, last_verified_at = now()
--   not_available  -> status not_available, last_verified_at = now()
--                     (a confirmed "no" is still a verification; it stops the
--                      candidate being called again until the window lapses)
--   no_answer      -> nothing verified, nothing touched but the log
--   archived       -> use archive_candidate() instead
create or replace function public.log_call(
  p_candidate_id uuid,
  p_outcome      text,
  p_note         text default null
)
returns public.call_logs
language plpgsql
security invoker
as $$
declare
  v_log public.call_logs;
begin
  if p_outcome not in ('available', 'not_available', 'no_answer') then
    raise exception 'log_call handles available, not_available and no_answer. Use archive_candidate() to archive.';
  end if;

  insert into public.call_logs (candidate_id, called_by, outcome, note)
  values (p_candidate_id, auth.uid(), p_outcome, p_note)
  returning * into v_log;

  if p_outcome in ('available', 'not_available') then
    perform set_config('zare.logging_call', 'on', true);  -- transaction-local
    update public.candidates
       set availability_status = p_outcome,
           last_verified_at    = v_log.called_at
     where id = p_candidate_id;
    perform set_config('zare.logging_call', 'off', true);
  end if;

  return v_log;
end;
$$;

-- ---------------------------------------------------- archive_candidate ----
-- Archiving is a call outcome, so it logs one. The reason sets the recall
-- date, and do_not_contact is the single delete path in the entire system.
create or replace function public.archive_candidate(
  p_candidate_id uuid,
  p_reason       text,
  p_note         text default null
)
returns void
language plpgsql
security invoker
as $$
begin
  if p_reason not in ('took_other_job', 'not_interested', 'left_country', 'do_not_contact') then
    raise exception 'Unknown archive reason: %', p_reason;
  end if;

  insert into public.call_logs (candidate_id, called_by, outcome, note)
  values (p_candidate_id, auth.uid(), 'archived', coalesce(p_note, p_reason));

  if p_reason = 'do_not_contact' then
    -- Hard delete, call logs and shortlist rows with it (on delete cascade).
    -- The ref code is burned: the sequence never reissues it.
    delete from public.candidates where id = p_candidate_id;
    return;
  end if;

  update public.candidates
     set archived_reason = p_reason,
         recall_at = case p_reason
                       when 'took_other_job'  then (current_date + interval '6 months')::date
                       when 'not_interested'  then (current_date + interval '12 months')::date
                       else null
                     end
   where id = p_candidate_id;
end;
$$;

-- ------------------------------------------------------ activity + stats ----
create view public.activity_feed with (security_invoker = true) as
select
  cl.id,
  cl.called_at as at,
  'call'       as kind,
  cl.outcome,
  cl.note,
  c.id         as candidate_id,
  c.ref_code,
  c.full_name,
  u.full_name  as actor_name
from public.call_logs cl
join public.candidates c on c.id = cl.candidate_id
left join public.users u on u.id = cl.called_by
order by cl.called_at desc;

-- Header stat on the call queue: calls logged today, and the streak of
-- consecutive days with at least one call. Freshness is the behaviour worth
-- reinforcing, so this counts calls — never pool size.
create or replace function public.call_stats(p_user uuid default auth.uid())
returns table (calls_today int, streak_days int)
language sql
stable
as $$
  with days as (
    select distinct (called_at at time zone 'Africa/Addis_Ababa')::date as d
    from public.call_logs
    where called_by = p_user
  ),
  streak as (
    select count(*)::int as n
    from (
      select d, row_number() over (order by d desc) as rn
      from days
      where d <= (now() at time zone 'Africa/Addis_Ababa')::date
    ) t
    where d = (now() at time zone 'Africa/Addis_Ababa')::date - (rn - 1)::int
  )
  select
    (select count(*)::int from public.call_logs
      where called_by = p_user
        and (called_at at time zone 'Africa/Addis_Ababa')::date
            = (now() at time zone 'Africa/Addis_Ababa')::date),
    (select n from streak);
$$;
