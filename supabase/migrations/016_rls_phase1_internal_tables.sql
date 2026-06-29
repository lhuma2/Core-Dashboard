-- Migration 016 — Cross-portal permissions, Phase 1: lock financial/sales/internal tables.
--
-- These 8 tables are read/written ONLY by the manager (app) area — the client and cleaner
-- portals never touch them (verified across pages + shared actions in src/). Today every
-- `authenticated` user (incl. 8 client + 4 cleaner logins) can read them via the REST API.
-- This restricts them to admin/manager. Service-role access (createAdminClient) bypasses
-- RLS and is unaffected; the manager portal keeps full access via the role check.
--
-- Phase 2 (separate, higher-touch) will row-scope the SHARED tables (clients, job_assignments,
-- client_sites, documents, compliance_documents, job_submissions, client_issues,
-- photo_requests, client_feedback, service_requests) so each client/cleaner sees only their own.

-- 1. Role helper — SECURITY DEFINER reads the caller's role without tripping RLS recursion.
create or replace function public.app_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select role from public.profiles where user_id = auth.uid() limit 1 $$;

revoke all on function public.app_user_role() from public, anon;
grant execute on function public.app_user_role() to authenticated;

-- 2. Drop the permissive (USING true) policies on the 8 internal tables.
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in (
        'financial_records','invoices','invoice_line_items','client_monthly_financials',
        'leads','emails_sent','email_templates','settings')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 3. Manager/admin-only access on each (one ALL policy covers select/insert/update/delete).
create policy manager_only on public.financial_records         for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.invoices                  for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.invoice_line_items        for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.client_monthly_financials for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.leads                     for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.emails_sent               for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.email_templates           for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.settings                  for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
