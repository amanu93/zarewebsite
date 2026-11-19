-- ============================================================================
-- Zare Bench — 0007 audit fixes
--
-- Mirrors, in the database, every rule the audit pass moved into
-- src/bench/data/logic.ts. Additive: nothing from 0001–0006 is edited, and
-- constraints that historical rows might break are added NOT VALID.
--
--   1. Calendar days in East Africa Time
--   2. Calls record what they confirmed (C4, C5, C6, H3, H4, H5)
--   3. Candidates: placed, recall for not available, alerts, contact checks
--   4. Requests: requirements, outcomes, placements (C1, C3, H2)
--   5. Derived views rebuilt on the new rules (M1, M2, M8, M9)
--   6. The write paths: log_call, undo_call, archive, close, status, export
--   7. Weights recalculate stored overalls (M2)
--   8. Narrower RLS: role settings, request status and export by role
--
-- Not executed against a live database in this pass (the demo has none).
-- Run it on a staging copy first.
-- ============================================================================

-- ------------------------------------------------- 1. calendar days (EAT) --
create or replace function public.eat_today()
returns date language sql stable as $$
  select (now() at time zone 'Africa/Nairobi')::date;
$$;

-- Calendar days from today to a moment: 0 today, 1 tomorrow, -1 yesterday.
create or replace function public.days_from_today(p_at timestamptz)
returns int language sql stable as $$
  select case when p_at is null then null
              else ((p_at at time zone 'Africa/Nairobi')::date - public.eat_today()) end;
$$;

-- "Node.js", "NodeJS" and "node js" are one tag.
create or replace function public.normalize_tag(p_tag text)
returns text language sql immutable as $$
  select regexp_replace(lower(btrim(p_tag)), '[\s.]+', '', 'g');
$$;

-- One canonical phone form; null when it is not a phone number.
create or replace function public.normalize_phone(p_raw text)
returns text language plpgsql immutable as $$
declare
  v_trim   text := btrim(coalesce(p_raw, ''));
  v_digits text := regexp_replace(v_trim, '\D', '', 'g');
  v_local  text;
begin
  if v_trim = '' or v_trim ~ '[^0-9\s()+.-]' then return null; end if;
  if v_trim like '+%' and v_digits not like '251%' then
    return case when length(v_digits) between 8 and 15 then '+' || v_digits end;
  end if;
  v_local := case
    when v_digits like '251%' then substr(v_digits, 4)
    when v_digits like '0%'   then substr(v_digits, 2)
    else v_digits end;
  return case when v_local ~ '^[79][0-9]{8}$' then '+251' || v_local end;
end;
$$;

-- ------------------------------------------------ 2. calls record details --
alter table public.call_logs
  add column notice_period       text,
  add column earliest_start_date date,
  add column shift_flexibility   text[],
  add column recall_at           date;

alter table public.call_logs
  add constraint call_note_length check (note is null or length(note) <= 280) not valid,
  add constraint available_call_asks_notice check (
    outcome <> 'available' or notice_period in ('Immediate', '1 week', '2 weeks', '1 month', '2 months', '3 months')
  ) not valid,
  add constraint available_call_asks_start check (
    outcome <> 'available' or notice_period = 'Immediate' or earliest_start_date is not null
  ) not valid,
  add constraint not_available_call_has_recall check (
    outcome <> 'not_available' or recall_at is not null
  ) not valid;

-- ------------------------------------------------------- 3. candidates -----
alter table public.candidates drop constraint if exists candidates_archived_reason_check;
alter table public.candidates
  add constraint candidates_archived_reason_check check (archived_reason in
    ('took_other_job', 'not_interested', 'left_country', 'do_not_contact', 'placed'));

-- A recall date now also belongs to someone who said Not available.
alter table public.candidates drop constraint if exists recall_only_for_recallable_reasons;
alter table public.candidates
  add constraint recall_only_for_recallable_reasons check (
    recall_at is null
    or archived_reason in ('took_other_job', 'not_interested')
    or (archived_reason is null and availability_status = 'not_available'));

alter table public.candidates
  add column ready_exit_alerted_for timestamptz;

comment on column public.candidates.ready_exit_alerted_for is
  'The expiry the hourly check last warned the owner about, so each confirmation''s leaving-Ready warning is sent once.';

