-- ─── Residential Clients (standalone home cleans) ────────────────────────────
-- Mirrors bond_jobs exactly — a separate, non-commercial job type with its own
-- table, full real-time tracking (status/started_at/finished_at), and the same
-- bed/bath + carpet steam cleaning counts.
create table if not exists residential_jobs (
  id                      uuid primary key default gen_random_uuid(),
  client_name             text not null,
  address                 text not null,
  contact_phone           text,
  clean_date              date not null,
  clean_time              time,
  comments                text,
  cleaner_id              uuid references profiles(id) on delete set null,
  created_by              uuid references profiles(id) on delete set null,
  status                  text not null default 'not_started'
                            check (status in ('not_started','in_progress','completed')),
  started_at              timestamptz,
  finished_at             timestamptz,
  bedrooms                smallint check (bedrooms between 0 and 7),
  bathrooms               smallint check (bathrooms between 0 and 7),
  carpet_steam_rooms      smallint check (carpet_steam_rooms between 0 and 7),
  carpet_steam_hallways   smallint check (carpet_steam_hallways between 0 and 7),
  created_at              timestamptz default now() not null,
  updated_at              timestamptz default now() not null
);

create index if not exists residential_jobs_cleaner_date_idx on residential_jobs (cleaner_id, clean_date);

create trigger set_residential_jobs_updated_at
  before update on residential_jobs
  for each row execute procedure handle_updated_at();

alter table residential_jobs enable row level security;

create policy "portal_residential_jobs_all" on residential_jobs for all to authenticated using (true) with check (true);

-- job_photos.job_kind's check constraint needs to allow this third kind too.
-- Find and drop whatever it's actually named (it was added inline via
-- ADD COLUMN ... CHECK in migration 042, so the exact auto-generated name
-- shouldn't be assumed) rather than guessing the constraint name.
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'job_photos'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%job_kind%'
  loop
    execute format('alter table job_photos drop constraint %I', con.conname);
  end loop;
end $$;

alter table job_photos add constraint job_photos_job_kind_check
  check (job_kind in ('job_assignment','bond_job','residential_job'));
