-- Migration 017 — Cross-portal permissions, Phase 2: row-scope the SHARED tables.
--
-- These tables ARE used by the client/cleaner portals, but the app already filters every
-- read by owner (verified): clients .eq('id', linkedClientId), job_assignments
-- .eq('client_id'|'cleaner_id'), profiles .eq('user_id', auth uid), etc. These policies
-- enforce those same conditions so the app's existing queries keep working, while blocking
-- cross-account access via the raw API. Service-role (createAdminClient) bypasses RLS.
--
-- Embed paths validated against live data: a client can read their cleaner's profile
-- (job_assignments -> profiles) and their job photos (-> job_submissions); a cleaner can
-- read their assigned clients. See validation in the PR notes.
--
-- NOTE: the client-feedback action also reads manager emails (profiles where role=manager)
-- to CC them; under these policies that read returns empty, so managers lose the CC — the
-- feedback still saves and admin@corecleaning.services is still notified. Proper fix later:
-- move that read to the service-role client.

-- ── Identity helpers (SECURITY DEFINER → bypass RLS, no recursion) ──
create or replace function public.app_linked_client_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp
  as $$ select linked_client_id from public.profiles where user_id = auth.uid() limit 1 $$;
create or replace function public.app_profile_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp
  as $$ select id from public.profiles where user_id = auth.uid() limit 1 $$;
revoke all on function public.app_linked_client_id() from public, anon;
revoke all on function public.app_profile_id()      from public, anon;
grant execute on function public.app_linked_client_id() to authenticated;
grant execute on function public.app_profile_id()      to authenticated;

-- ── Drop the permissive USING(true) policies on every shared table ──
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' and tablename in
    ('clients','job_assignments','client_sites','documents','compliance_documents',
     'job_submissions','client_issues','photo_requests','client_feedback','service_requests','profiles')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- Helper expressions used below:
--   manager := app_user_role() in ('admin','manager')

-- ── clients ── client sees own; cleaner sees assigned; manager all. Writes: manager only.
create policy clients_select on public.clients for select to authenticated using (
  app_user_role() in ('admin','manager') or id = app_linked_client_id() or assigned_cleaner_id = app_profile_id());
create policy clients_ins on public.clients for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy clients_upd on public.clients for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy clients_del on public.clients for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── job_assignments ── client sees own; cleaner sees + updates own; manager all.
create policy ja_select on public.job_assignments for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id() or cleaner_id = app_profile_id());
create policy ja_ins on public.job_assignments for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy ja_upd on public.job_assignments for update to authenticated using (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id())
  with check (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy ja_del on public.job_assignments for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── client_sites ── client sees own; cleaner sees assigned; manager writes.
create policy cs_select on public.client_sites for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id() or assigned_cleaner_id = app_profile_id());
create policy cs_ins on public.client_sites for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy cs_upd on public.client_sites for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy cs_del on public.client_sites for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── documents ── client sees own; manager writes.
create policy doc_select on public.documents for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy doc_ins on public.documents for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy doc_upd on public.documents for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy doc_del on public.documents for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── compliance_documents ── client sees own; manager writes.
create policy cd_select on public.compliance_documents for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy cd_ins on public.compliance_documents for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy cd_upd on public.compliance_documents for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy cd_del on public.compliance_documents for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── job_submissions ── cleaner reads/writes own; client reads their jobs'; manager all.
create policy js_select on public.job_submissions for select to authenticated using (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id()
  or job_id in (select id from public.job_assignments where client_id = app_linked_client_id()));
create policy js_ins on public.job_submissions for insert to authenticated with check (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy js_upd on public.job_submissions for update to authenticated using (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id())
  with check (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy js_del on public.job_submissions for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── client_issues ── client reads + creates own; manager all.
create policy ci_select on public.client_issues for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy ci_ins on public.client_issues for insert to authenticated with check (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy ci_upd on public.client_issues for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy ci_del on public.client_issues for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── photo_requests ── client reads + creates own; manager all.
create policy pr_select on public.photo_requests for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy pr_ins on public.photo_requests for insert to authenticated with check (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy pr_upd on public.photo_requests for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy pr_del on public.photo_requests for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── client_feedback ── client reads + creates own; manager all.
create policy cf_select on public.client_feedback for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy cf_ins on public.client_feedback for insert to authenticated with check (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy cf_upd on public.client_feedback for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy cf_del on public.client_feedback for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── service_requests ── client reads + creates own; manager all.
create policy sr_select on public.service_requests for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy sr_ins on public.service_requests for insert to authenticated with check (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy sr_upd on public.service_requests for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy sr_del on public.service_requests for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── profiles ── everyone reads own; client also reads their assigned cleaner (embed);
--                manager reads all. Self-update allowed; create/delete is manager (admin client).
create policy prof_select on public.profiles for select to authenticated using (
  app_user_role() in ('admin','manager') or user_id = auth.uid()
  or id in (select cleaner_id from public.job_assignments where client_id = app_linked_client_id()));
create policy prof_ins on public.profiles for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy prof_upd on public.profiles for update to authenticated using (
  app_user_role() in ('admin','manager') or user_id = auth.uid())
  with check (app_user_role() in ('admin','manager') or user_id = auth.uid());
create policy prof_del on public.profiles for delete to authenticated using (app_user_role() in ('admin','manager'));