alter table public.candidates
  add constraint strength_length check (
    coalesce(length(strengths[1]), 0) <= 120 and coalesce(length(strengths[2]), 0) <= 120) not valid,
  add constraint concern_length check (concern is null or length(concern) <= 160) not valid,
  add constraint experience_range check (years_experience is null or years_experience <= 60) not valid,
  add constraint phone_is_valid check (phone is null or public.normalize_phone(phone) = phone) not valid,
  add constraint linkedin_is_https check (
    linkedin_url is null or linkedin_url ~* '^https://([a-z]+\.)?linkedin\.com/\S+$') not valid;

-- The same number twice is the same person. Existing rows may already hold
-- duplicates, or the same number typed two ways, and a unique index would
-- fail the whole migration. So: list them in a view for review, and create
-- the index only when there are none. Re-run the block below after merging
-- the duplicates it reports.
create view public.duplicate_phones with (security_invoker = true) as
select public.normalize_phone(phone) as phone, array_agg(ref_code order by ref_code) as ref_codes, count(*) as records
from public.candidates
where phone is not null and deleted_at is null
group by public.normalize_phone(phone)
having count(*) > 1;

do $$
begin
  if exists (select 1 from public.duplicate_phones) then
    raise notice 'candidates_phone_unique not created: % phone numbers are shared. Review public.duplicate_phones, merge them, then run: create unique index candidates_phone_unique on public.candidates (public.normalize_phone(phone)) where phone is not null and deleted_at is null;',
      (select count(*) from public.duplicate_phones);
  else
    create unique index candidates_phone_unique on public.candidates (public.normalize_phone(phone))
      where phone is not null and deleted_at is null;
  end if;
end;
$$;

-- -------------------------------------------------------- 4. requests ------
alter table public.requests
  add column required_skills text[] not null default '{}',
  add column required_shifts text[] not null default '{}',
  add column outcome         text check (outcome in ('filled', 'partly_filled', 'lost', 'cancelled')),
  add column closed_at       timestamptz,
  add column placed_outside  int not null default 0 check (placed_outside between 0 and 100);

alter table public.requests
  add constraint quantity_range check (quantity between 1 and 100) not valid,
  add constraint client_name_length check (length(btrim(client_name)) between 1 and 120) not valid,
  add constraint closed_has_outcome check (
    (status = 'closed') = (outcome is not null and closed_at is not null)) not valid;

