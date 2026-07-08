-- ─── Real-time clean tracking: timer + before/after photos ──────────────────
-- job_assignments already tracks status; add explicit started_at/finished_at
-- so duration can be read straight off the job row (job_submissions keeps its
-- own started_at/completed_at for backward compatibility — not removed).
alter table job_assignments add column if not exists started_at  timestamptz;
alter table job_assignments add column if not exists finished_at timestamptz;

-- ─── Job Photos (before/after, tagged) ────────────────────────────────────────
create table if not exists job_photos (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references job_assignments(id) on delete cascade not null,
  phase        text not null check (phase in ('before','after')),
  storage_path text not null,
  uploaded_by  uuid references profiles(id) on delete set null,
  uploaded_at  timestamptz default now() not null
);

create index if not exists job_photos_job_idx on job_photos (job_id, phase);

alter table job_photos enable row level security;

-- Matches the permissive "authenticated" pattern already used across the
-- portal tables (job_assignments, job_submissions, ...) — authorization is
-- enforced in the server actions (cleaner_id checks), not per-row RLS here.
create policy "portal_job_photos_all" on job_photos for all to authenticated using (true) with check (true);
