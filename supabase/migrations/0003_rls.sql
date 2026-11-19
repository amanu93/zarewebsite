-- ============================================================================
-- Zare Bench — 0003 row level security
--
-- The rule is simple and the simplicity is the point: signed in, full access;
-- signed out, nothing at all. Role is a notification and navigation concept,
-- not a permission one, so there are no per-role policies to get wrong.
--
-- Every policy is scoped `to authenticated`. A request with no JWT matches no
-- policy and is refused. anon is additionally stripped of table grants below,
-- so the denial happens at two independent layers rather than one.
--
-- This file contains the entire access model. If a future policy needs to
-- narrow something, it belongs here, not spread across the app.
-- ============================================================================

alter table public.users                enable row level security;
alter table public.archetypes           enable row level security;
alter table public.candidates           enable row level security;
alter table public.call_logs            enable row level security;
alter table public.requests             enable row level security;
alter table public.shortlists           enable row level security;
alter table public.shortlist_candidates enable row level security;

-- Belt and braces: even with RLS on, do not leave anon holding grants.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema public to authenticated;
grant all on all tables    in schema public to authenticated;
grant all on all sequences in schema public to authenticated;

-- Anything created later inherits the same shape.
alter default privileges in schema public grant all on tables    to authenticated;
alter default privileges in schema public grant all on sequences to authenticated;
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- ------------------------------------------------------------- policies ----
-- One policy per table. `for all` covers select, insert, update and delete;
-- `using` gates the rows you may see and change, `with check` the rows you
-- may write. Both are unconditional for a signed-in user by design.

create policy "authenticated full access"
  on public.users for all to authenticated
  using (true) with check (true);

create policy "authenticated full access"
  on public.archetypes for all to authenticated
  using (true) with check (true);

create policy "authenticated full access"
  on public.candidates for all to authenticated
  using (true) with check (true);

create policy "authenticated full access"
  on public.call_logs for all to authenticated
  using (true) with check (true);

create policy "authenticated full access"
  on public.requests for all to authenticated
  using (true) with check (true);

create policy "authenticated full access"
  on public.shortlists for all to authenticated
  using (true) with check (true);

create policy "authenticated full access"
  on public.shortlist_candidates for all to authenticated
  using (true) with check (true);

-- --------------------------------------------------------------- storage ----
-- Both buckets are private. CVs carry identity and shortlist PDFs are client
-- deliverables; neither should ever be reachable by URL alone. The app serves
-- them through signed URLs with a short expiry.
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false), ('shortlists', 'shortlists', false)
on conflict (id) do nothing;

create policy "authenticated read bench files"
  on storage.objects for select to authenticated
  using (bucket_id in ('cvs', 'shortlists'));

create policy "authenticated write bench files"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('cvs', 'shortlists'));

create policy "authenticated update bench files"
  on storage.objects for update to authenticated
  using (bucket_id in ('cvs', 'shortlists'))
  with check (bucket_id in ('cvs', 'shortlists'));

create policy "authenticated delete bench files"
  on storage.objects for delete to authenticated
  using (bucket_id in ('cvs', 'shortlists'));

-- ------------------------------------------------------------- functions ----
-- Cron routes authenticate with the service role, which bypasses RLS. These
-- grants are for the interactive app only.
grant execute on function public.log_call(uuid, text, text)          to authenticated;
grant execute on function public.archive_candidate(uuid, text, text) to authenticated;
grant execute on function public.call_stats(uuid)                    to authenticated;