create table public.placements (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.requests(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete restrict,
  placed_at    timestamptz not null default now(),
  unique (request_id, candidate_id)
);

alter table public.placements enable row level security;
create policy "authenticated full access" on public.placements for all to authenticated
  using (true) with check (true);
revoke all on public.placements from anon;

alter table public.shortlists add column exported_document jsonb;
comment on column public.shortlists.exported_document is
  'Exactly what was sent, frozen at export: the whitelisted ExportDocument. "Download again" renders this.';

alter table public.job_runs add column skipped_reason text;

-- ---------------------------------------------------- 5. derived views -----
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
  -- Only an Available confirmation has a shelf life.
  case when c.availability_status = 'available'
       then c.last_verified_at + make_interval(days => a.freshness_days) end as expires_at,
  -- Calendar days in EAT, 0 on the day of expiry.
  case when c.availability_status = 'available'
       then public.days_from_today(c.last_verified_at + make_interval(days => a.freshness_days)) end
    as days_until_expiry,
  case
    when c.archived_reason is not null then 'archived'
    when c.assessed_at is null         then 'raw'
    when c.availability_status = 'available'
     and c.last_verified_at is not null
     and c.last_verified_at > now() - make_interval(days => a.freshness_days)
                                       then 'ready'
    else 'known'
  end as layer,
  case when c.overall_score is null then null
       when c.technical_score is null and a.technical_weight > 0 then 'communication_only'
       else 'weighted' end as overall_basis,
  coalesce(public.days_from_today(c.assessed_at) <= -180, false) as reassess_due
from public.candidates c
join public.archetypes a on a.id = c.archetype_id
where c.deleted_at is null;

-- One call away: Known, previously confirmed available and now expired, or
-- not available with the recall date reached. Never-verified is excluded.
create or replace function public.is_one_call_away(v public.candidates_view)
returns boolean language sql stable as $$
  select v.layer = 'known' and (
    (v.availability_status = 'available' and v.last_verified_at is not null)
    or (v.availability_status = 'not_available' and v.recall_at is not null and v.recall_at <= public.eat_today()));
$$;

create view public.bench_health with (security_invoker = true) as
select
  a.id as archetype_id, a.code, a.name, a.color, a.target_ready, a.freshness_days,
  count(*) filter (where v.layer = 'ready')    as ready_count,
  count(*) filter (where v.layer = 'known')    as known_count,
  count(*) filter (where v.layer = 'raw')      as raw_count,
  count(*) filter (where v.layer = 'archived') as archived_count,
  count(*) filter (where public.is_one_call_away(v)) as one_call_away,
  count(*) filter (where v.layer = 'ready' and v.days_until_expiry between 0 and 7) as expiring_this_week,
  round((count(*) filter (where v.layer = 'ready'))::numeric / a.target_ready, 2) as coverage,
  case
    when (count(*) filter (where v.layer = 'ready'))::numeric / a.target_ready >= 1.0 then 'green'
    when (count(*) filter (where v.layer = 'ready'))::numeric / a.target_ready >= 0.6 then 'amber'
    else 'red'
  end as status
from public.archetypes a
left join public.candidates_view v on v.archetype_id = a.id
group by a.id, a.code, a.name, a.color, a.target_ready, a.freshness_days;

-- The queue. Nobody who needs a call drops out: an unanswered call cools
-- down for 48 hours whatever the layer and comes back as Retry. Not
-- available waits for its recall date. Cooling-down rows are included with
-- retry_at set, so screens can show them as waiting.
create view public.call_queue with (security_invoker = true) as
with last_attempt as (
  select distinct on (candidate_id) candidate_id, outcome, called_at
  from public.call_logs
  where outcome in ('available', 'not_available', 'no_answer')
  order by candidate_id, called_at desc
), rows as (
  select
    v.*,
    la.outcome   as last_outcome,
    la.called_at as last_called_at,
    case when la.outcome = 'no_answer' and la.called_at + interval '48 hours' > now()
         then la.called_at + interval '48 hours' end as retry_at,
    case
      when v.layer = 'raw' then null
      when v.layer = 'archived' and (v.recall_at is null or v.recall_at > public.eat_today()) then null
      when la.outcome = 'no_answer' then 'no_answer_retry'
      when v.layer = 'archived' then 'recall_due'
      when v.availability_status = 'not_available' then
        case when coalesce(v.recall_at, (v.last_verified_at at time zone 'Africa/Nairobi')::date + 30) <= public.eat_today()
             then 'recall_due' end
      when v.last_verified_at is null then 'never_verified'
      when v.layer = 'known' then 'expired'
      when v.days_until_expiry <= 7 then 'expiring_soon'
    end as reason
  from public.candidates_view v
  left join last_attempt la on la.candidate_id = v.id
)
select
  id, ref_code, full_name, phone, owner_id, archetype_id, archetype_code, archetype_name, archetype_color,
  layer, availability_status, last_verified_at, expires_at, days_until_expiry, recall_at, shift_flexibility,
  last_outcome, last_called_at, retry_at, reason,
  case reason when 'never_verified' then 1 when 'expired' then 1 when 'expiring_soon' then 2
              when 'no_answer_retry' then 3 else 4 end as priority
from rows
where reason is not null
order by (retry_at is not null), priority, coalesce(expires_at, 'epoch'::timestamptz);

-- Only calls count: archiving is not a conversation.
create or replace function public.call_stats(p_user uuid default auth.uid())
returns table (calls_today int, streak_days int)
language sql stable as $$
  with days as (
    select distinct (called_at at time zone 'Africa/Nairobi')::date as d
    from public.call_logs
    where called_by = p_user and outcome in ('available', 'not_available', 'no_answer')
  ),
  streak as (
    select count(*)::int as n from (
      select d, row_number() over (order by d desc) as rn from days where d <= public.eat_today()
    ) t where d = public.eat_today() - (rn - 1)::int
  )
  select
    (select count(*)::int from public.call_logs
      where called_by = p_user and outcome in ('available', 'not_available', 'no_answer')
        and (called_at at time zone 'Africa/Nairobi')::date = public.eat_today()),
    (select n from streak);
$$;

-- Candidates who meet every requirement of a request.
create or replace function public.request_fit(p_request public.requests, v public.candidates_view)
returns boolean language sql stable as $$
  select
    not exists (
      select 1 from unnest(p_request.required_skills) r(tag)
      where public.normalize_tag(r.tag) not in (
        select public.normalize_tag(t) from unnest(v.stack || v.skills) s(t)))
    and not exists (
      select 1 from unnest(p_request.required_shifts) r(shift)
      where r.shift <> all (v.shift_flexibility));
$$;

-- Bench contribution this quarter, from requests closed in it.
create view public.bench_contribution with (security_invoker = true) as
with closed as (
  select * from public.requests
  where status = 'closed'
    and date_trunc('quarter', closed_at at time zone 'Africa/Nairobi')
      = date_trunc('quarter', now() at time zone 'Africa/Nairobi')
)
select
  (select count(*) from public.placements p join closed c on c.id = p.request_id)::int as from_bench,
  (select coalesce(sum(placed_outside), 0) from closed)::int                          as from_outside;

-- ------------------------------------------------------ 6. write paths -----
drop function if exists public.log_call(uuid, text, text);

create or replace function public.log_call(
  p_candidate_id        uuid,
  p_outcome             text,
  p_note                text default null,
  p_notice_period       text default null,
  p_earliest_start_date date default null,
  p_shift_flexibility   text[] default null,
  p_recall_at           date default null
)
returns public.call_logs
language plpgsql security invoker as $$
declare
  v_log  public.call_logs;
  v_cand public.candidates;
begin
  if p_outcome not in ('available', 'not_available', 'no_answer') then
    raise exception 'log_call handles available, not_available and no_answer. Use archive_candidate() to archive.';
  end if;
  select * into v_cand from public.candidates where id = p_candidate_id and deleted_at is null for update;
  if not found then raise exception 'Candidate not found.'; end if;
  if v_cand.assessed_at is null then raise exception 'Not exportable. Assess first.'; end if;

  -- A second press within three seconds is the same call.
  if exists (select 1 from public.call_logs where candidate_id = p_candidate_id and called_by = auth.uid()
             and called_at > now() - interval '3 seconds') then
    raise exception 'That call was just logged.';
  end if;

  if p_outcome = 'available' and p_notice_period <> 'Immediate'
     and (p_earliest_start_date is null or p_earliest_start_date < public.eat_today()) then
    raise exception 'Ask when they could start.';
  end if;
  if p_outcome = 'not_available'
     and (p_recall_at is null or p_recall_at <= public.eat_today() or p_recall_at > public.eat_today() + 365) then
    raise exception 'Choose a recall date after today and within a year.';
  end if;

  insert into public.call_logs (candidate_id, called_by, outcome, note, notice_period, earliest_start_date, shift_flexibility, recall_at)
  values (
    p_candidate_id, auth.uid(), p_outcome, nullif(btrim(p_note), ''),
    case when p_outcome = 'available' then p_notice_period end,
    case when p_outcome = 'available' and p_notice_period <> 'Immediate' then p_earliest_start_date end,
    case when p_outcome = 'available' then coalesce(p_shift_flexibility, '{}') end,
    case when p_outcome = 'not_available' then p_recall_at end)
  returning * into v_log;

  if p_outcome in ('available', 'not_available') then
    perform set_config('zare.logging_call', 'on', true);
    update public.candidates set
      availability_status = p_outcome,
      last_verified_at    = v_log.called_at,
      notice_period       = case when p_outcome = 'available' then v_log.notice_period else notice_period end,
      earliest_start_date = case when p_outcome = 'available' then v_log.earliest_start_date end,
      shift_flexibility   = case when p_outcome = 'available' then v_log.shift_flexibility else shift_flexibility end,
      recall_at           = case when p_outcome = 'available' then null else v_log.recall_at end,
      archived_reason     = case when p_outcome = 'available' and archived_reason <> 'do_not_contact' then null
                                 else archived_reason end
    where id = p_candidate_id;
    perform set_config('zare.logging_call', 'off', true);
  end if;
  return v_log;
end;
$$;

create or replace function public.update_call_note(p_call_id uuid, p_note text)
returns void language plpgsql security invoker as $$
begin
  if length(coalesce(p_note, '')) > 280 then raise exception '280 characters at most.'; end if;
  update public.call_logs set note = nullif(btrim(p_note), '')
   where id = p_call_id and called_by = auth.uid() and outcome <> 'archived';
  if not found then raise exception 'Only the caller can edit this note.'; end if;
end;
$$;

-- Undo within a minute, by the caller, if nothing has happened since. The
-- app passes back the candidate columns it replaced.
create or replace function public.undo_call(p_call_id uuid, p_before jsonb)
returns void language plpgsql security invoker as $$
declare v_log public.call_logs;
begin
  select * into v_log from public.call_logs where id = p_call_id for update;
  if not found or v_log.called_by <> auth.uid() or v_log.called_at < now() - interval '60 seconds'
     or exists (select 1 from public.call_logs where candidate_id = v_log.candidate_id and called_at > v_log.called_at) then
    raise exception 'Too late to undo.';
  end if;
  perform set_config('zare.logging_call', 'on', true);
  update public.candidates set
    availability_status = p_before->>'availability_status',
    last_verified_at    = (p_before->>'last_verified_at')::timestamptz,
    notice_period       = p_before->>'notice_period',
    earliest_start_date = (p_before->>'earliest_start_date')::date,
    shift_flexibility   = coalesce(array(select jsonb_array_elements_text(p_before->'shift_flexibility')), '{}'),
    recall_at           = (p_before->>'recall_at')::date,
    archived_reason     = p_before->>'archived_reason'
  where id = v_log.candidate_id;
  perform set_config('zare.logging_call', 'off', true);
  delete from public.call_logs where id = p_call_id;
end;
$$;

-- An erased candidate leaves every unsent shortlist. Sent ones keep history.
create or replace function public.remove_erased_from_drafts()
returns trigger language plpgsql as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    delete from public.shortlist_candidates sc
     using public.shortlists s
     where sc.shortlist_id = s.id and s.status = 'draft' and sc.candidate_id = new.id;
  end if;
  return new;
end;
$$;
create trigger candidates_remove_erased_from_drafts
  after update of deleted_at on public.candidates
  for each row execute function public.remove_erased_from_drafts();

create or replace function public.can_manage_requests()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.users where id = auth.uid() and role in ('account_manager', 'exec'));
$$;

