-- ============================================================================
-- Zare Bench — 0006 notification preferences, scarcity state and job runs
--
-- Three things settings needs that the schema did not yet hold:
--
--   1. who receives which email, per user
--   2. the last health status a scarcity alert was sent for, so an alert
--      fires on a TRANSITION and not every time the job runs
--   3. a record of every scheduled or manually triggered job, so "did the
--      Monday warning go out?" has an answer
--
-- Plus one guard: the last exec cannot be demoted, or nobody could ever
-- change a role again.
-- ============================================================================

-- ------------------------------------------- 1. notification preferences --
-- One column per email. Deliberately not jsonb: four booleans are easier to
-- query ("who gets the Monday warning?") and cannot hold a typo'd key.
alter table public.users
  add column notify_scarcity       boolean not null default true,
  add column notify_decay_warning  boolean not null default true,
  add column notify_new_request    boolean not null default true,
  add column notify_weekly_summary boolean not null default false;

comment on column public.users.notify_decay_warning is
  'Monday 07:00 EAT list of this user''s candidates about to leave Ready, plus recalls due. Only sent to users who own candidates, and skipped when the list is empty.';
comment on column public.users.notify_weekly_summary is
  'Friday 16:00 EAT bench summary. On by default for execs only.';

-- Sensible starting points by role. Anyone can change their own afterwards.
update public.users set notify_weekly_summary = true where role = 'exec';
update public.users set notify_decay_warning  = false where role <> 'recruiter';

-- New signups are always recruiters (0004), so the column defaults already
-- fit them; no change to handle_new_user is needed.

-- ------------------------------------------------ 2. scarcity transitions --
alter table public.archetypes
  add column last_health_status text
    check (last_health_status in ('green', 'amber', 'red'));

comment on column public.archetypes.last_health_status is
  'Health status as of the last scarcity check. An alert is sent only when the current status is worse than this.';

-- Start from today's reality so the first run after deploy does not alert on
-- a shortage everyone already knows about.
update public.archetypes a
   set last_health_status = h.status
  from public.bench_health h
 where h.archetype_id = a.id;

-- --------------------------------------------------------- 3. job runs -----
create table public.job_runs (
  id               uuid primary key default gen_random_uuid(),
  job              text not null
                   check (job in ('scarcity_check', 'decay_warning', 'weekly_summary')),
  -- null when Vercel Cron ran it; the user when someone pressed "Run now"
  triggered_by     uuid references public.users(id) on delete set null,
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  emails_prepared  integer not null default 0 check (emails_prepared >= 0),
  -- One entry per email: recipient and a one-line summary. Never the body,
  -- and never candidate identity beyond what the recipient already sees.
  detail           jsonb not null default '[]'::jsonb,
  error            text
);

create index job_runs_job_started_idx on public.job_runs (job, started_at desc);

comment on table public.job_runs is
  'Audit trail of scheduled and manual job runs. Written by the job route handlers.';

alter table public.job_runs enable row level security;

create policy "authenticated full access"
  on public.job_runs for all to authenticated
  using (true) with check (true);

-- 0003 set default privileges, but be explicit for a table that is read by a
-- settings screen and written by a cron handler.
revoke all on public.job_runs from anon;
grant all on public.job_runs to authenticated;

-- -------------------------------------------------- 4. keep one exec -------
create or replace function public.guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null
       and not exists (select 1 from public.users where id = auth.uid() and role = 'exec') then
      raise exception 'Only an exec can change a user role.'
        using errcode = 'insufficient_privilege';
    end if;

    -- Applies to everyone, including the service role: with no exec left,
    -- roles could only ever be changed from the SQL console again.
    if old.role = 'exec'
       and (select count(*) from public.users where role = 'exec' and id <> old.id) = 0 then
      raise exception 'At least one exec must remain.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
