-- 069: Team → Add cleaner and the subcontractor compliance pack (new hub).
-- Safe to re-run. Additive only: the live portal keeps working.
--   * cleaner_packs: one row for each cleaner who was sent the pack. Until they sign, the row is the cleaner on the
--     Team page ("Pack not signed"). When they sign, their cleaner login is made, profile_id points at it and the
--     details they gave (ABN, insurance, signature) stay here for the signed pack.
--   * The 12 cleaners already on the team signed the old pack; update 063 marked them signed (profiles.pack_signed_at).
-- The public signing page reads and writes through the server with its private link; no public policies.

create table if not exists public.cleaner_packs (
  id              uuid primary key default gen_random_uuid(),
  token           text not null unique,
  profile_id      uuid references public.profiles(id) on delete set null,
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  phone           text,
  region          text check (region is null or region in ('north','south','ipswich','gold_coast')),
  is_team_leader  boolean not null default false,
  sent_at         timestamptz not null default now(),
  company         text,
  abn             text,
  contact         text,
  contact_phone   text,
  insurer         text,
  policy          text,
  expiry          date,
  cert_path       text,
  signed_name     text,
  signed_at       timestamptz,
  signed_ip       text,
  created_at      timestamptz not null default now()
);
create unique index if not exists cleaner_packs_email_idx on public.cleaner_packs (lower(email));
alter table public.cleaner_packs enable row level security;
drop policy if exists staff_all on public.cleaner_packs;
create policy staff_all on public.cleaner_packs for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