create or replace function public.close_request(
  p_request_id uuid, p_outcome text, p_placed uuid[], p_placed_outside int
) returns void language plpgsql security invoker as $$
declare
  v_req   public.requests;
  v_total int := coalesce(array_length(p_placed, 1), 0) + p_placed_outside;
begin
  if not public.can_manage_requests() then raise exception 'Only an account manager or an exec can do that.'; end if;
  select * into v_req from public.requests where id = p_request_id for update;
  if v_req.status = 'closed' then raise exception 'This request is already closed.'; end if;
  if p_outcome in ('filled', 'partly_filled') and v_total = 0 then raise exception 'Record who was placed.'; end if;
  if p_outcome = 'filled' and v_total < v_req.quantity then raise exception 'Choose Partly filled.'; end if;
  if p_outcome = 'partly_filled' and v_total >= v_req.quantity then raise exception 'Choose Filled.'; end if;
  if p_outcome in ('lost', 'cancelled') and v_total > 0 then raise exception 'No placements for %.', p_outcome; end if;
  if exists (select 1 from unnest(p_placed) p(id) where not exists (
      select 1 from public.shortlist_candidates sc join public.shortlists s on s.id = sc.shortlist_id
       where s.request_id = p_request_id and sc.candidate_id = p.id)) then
    raise exception 'Only shortlisted candidates can be recorded as placed.';
  end if;

  update public.requests set status = 'closed', outcome = p_outcome, closed_at = now(), placed_outside = p_placed_outside
   where id = p_request_id;
  insert into public.placements (request_id, candidate_id) select p_request_id, unnest(p_placed);
  insert into public.call_logs (candidate_id, called_by, outcome, note)
    select c.id, auth.uid(), 'archived', 'placed' from public.candidates c
     where c.id = any(p_placed) and c.archived_reason is null;
  update public.candidates set archived_reason = 'placed', recall_at = null
   where id = any(p_placed) and archived_reason is null;
  delete from public.shortlist_candidates sc using public.shortlists s
   where sc.shortlist_id = s.id and s.status = 'draft' and s.request_id <> p_request_id
     and sc.candidate_id = any(p_placed);
