-- ============================================================================
-- Zare Bench — 0001 schema
--
-- Two ideas run through this file and everything is arranged around them:
--
--   assessment data is PERMANENT.    Once someone is assessed at C1 English
--                                    with a 4.2 technical score, that is true
--                                    until re-assessed. It never expires.
--   availability data is PERISHABLE. It is a claim about the world that
--                                    decays from the moment it is made.
--
-- They live in one table because they describe one person, but they are kept
-- apart by three mechanisms: distinct column blocks; a hard database guard so
-- availability can only move by logging a call (0002); and the fact that
-- availability has a full history in call_logs while assessment does not.
--
-- `layer` is deliberately NOT a column. It is derived in 0002 from
-- assessed_at, availability_status and last_verified_at against the
-- archetype's freshness window. A stored layer would be wrong within hours.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- users ----
-- Extends auth.users. Role drives which emails you receive and which nav you
-- see. It does NOT gate write access: all three roles edit everything.
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        text not null default 'recruiter'
              check (role in ('recruiter', 'account_manager', 'exec')),
  created_at  timestamptz not null default now()
);

comment on table public.users is
  'Application profile for an auth user. Role affects notifications and navigation, never write permission.';

-- Mirror a new auth user into public.users so a profile always exists.
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
    coalesce(new.raw_user_meta_data ->> 'role', 'recruiter')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------- archetypes ----
-- Standing role categories. target_ready and freshness_days are the two
-- numbers the whole system is tuned by, and both are editable in settings.
create table public.archetypes (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  code            text not null unique,
  target_ready    int not null check (target_ready > 0),
  freshness_days  int not null check (freshness_days > 0),
  coverage_ratio  numeric(4,1) not null check (coverage_ratio > 0),
  color           text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at      timestamptz not null default now()
);

comment on column public.archetypes.freshness_days is
  'How long an availability verification stays valid for this archetype. Drives the ready/known boundary.';
comment on column public.archetypes.coverage_ratio is
  'Display only in v1: candidates needed per placement.';

-- ----------------------------------------------------------- candidates ----
-- ref_code comes from a sequence, so a code is never reused even when a
-- do_not_contact record is hard deleted out from under it.
create sequence public.candidate_ref_seq start 1;

create table public.candidates (
  id                    uuid primary key default gen_random_uuid(),
  ref_code              text not null unique,
  archetype_id          uuid not null references public.archetypes(id) on delete restrict,

  -- == identity =============================================================
  -- INTERNAL ONLY. None of this may ever reach a client export. The PDF is
  -- built from an explicit whitelist, not by excluding these columns, so
  -- adding a field here cannot leak identity later.
  full_name             text not null,
  phone                 text,
  email                 text,
  location              text,
  linkedin_url          text,

  -- == assessment (permanent, does not expire) ==============================
  years_experience      numeric(4,1) check (years_experience >= 0),
  seniority             text check (seniority in ('junior', 'mid', 'senior', 'lead')),
  stack                 text[] not null default '{}',
  skills                text[] not null default '{}',
  english_level         text check (english_level in ('C2', 'C1', 'B2', 'B1', 'below')),
  communication_score   numeric(2,1) check (communication_score between 1.0 and 5.0),
  technical_score       numeric(2,1) check (technical_score between 1.0 and 5.0),
  overall_score         numeric(2,1) check (overall_score between 1.0 and 5.0),
  assessed_by           uuid references public.users(id) on delete set null,
  assessed_at           timestamptz,
  strengths             text[] not null default '{}',
  concern               text,
  notes                 text,
  cv_url                text,

  -- == availability (perishable) ============================================
  -- last_verified_at is the field this product exists to keep fresh. It is
  -- writable ONLY through log_call() — enforced by a trigger in 0002.
  availability_status   text not null default 'unknown'
                        check (availability_status in ('available', 'not_available', 'unknown')),
  earliest_start_date   date,
  notice_period         text,
  last_verified_at      timestamptz,
  shift_flexibility     text[] not null default '{}',
  setup_verified        boolean not null default false,

  -- == lifecycle ============================================================
  owner_id              uuid references public.users(id) on delete set null,
  archived_reason       text check (archived_reason in
                          ('took_other_job', 'not_interested', 'left_country', 'do_not_contact')),
  recall_at             date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- An assessed candidate is an exportable candidate, so the fields the
  -- export depends on become required the moment assessment completes. The
  -- concern especially: a shortlist where everyone looks flawless reads as
  -- sales copy and the client discounts all of it.
  constraint assessed_needs_concern check (
    assessed_at is null or (concern is not null and length(btrim(concern)) > 0)),
  constraint assessed_needs_two_strengths check (
    assessed_at is null or array_length(strengths, 1) = 2),
  constraint assessed_needs_overall_score check (
    assessed_at is null or overall_score is not null),

  -- left_country is retained but never recalled; do_not_contact is hard
  -- deleted by archive_candidate() and so should never persist at all.
  constraint recall_only_for_recallable_reasons check (
    recall_at is null or archived_reason in ('took_other_job', 'not_interested'))
);

