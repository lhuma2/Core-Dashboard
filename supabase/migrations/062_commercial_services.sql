-- ============================================================
-- 062_commercial_services.sql
-- New portal, step 2: what the Dashboard and Commercial screens read (see hub-rebuild/go-live-wiring.md,
-- "Dashboard Commercial card from real clients (v57)", "New client form", "Client status", "Problems reported").
--
-- * clients.status / paused_from / resume_on / ended_on   pause, end and resume a commercial client.
-- * client_services          one row per site: cleaning days, how often, times, price and cleaner cost per clean (ex GST).
-- * client_service_cleaners  which cleaners clean that site.
-- * client_addons            add-on services on a site (windows monthly, etc.) with their own frequency.
-- * issues                   problems cleaners report from a clean (the dashboard's "Problems reported").
--
-- Row-level security: admin and manager see everything. A cleaner reads only the services they are on
-- (that is how they get the site's access details) and the add-ons of those services, and can read and
-- add their own problem reports. Nothing is readable by anon.
-- Safe to re-run. Additive only: no existing column, table or policy changes, so the live portal keeps working.
-- The one widened rule: a cleaner's region may now also be north / south / ipswich (the new Team regions);
-- the old values brisbane and gold_coast stay valid, so the old hub's region picker still saves.
-- ============================================================

-- ── client status ────────────────────────────────────────────
alter table public.clients add column if not exists status text not null default 'active';
alter table public.clients add column if not exists paused_from date;
alter table public.clients add column if not exists resume_on date;
alter table public.clients add column if not exists ended_on date;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'clients_status_valid') then
    alter table public.clients add constraint clients_status_valid check (status in ('active','paused','ended'));
  end if;
end $$;
-- Clients the old hub had switched off count as ended (only on the first run, while ended_on is still empty).
update public.clients set status = 'ended' where active = false and status = 'active' and ended_on is null;

-- ── cleaner regions (North Brisbane, South Brisbane, Ipswich, Gold Coast; old 'brisbane' = still to sort) ──
alter table public.profiles drop constraint if exists profiles_region_check;
alter table public.profiles add constraint profiles_region_check
  check (region is null or region in ('north','south','ipswich','gold_coast','brisbane'));

-- ── services (one per site) ──────────────────────────────────
create table if not exists public.client_services (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  site_id      uuid references public.client_sites(id) on delete cascade,   -- null for a single-site client
  sort_order   smallint not null default 0,
  days         text[] not null default '{}',
  every        text not null default 'weekly' check (every in ('weekly','fortnightly','monthly')),
  anchor       date,                    -- pattern date for fortnightly / monthly
  first_clean  date,
  start_time   time,
  finish_time  time,
  price        numeric(10,2) not null default 0 check (price >= 0),   -- per clean, ex GST
  cost         numeric(10,2) not null default 0 check (cost >= 0),    -- cleaner pay per clean
  access       text check (access is null or length(access) <= 2000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint client_services_days_valid check (days <@ array['mon','tue','wed','thu','fri','sat','sun']::text[]),
  constraint client_services_monthly_one_day check (every <> 'monthly' or cardinality(days) <= 1),
  constraint client_services_finish_after_start check (start_time is null or finish_time is null or finish_time > start_time)
);
create index if not exists client_services_client_idx on public.client_services (client_id, sort_order);
create unique index if not exists client_services_one_per_site on public.client_services (site_id) where site_id is not null;
drop trigger if exists set_client_services_updated_at on public.client_services;
create trigger set_client_services_updated_at before update on public.client_services for each row execute procedure handle_updated_at();

create table if not exists public.client_service_cleaners (
  service_id uuid not null references public.client_services(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete cascade,
  primary key (service_id, cleaner_id)
);
create index if not exists client_service_cleaners_cleaner_idx on public.client_service_cleaners (cleaner_id);

create table if not exists public.client_addons (
  id          uuid primary key default gen_random_uuid(),
  service_id  uuid not null references public.client_services(id) on delete cascade,
  name        text not null check (length(name) between 1 and 200),
  freq        text not null check (freq in ('once','weekly','fortnightly','monthly','quarterly','six_monthly','yearly')),
  price       numeric(10,2) not null default 0 check (price >= 0),   -- per time, ex GST
  cost        numeric(10,2) not null default 0 check (cost >= 0),
  next_date   date,
  created_at  timestamptz not null default now()
);
create index if not exists client_addons_service_idx on public.client_addons (service_id);

-- ── problems reported ────────────────────────────────────────
create table if not exists public.issues (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references public.jobs(id) on delete set null,
  client_id    uuid references public.clients(id) on delete cascade,
  site_id      uuid references public.client_sites(id) on delete set null,
  home_id      uuid references public.homes(id) on delete cascade,
  cleaner_id   uuid references public.profiles(id) on delete set null,
  body         text not null check (length(body) between 2 and 2000),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles(id) on delete set null
);
create index if not exists issues_open_idx on public.issues (resolved_at, created_at desc);

-- ── row-level security ───────────────────────────────────────
alter table public.client_services         enable row level security;
alter table public.client_service_cleaners enable row level security;
alter table public.client_addons           enable row level security;
alter table public.issues                  enable row level security;

create or replace function public.app_on_service(s uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp
  as $$ select exists (select 1 from public.client_service_cleaners sc where sc.service_id = s and sc.cleaner_id = public.app_profile_id()) $$;
revoke all on function public.app_on_service(uuid) from public, anon;
grant execute on function public.app_on_service(uuid) to authenticated;

drop policy if exists staff_all on public.client_services;
create policy staff_all on public.client_services         for all to authenticated using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
drop policy if exists staff_all on public.client_service_cleaners;
create policy staff_all on public.client_service_cleaners for all to authenticated using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
drop policy if exists staff_all on public.client_addons;
create policy staff_all on public.client_addons           for all to authenticated using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
drop policy if exists staff_all on public.issues;
create policy staff_all on public.issues                  for all to authenticated using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

drop policy if exists cleaner_own_services on public.client_services;
create policy cleaner_own_services on public.client_services for select to authenticated
  using (public.app_user_role() = 'cleaner' and public.app_on_service(id));
drop policy if exists cleaner_own_rows on public.client_service_cleaners;
create policy cleaner_own_rows on public.client_service_cleaners for select to authenticated
  using (public.app_user_role() = 'cleaner' and cleaner_id = public.app_profile_id());
drop policy if exists cleaner_own_addons on public.client_addons;
create policy cleaner_own_addons on public.client_addons for select to authenticated
  using (public.app_user_role() = 'cleaner' and public.app_on_service(service_id));
drop policy if exists cleaner_own_issues on public.issues;
create policy cleaner_own_issues on public.issues for select to authenticated
  using (public.app_user_role() = 'cleaner' and cleaner_id = public.app_profile_id());
drop policy if exists cleaner_report_issue on public.issues;
create policy cleaner_report_issue on public.issues for insert to authenticated
  with check (public.app_user_role() = 'cleaner' and cleaner_id = public.app_profile_id() and resolved_at is null and resolved_by is null);