end;
$$;

-- Status follows data: open has nobody shortlisted, shortlisting has
-- someone, submitted has an exported shortlist, closed only via close_request,
-- and a closed request never changes again.
create or replace function public.guard_request_status()
returns trigger language plpgsql as $$
declare
  v_shortlisted int;
  v_exported    boolean;
begin
  if old.status = 'closed' and (new.status <> 'closed' or new.quantity <> old.quantity
     or new.required_skills <> old.required_skills or new.required_shifts <> old.required_shifts) then
    raise exception 'A closed request cannot be changed.';
  end if;
  if new.status is distinct from old.status then
    if not public.can_manage_requests() and auth.uid() is not null
       and not (old.status in ('open', 'shortlisting') and new.status in ('open', 'shortlisting')) then
      raise exception 'Only an account manager or an exec can do that.';
    end if;
    select count(*) into v_shortlisted from public.shortlist_candidates sc
      join public.shortlists s on s.id = sc.shortlist_id where s.request_id = new.id and s.status = 'draft';
    select exists (select 1 from public.shortlists where request_id = new.id and status = 'exported') into v_exported;
    if new.status = 'shortlisting' and v_shortlisted = 0 then raise exception 'Add at least one candidate first.'; end if;
    if new.status = 'submitted' and not v_exported then raise exception 'Export the shortlist first.'; end if;
    if new.status = 'closed' and new.outcome is null then raise exception 'Close the request with its outcome.'; end if;
  end if;
  return new;
