-- ─── Extend real-time clean tracking to Bond Clients ─────────────────────────
-- Bond cleans live in their own table (bond_jobs), separate from
-- job_assignments, so they need their own status/timer columns.
alter table bond_jobs add column if not exists status text not null default 'not_started'
  check (status in ('not_started','in_progress','completed'));
alter table bond_jobs add column if not exists started_at  timestamptz;
alter table bond_jobs add column if not exists finished_at timestamptz;

-- job_photos was created referencing job_assignments only. To let it also
-- tag photos against a bond_jobs row, drop the hard FK (job_id can now point
-- at either table) and record which table it belongs to.
alter table job_photos drop constraint if exists job_photos_job_id_fkey;
alter table job_photos add column if not exists job_kind text not null default 'job_assignment'
  check (job_kind in ('job_assignment','bond_job'));

create index if not exists job_photos_kind_idx on job_photos (job_kind, job_id);
