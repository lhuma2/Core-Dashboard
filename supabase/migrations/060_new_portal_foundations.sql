-- ============================================================
-- 060_new_portal_foundations.sql
-- New portal, step 1: shared foundations (see hub-rebuild/go-live-wiring.md, "Shared foundations").
--
-- * homes          residential and End of Lease clients (the old hub kept these as loose rows in
--                  residential_jobs / bond_jobs; those tables stay untouched until switch-over).
-- * home_history   the dated history list on each home's page.
-- * jobs           ONE job model for every clean: type = commercial | residential | eol.
-- * job_cleaners   which cleaners are on a job (commercial sites can have more than one).
-- * client_surveys commercial client surveys (1-10 x 5, notes), sent only when Laith presses Send.
--
-- Row-level security: admin and manager see everything; a cleaner sees only the jobs they are on,
-- and only the homes / commercial clients those jobs belong to. Nothing here is readable by anon.
-- Safe to re-run (if not exists / drop-if-exists). Additive only: no existing table or policy is changed, so the live portal keeps working.
-- ============================================================

-- ── homes ────────────────────────────────────────────────────
create table if not exists public.homes (
  id             uuid primary key default gen_random_uuid(),
  division       text not null default 'res' check (division in ('res','eol')),
  name           text not null,
  phone          text,
  email          text,
  street         text,
  suburb         text,
  state          text not null default 'QLD',
  postcode       text check (postcode is null or postcode ~ '^[0-9]{4}$'),
  kind           text not null default 'recurring' check (kind in ('recurring','oneoff')),
  every          text check (every is null or every in ('weekly','fortnightly','monthly')),
  days           text[] not null default '{}',
  anchor         date,
  first_clean    date,
  start_time     time,
  finish_time    time,
  price          numeric(10,2) not null default 0 check (price >= 0),   -- per clean, incl GST
  cost           numeric(10,2) not null default 0 check (cost >= 0),    -- cleaner pay per clean
  cleaner_id     uuid references public.profiles(id) on delete set null,
  beds           smallint check (beds between 0 and 12),
  baths          smallint check (baths between 0 and 12),
  carpet_rooms   smallint not null default 0 check (carpet_rooms between 0 and 40),
  hallways       smallint not null default 0 check (hallways between 0 and 20),
  notes          text,
  status         text not null default 'active' check (status in ('active','paused','ended')),
  paused_from    date,
  resume_on      date,
  ended_on       date,
  done           boolean not null default false,
  cancelled      boolean not null default false,
  old_hub_id     uuid unique,                          -- residential_jobs.id it was moved from
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint homes_recurring_has_every check (kind = 'oneoff' or every is not null),
  constraint homes_days_valid check (days <@ array['mon','tue','wed','thu','fri','sat','sun']::text[])
);
create index if not exists homes_division_idx on public.homes (division, status);
create index if not exists homes_cleaner_idx on public.homes (cleaner_id);
drop trigger if exists set_homes_updated_at on public.homes;
create trigger set_homes_updated_at before update on public.homes for each row execute procedure handle_updated_at();

