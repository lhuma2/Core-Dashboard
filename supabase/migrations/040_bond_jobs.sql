-- ─── Bond Clients (one-off end-of-lease cleans) ──────────────────────────────
-- Separate from `clients` / `job_assignments` on purpose: bond cleans are
-- one-off jobs for people who are not ongoing commercial clients, so they get
-- their own table rather than a row in `clients`. The cleaner timetable reads
-- from this table in addition to `job_assignments`.
create table if not exists bond_jobs (
  id              uuid primary key default gen_random_uuid(),
  client_name     text not null,
  address         text not null,
  contact_phone   text,
  clean_date      date not null,
  clean_time      time,
  comments        text,
  cleaner_id      uuid references profiles(id) on delete set null,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

create index if not exists bond_jobs_cleaner_date_idx on bond_jobs (cleaner_id, clean_date);

create trigger set_bond_jobs_updated_at
  before update on bond_jobs
  for each row execute procedure handle_updated_at();

alter table bond_jobs enable row level security;

create policy "portal_bond_jobs_all" on bond_jobs for all to authenticated using (true) with check (true);