end;
$$;
create trigger requests_guard_status before update on public.requests
  for each row execute function public.guard_request_status();

create or replace function public.guard_new_request()
returns trigger language plpgsql as $$
begin
  if new.required_by is not null and new.required_by < public.eat_today() then
    raise exception 'The deadline cannot be in the past.';
  end if;
  new.status := 'open';
  new.outcome := null;
  new.closed_at := null;
  return new;
end;
$$;
create trigger requests_guard_new before insert on public.requests
  for each row execute function public.guard_new_request();

-- Closed requests have read-only shortlists; exporting is account work.
create or replace function public.guard_shortlist_write()
returns trigger language plpgsql as $$
declare v_request uuid;
begin
  select request_id into v_request from public.shortlists
   where id = coalesce(new.shortlist_id, old.shortlist_id);
  if exists (select 1 from public.requests where id = v_request and status = 'closed') then
    raise exception 'This request is closed. Its shortlist is read-only.';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger shortlist_candidates_guard before insert or update or delete on public.shortlist_candidates
  for each row execute function public.guard_shortlist_write();

create or replace function public.guard_shortlist_export()
returns trigger language plpgsql as $$
begin
  if new.status = 'exported' and old.status = 'draft' then
    if not public.can_manage_requests() then raise exception 'Only an account manager or an exec can export.'; end if;
    if new.exported_document is null then raise exception 'An export records the document it sent.'; end if;
  end if;
  if old.status = 'exported' and (new.status <> 'exported' or new.exported_document is distinct from old.exported_document) then
    raise exception 'A sent shortlist cannot be changed.';
  end if;
  return new;
end;
$$;
create trigger shortlists_guard_export before update on public.shortlists
  for each row execute function public.guard_shortlist_export();

-- ------------------------------------------- 7. weights recalculate -------
create or replace function public.recalculate_overall_scores()
returns trigger language plpgsql as $$
begin
  if new.communication_weight is distinct from old.communication_weight
     or new.technical_weight is distinct from old.technical_weight then
    update public.candidates c set
      overall_score_calculated = calc.value,
      overall_score = least(5.0, greatest(1.0,
        calc.value + coalesce(c.overall_score - c.overall_score_calculated, 0))),
      overall_override_reason = case
        when coalesce(c.overall_score - c.overall_score_calculated, 0) = 0 then null
        else c.overall_override_reason end
    from (select id, public.calculate_overall_score(archetype_id, communication_score, technical_score) as value
            from public.candidates where archetype_id = new.id) calc
    where c.id = calc.id and calc.value is not null;
  end if;
  return new;
end;
$$;
create trigger archetypes_recalculate_overall after update on public.archetypes
  for each row execute function public.recalculate_overall_scores();

-- ------------------------------------------------------- 8. narrower RLS --
-- Role settings are an exec decision. Reading stays open to all staff.
drop policy if exists "authenticated full access" on public.archetypes;
create policy "staff read archetypes" on public.archetypes for select to authenticated using (true);
create policy "exec writes archetypes" on public.archetypes for all to authenticated
  using (exists (select 1 from public.users where id = auth.uid() and role = 'exec'))
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'exec'));

-- Running a job by hand sends email; only an exec may start one. Scheduled
-- runs use the service role, which bypasses RLS.
drop policy if exists "authenticated full access" on public.job_runs;
create policy "staff read job runs" on public.job_runs for select to authenticated using (true);
create policy "exec runs jobs" on public.job_runs for insert to authenticated
  with check (exists (select 1 from public.users where id = auth.uid() and role = 'exec'));