create table if not exists public.home_history (
  id         uuid primary key default gen_random_uuid(),
  home_id    uuid not null references public.homes(id) on delete cascade,
  date       date not null,
  text       text not null check (length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists home_history_home_idx on public.home_history (home_id, date);

-- ── jobs (one model for every clean) ─────────────────────────
create table if not exists public.jobs (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in ('commercial','residential','eol')),
  client_id      uuid references public.clients(id) on delete cascade,   -- commercial
  site_name      text,                                                   -- commercial site, if more than one
  home_id        uuid references public.homes(id) on delete cascade,     -- residential / eol
  clean_date     date not null,
  start_time     time,
  finish_time    time,
  label          text,                                                   -- e.g. "Extra clean · Building B"
  status         text not null default 'booked' check (status in ('booked','in_progress','done','missed','cancelled')),
  started_at     timestamptz,
  finished_at    timestamptz,
  photos_needed  smallint not null default 3 check (photos_needed between 0 and 40),
  photo_ack      boolean not null default false,   -- "Having trouble uploading?" ticked by the cleaner
  request_id     uuid,                             -- client request it was booked from, if any
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint jobs_owner check (
    (type = 'commercial' and client_id is not null and home_id is null) or
    (type in ('residential','eol') and home_id is not null and client_id is null)
  )
);
create index if not exists jobs_date_idx on public.jobs (clean_date);
create index if not exists jobs_client_idx on public.jobs (client_id, clean_date);
create index if not exists jobs_home_idx on public.jobs (home_id, clean_date);
drop trigger if exists set_jobs_updated_at on public.jobs;
create trigger set_jobs_updated_at before update on public.jobs for each row execute procedure handle_updated_at();

create table if not exists public.job_cleaners (
  job_id     uuid not null references public.jobs(id) on delete cascade,
  cleaner_id uuid not null references public.profiles(id) on delete cascade,
  primary key (job_id, cleaner_id)
);
create index if not exists job_cleaners_cleaner_idx on public.job_cleaners (cleaner_id);

-- ── commercial client surveys ────────────────────────────────
alter table public.clients add column if not exists surveys_off boolean not null default false;
alter table public.clients add column if not exists survey_snooze_until date;

create table if not exists public.client_surveys (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  token        text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),  -- 64 hex chars, unguessable
  sent_at      date not null default current_date,
  sent_to      text not null,
  reminded_at  date,
  answered_at  date,
  comm         smallint check (comm between 1 and 10),
  qual         smallint check (qual between 1 and 10),
  rel          smallint check (rel between 1 and 10),
  value        smallint check (value between 1 and 10),
  rec          smallint check (rec between 1 and 10),
  notes        text check (notes is null or length(notes) <= 1000),
  followed_at  date,
  follow_note  text check (follow_note is null or length(follow_note) <= 1000),
  created_at   timestamptz not null default now(),
  constraint client_surveys_all_or_none check (
    (answered_at is null and comm is null and qual is null and rel is null and value is null and rec is null) or
    (answered_at is not null and comm is not null and qual is not null and rel is not null and value is not null and rec is not null)
  ),
  constraint client_surveys_follow_needs_note check (followed_at is null or length(coalesce(follow_note,'')) >= 2)
);
-- at most one unanswered survey per client
create unique index if not exists client_surveys_one_waiting on public.client_surveys (client_id) where answered_at is null;

-- ── row-level security ───────────────────────────────────────
alter table public.homes          enable row level security;
alter table public.home_history   enable row level security;
alter table public.jobs           enable row level security;
alter table public.job_cleaners   enable row level security;
alter table public.client_surveys enable row level security;

-- is the signed-in cleaner on this job? (security definer: no recursion through job_cleaners RLS)
create or replace function public.app_on_job(j uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp
  as $$ select exists (select 1 from public.job_cleaners jc where jc.job_id = j and jc.cleaner_id = public.app_profile_id()) $$;
create or replace function public.app_on_home(h uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp
  as $$ select exists (select 1 from public.jobs jb join public.job_cleaners jc on jc.job_id = jb.id
                       where jb.home_id = h and jc.cleaner_id = public.app_profile_id()) $$;
revoke all on function public.app_on_job(uuid)  from public, anon;
revoke all on function public.app_on_home(uuid) from public, anon;
grant execute on function public.app_on_job(uuid)  to authenticated;
grant execute on function public.app_on_home(uuid) to authenticated;

-- admin / manager: everything
drop policy if exists staff_all on public.homes;
create policy staff_all on public.homes          for all to authenticated using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
drop policy if exists staff_all on public.home_history;
create policy staff_all on public.home_history   for all to authenticated using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
drop policy if exists staff_all on public.jobs;
create policy staff_all on public.jobs           for all to authenticated using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
drop policy if exists staff_all on public.job_cleaners;
create policy staff_all on public.job_cleaners   for all to authenticated using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
drop policy if exists staff_all on public.client_surveys;
create policy staff_all on public.client_surveys for all to authenticated using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

-- cleaners: read only their own jobs and the homes those jobs are at
drop policy if exists cleaner_own_jobs on public.jobs;
create policy cleaner_own_jobs on public.jobs         for select to authenticated using (public.app_user_role() = 'cleaner' and public.app_on_job(id));
drop policy if exists cleaner_own_rows on public.job_cleaners;
create policy cleaner_own_rows on public.job_cleaners for select to authenticated using (public.app_user_role() = 'cleaner' and cleaner_id = public.app_profile_id());
drop policy if exists cleaner_own_homes on public.homes;
create policy cleaner_own_homes on public.homes        for select to authenticated using (public.app_user_role() = 'cleaner' and public.app_on_home(id));
-- Starting / finishing a clean goes through a server action (service role) that checks the cleaner is on
-- the job, so cleaners get no direct update rights. Client surveys are answered through the public token
-- page, also server-side; clients and cleaners never read client_surveys directly.
