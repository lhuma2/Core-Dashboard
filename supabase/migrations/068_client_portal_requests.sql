-- 068: Client portal and client requests (new hub).
-- Safe to re-run. Additive only: the live portal keeps working.
--   * profiles.first_login_at: the client's welcome page shows until their first login is done.
--   * jobs.finished_by: who finished a clean, so the client portal can say "Finished 8:26pm · Angela".
--   * client_requests: what a client sends from the Requests tab, with Laith's reply and status.
--   * one_offs: an extra clean booked from a request. It runs as that site's clean on that day.
--   * issues.from_client / request_id: "Something wasn't right" from the portal goes into Problems reported.
-- The portal reads and writes through the server, which checks the signed-in client; no client-side policies.

alter table public.profiles add column if not exists first_login_at timestamptz;
alter table public.jobs add column if not exists finished_by uuid references public.profiles(id) on delete set null;

create table if not exists public.client_requests (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  sent_by      uuid references public.profiles(id) on delete set null,
  kind         text not null check (kind in ('photos','quote','extra','change','supplies','access','problem','other')),
  site_id      uuid references public.client_sites(id) on delete set null,
  all_sites    boolean not null default false,
  service      text,
  job_id       uuid references public.jobs(id) on delete set null,
  clean_label  text,
  want_date    date,
  details      text not null default '' check (length(details) <= 2000),
  status       text not null default 'new' check (status in ('new','replied','done')),
  reply        text check (length(reply) <= 2000),
  replied_at   timestamptz,
  done_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists client_requests_client_idx on public.client_requests (client_id, created_at desc);
alter table public.client_requests enable row level security;
drop policy if exists staff_all on public.client_requests;
create policy staff_all on public.client_requests for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

create table if not exists public.one_offs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  service_id  uuid not null references public.client_services(id) on delete cascade,
  request_id  uuid references public.client_requests(id) on delete set null,
  clean_date  date not null,
  start_time  time not null,
  finish_time time,
  price       numeric not null default 0,
  cost        numeric not null default 0,
  note        text,
  created_at  timestamptz not null default now(),
  unique (service_id, clean_date)
);
alter table public.one_offs enable row level security;
drop policy if exists staff_all on public.one_offs;
create policy staff_all on public.one_offs for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

alter table public.issues add column if not exists from_client boolean not null default false;
alter table public.issues add column if not exists request_id uuid references public.client_requests(id) on delete set null;
