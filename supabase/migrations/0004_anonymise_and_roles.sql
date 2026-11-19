-- ============================================================================
-- Zare Bench — 0004 anonymisation replaces deletion; exec-only role changes
--
-- Two changes, both narrowing what the system can do to a person or to itself.
--
-- 1. do_not_contact no longer deletes. It strips every field that could be
--    used to contact or identify someone and keeps the row. The shortlist a
--    client received in March still says who was on it; the person behind
--    ZT-0142 simply cannot be reached again, by anyone, ever. There is now no
--    delete path in the system at all.
--
-- 2. Role is the one field that is not "all three roles can write". A
--    recruiter who can promote themselves to exec makes the role column
--    decorative, and the exec summary is a business document.
-- ============================================================================

-- ------------------------------------------------- 1. anonymisation --------
-- full_name has to become nullable for an anonymised row to be truly empty.
-- The constraint keeps it required for everyone else.
alter table public.candidates alter column full_name drop not null;

alter table public.candidates
  add column deleted_at timestamptz;

comment on column public.candidates.deleted_at is
  'Set when a do_not_contact request is honoured. The row is retained for shortlist history; every identifying field is stripped and the candidate is excluded from all screens, counts and exports permanently.';

alter table public.candidates
  add constraint live_candidate_has_a_name check (
    deleted_at is not null or full_name is not null);

create index candidates_deleted_idx on public.candidates (deleted_at) where deleted_at is null;

-- Rewritten: anonymise instead of delete.
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

  -- The call that produced this decision is still part of the audit trail.
  -- For do_not_contact the note is dropped: it could describe the person.
  insert into public.call_logs (candidate_id, called_by, outcome, note)
  values (
    p_candidate_id,
    auth.uid(),
    'archived',
    case when p_reason = 'do_not_contact' then 'do_not_contact'
         else coalesce(p_note, p_reason) end
  );

  if p_reason = 'do_not_contact' then
    -- Strip everything that identifies or reaches the person. Assessment
    -- scores stay: they are about a ref code now, they cannot contact anyone,
    -- and removing them would corrupt historical shortlists.
    --
    -- The CV file itself lives in Storage and is NOT reachable from SQL. The
    -- caller must delete the object as part of this action — see
    -- archiveCandidate() in the app layer.
    update public.candidates
       set full_name       = null,
           phone           = null,
           email           = null,
           linkedin_url    = null,
           location        = null,
           notes           = null,
           cv_url          = null,
           archived_reason = 'do_not_contact',
           recall_at       = null,
           deleted_at      = now()
     where id = p_candidate_id;
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

-- ---------------------------------------------- views exclude the dead -----
-- candidates_view is what every screen reads, so exclusion lives HERE rather
-- than in each query. A screen cannot forget a filter it never had to write.
--
-- These are dropped and rebuilt rather than replaced: adding deleted_at to
-- the table makes `c.*` emit a new column in the middle of the view's column
-- list, and CREATE OR REPLACE VIEW only allows appending at the end. The two
-- dependent views go first and come back unchanged below.
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

-- The only thing an anonymised candidate still contributes to the product:
-- a ref code on a shortlist that was already sent. No identity, by shape.
create view public.candidate_refs with (security_invoker = true) as
select
  c.id,
  c.ref_code,
  c.archetype_id,
  a.code as archetype_code,
  (c.deleted_at is not null) as is_deleted
from public.candidates c
join public.archetypes a on a.id = c.archetype_id;

comment on view public.candidate_refs is
  'Identity-free candidate stub for shortlist history. Safe to join anywhere a past shortlist is displayed.';

-- Rebuilt unchanged from 0002. Both now inherit the anonymised exclusion from
-- candidates_view, so a do_not_contact record cannot reach a count or a queue.
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

-- ------------------------------------------- 2. exec-only role changes -----
-- Signup can no longer choose its own role. A new account is always a
-- recruiter; an exec promotes from settings. Without this, role metadata on
-- the signup request would be a self-service path to exec.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    'recruiter'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- auth.uid() is null for the service role and the SQL console, which are
    -- already trusted infrastructure and bypass RLS anyway. This guards the
    -- interactive app, where the risk is.
    if auth.uid() is not null
       and not exists (select 1 from public.users where id = auth.uid() and role = 'exec') then
      raise exception 'Only an exec can change a user role.'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

create trigger users_guard_role_change
  before update on public.users
  for each row execute function public.guard_role_change();

grant execute on function public.archive_candidate(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- NOTE: the first exec must be promoted directly, since no exec exists to do
-- it. Run once against a fresh project:
--
--   update public.users set role = 'exec' where email = 'you@zareinnovations.com';
-- ---------------------------------------------------------------------------