comment on column public.candidates.last_verified_at is
  'When availability was last confirmed by phone. Written only by log_call(). Everything downstream keys off this.';

create index candidates_archetype_idx on public.candidates (archetype_id);
create index candidates_owner_idx     on public.candidates (owner_id);
create index candidates_verified_idx  on public.candidates (last_verified_at);
create index candidates_archived_idx  on public.candidates (archived_reason) where archived_reason is not null;
create index candidates_recall_idx    on public.candidates (recall_at) where recall_at is not null;
create index candidates_stack_idx     on public.candidates using gin (stack);
create index candidates_skills_idx    on public.candidates using gin (skills);

-- Assign the next ref code. Sequence gaps are acceptable; reuse is not.
create or replace function public.set_ref_code()
returns trigger language plpgsql as $$
begin
  if new.ref_code is null then
    new.ref_code := 'ZT-' || lpad(nextval('public.candidate_ref_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger candidates_set_ref_code
  before insert on public.candidates
  for each row execute function public.set_ref_code();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger candidates_touch_updated_at
  before update on public.candidates
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------ call_logs ----
-- Every verification attempt, including the ones that reached nobody. This is
-- the audit trail and the activity feed, and it gives availability the
-- history that assessment does not need.
create table public.call_logs (
  id            uuid primary key default gen_random_uuid(),
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  called_by     uuid references public.users(id) on delete set null,
  outcome       text not null check (outcome in ('available', 'not_available', 'no_answer', 'archived')),
  note          text,
  called_at     timestamptz not null default now()
);

create index call_logs_candidate_idx on public.call_logs (candidate_id, called_at desc);
create index call_logs_called_at_idx on public.call_logs (called_at desc);
create index call_logs_caller_idx    on public.call_logs (called_by, called_at desc);

-- ------------------------------------------------------------- requests ----
create table public.requests (
  id            uuid primary key default gen_random_uuid(),
  client_name   text not null,
  archetype_id  uuid not null references public.archetypes(id) on delete restrict,
  quantity      int not null check (quantity > 0),
  required_by   date,
  status        text not null default 'open'
                check (status in ('open', 'shortlisting', 'submitted', 'closed')),
  notes         text,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index requests_status_idx    on public.requests (status);
create index requests_archetype_idx on public.requests (archetype_id);

-- ----------------------------------------------------------- shortlists ----
create table public.shortlists (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests(id) on delete cascade,
  title       text not null,
  status      text not null default 'draft' check (status in ('draft', 'exported')),
  exported_at timestamptz,
  exported_by uuid references public.users(id) on delete set null,
  pdf_url     text
);

create index shortlists_request_idx on public.shortlists (request_id);

create table public.shortlist_candidates (
  id            uuid primary key default gen_random_uuid(),
  shortlist_id  uuid not null references public.shortlists(id) on delete cascade,
  candidate_id  uuid not null references public.candidates(id) on delete cascade,
  -- Availability as confirmed at the moment of inclusion. Frozen on purpose:
  -- it is what the client was told, and it must not drift afterwards.
  verified_at   timestamptz not null,
  position      int not null default 0,
  unique (shortlist_id, candidate_id)
);

create index shortlist_candidates_shortlist_idx on public.shortlist_candidates (shortlist_id, position);
create index shortlist_candidates_candidate_idx on public.shortlist_candidates (candidate_id);
