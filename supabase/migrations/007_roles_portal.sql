-- ─── Profiles (links auth.users to portal roles) ─────────────────────────────
create table if not exists profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null unique,
  role              text not null default 'cleaner'
                      check (role in ('admin','cleaner','manager','client')),
  full_name         text,
  linked_client_id  uuid references clients(id) on delete set null,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null
);

-- ─── Job Assignments ──────────────────────────────────────────────────────────
create table if not exists job_assignments (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references clients(id) on delete cascade not null,
  cleaner_id       uuid references profiles(id) on delete set null,
  scheduled_date   date not null,
  address          text,
  access_notes     text,          -- entry codes, alarm pins, etc.
  frequency_label  text,          -- display only e.g. "Weekly"
  checklist        jsonb not null default '[]'::jsonb,
                                  -- [{id, label, required}]
  status           text not null default 'not_started'
                     check (status in ('not_started','in_progress','completed','flagged')),
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

-- ─── Job Submissions ──────────────────────────────────────────────────────────
create table if not exists job_submissions (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid references job_assignments(id) on delete cascade not null unique,
  cleaner_id          uuid references profiles(id) on delete set null,
  photo_urls          jsonb not null default '[]'::jsonb,   -- array of storage URLs
  checklist_completed jsonb not null default '{}'::jsonb,   -- {item_id: boolean}
  notes               text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz default now() not null
);

-- ─── Job Flags (cleaner-reported) ─────────────────────────────────────────────
create table if not exists job_flags (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references job_assignments(id) on delete set null,
  cleaner_id   uuid references profiles(id) on delete set null,
  client_id    uuid references clients(id) on delete cascade,
  description  text not null,
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  resolved_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz default now() not null
);

-- ─── Client Issues (client-reported via portal) ───────────────────────────────
create table if not exists client_issues (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade not null,
  reported_by  uuid references profiles(id) on delete set null,
  description  text not null,
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  resolved_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz default now() not null
);

-- ─── Photo Requests (client portal) ──────────────────────────────────────────
create table if not exists photo_requests (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade not null,
  requested_by uuid references profiles(id) on delete set null,
  fulfilled    boolean not null default false,
  fulfilled_at timestamptz,
  created_at   timestamptz default now() not null
);

-- ─── Compliance Documents (SDS, insurance) ───────────────────────────────────
create table if not exists compliance_documents (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('sds','insurance','other')),
  file_url    text not null,
  client_id   uuid references clients(id) on delete cascade,  -- null = global
  created_at  timestamptz default now() not null
);

-- ─── Triggers ─────────────────────────────────────────────────────────────────
create trigger set_profiles_updated_at
  before update on profiles
  for each row execute procedure handle_updated_at();

create trigger set_job_assignments_updated_at
  before update on job_assignments
  for each row execute procedure handle_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table profiles             enable row level security;
alter table job_assignments      enable row level security;
alter table job_submissions      enable row level security;
alter table job_flags            enable row level security;
alter table client_issues        enable row level security;
alter table photo_requests       enable row level security;
alter table compliance_documents enable row level security;

create policy "portal_profiles_all"       on profiles             for all to authenticated using (true) with check (true);
create policy "portal_jobs_all"           on job_assignments      for all to authenticated using (true) with check (true);
create policy "portal_submissions_all"    on job_submissions      for all to authenticated using (true) with check (true);
create policy "portal_flags_all"          on job_flags            for all to authenticated using (true) with check (true);
create policy "portal_client_issues_all"  on client_issues        for all to authenticated using (true) with check (true);
create policy "portal_photo_requests_all" on photo_requests       for all to authenticated using (true) with check (true);
create policy "portal_compliance_all"     on compliance_documents for all to authenticated using (true) with check (true);

-- ─── Storage bucket for job photos ───────────────────────────────────────────
-- Run this manually in the Supabase dashboard or via CLI:
-- create bucket 'job-photos' with (public = false);
