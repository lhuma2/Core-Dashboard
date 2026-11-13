-- ============================================================
-- 066_cleaner_app.sql
-- New cleaner app and completion photos (see hub-rebuild/go-live-wiring.md: "Cleaner portal",
-- "Add-ons in the cleaner app (v63)", "Completion photos (v67)", "End of Lease answers (v75)").
--
-- * jobs           a row is made the moment a cleaner taps Start clean (one per home or service per day).
--                  New: service_id, ticks (the checklist), photo_count (recorded at Finish), note.
-- * clean_photos   one row per completion photo that reached storage. id = the photo id made on the phone,
--                  so a retried upload can never make a second row.
-- * clean-photos   private storage bucket for those photos (JPEG only, 5 MB cap). Phones upload straight to it
--                  with a one-time signed upload link from the server. The old public "job-photos" bucket is
--                  left alone, and so is the old job_photos table, so the live portal keeps working.
-- * profiles.password_set_at   set when a cleaner chooses their own password; until then the app asks for one.
--
-- Cleaners never write these tables directly: every write goes through the server, which checks the cleaner is
-- on that home or site first. Staff (admin/manager) can read and change everything. Safe to re-run; additive only.
-- ============================================================

-- ── jobs: link to the commercial service, keep the checklist and the photo count ──
alter table public.jobs add column if not exists service_id  uuid references public.client_services(id) on delete cascade;
alter table public.jobs add column if not exists ticks       jsonb not null default '{}'::jsonb;
alter table public.jobs add column if not exists photo_count smallint not null default 0 check (photo_count between 0 and 40);
alter table public.jobs add column if not exists note        text check (note is null or length(note) <= 2000);
create unique index if not exists jobs_home_day    on public.jobs (home_id, clean_date)    where home_id is not null;
create unique index if not exists jobs_service_day on public.jobs (service_id, clean_date) where service_id is not null;

-- ── completion photos ────────────────────────────────────────
create table if not exists public.clean_photos (
  id          uuid primary key,                                     -- made on the phone when the photo is taken
  job_id      uuid not null references public.jobs(id) on delete cascade,
  cleaner_id  uuid references public.profiles(id) on delete set null,
  client_id   uuid references public.clients(id) on delete cascade,
  home_id     uuid references public.homes(id) on delete cascade,
  kind        text not null check (kind in ('commercial','residential','eol')),
  clean_date  date not null,
  taken_at    timestamptz,
  path        text not null unique check (length(path) between 10 and 300),
  uploaded_at timestamptz not null default now()
);
create index if not exists clean_photos_job_idx  on public.clean_photos (job_id);
create index if not exists clean_photos_home_idx on public.clean_photos (home_id, clean_date);
create index if not exists clean_photos_client_idx on public.clean_photos (client_id, clean_date);
create index if not exists clean_photos_date_idx on public.clean_photos (clean_date);

alter table public.clean_photos enable row level security;
drop policy if exists staff_all on public.clean_photos;
create policy staff_all on public.clean_photos for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

-- ── first login: choose your own password ────────────────────
alter table public.profiles add column if not exists password_set_at timestamptz;

-- ── private bucket for the photos ────────────────────────────
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('clean-photos', 'clean-photos', false, 5242880, array['image/jpeg'])
    on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg'];
  end if;
end $$;
