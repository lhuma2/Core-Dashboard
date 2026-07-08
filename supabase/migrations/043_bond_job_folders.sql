-- ─── Bond Client folders (organizational grouping only) ──────────────────────
-- Purely for grouping/filtering bond cleans in the admin UI — does not affect
-- scheduling, assignment, or any other behaviour.
create table if not exists bond_job_folders (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now() not null
);

alter table bond_jobs add column if not exists folder_id uuid references bond_job_folders(id) on delete set null;

create index if not exists bond_jobs_folder_idx on bond_jobs (folder_id);

alter table bond_job_folders enable row level security;

create policy "portal_bond_job_folders_all" on bond_job_folders for all to authenticated using (true) with check (true);
