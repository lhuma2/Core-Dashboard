-- Migration 018 — Fix: cleaners couldn't start jobs after RLS Phase 2 (017).
--
-- startCleanForClientAction inserts a new job_assignment (cleaner_id = the cleaner)
-- when starting a clean with no existing job record. Migration 017's ja_ins policy
-- only allowed admin/manager to insert, so cleaners got
-- "new row violates row-level security policy for table job_assignments".
--
-- Allow a cleaner to create a job assigned to THEMSELVES (still blocks creating
-- jobs for other cleaners). Verified live with RLS-enforced impersonation.

drop policy if exists ja_ins on public.job_assignments;
create policy ja_ins on public.job_assignments for insert to authenticated
  with check (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
