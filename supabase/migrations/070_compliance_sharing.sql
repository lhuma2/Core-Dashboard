-- 070: Compliance pack sharing (new hub).
-- Safe to re-run. Additive only: the live portal keeps working.
--   * compliance_sets: quick sets Laith saves (a name and the documents in it).
--   * compliance_links: a share link (corecleaning link /d/<code>) and the documents it shows. The public page reads
--     it through the server with the code; no public policies.

create table if not exists public.compliance_sets (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 60),
  doc_ids     text[] not null default '{}',
  created_at  timestamptz not null default now()
);
alter table public.compliance_sets enable row level security;
drop policy if exists staff_all on public.compliance_sets;
create policy staff_all on public.compliance_sets for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

create table if not exists public.compliance_links (
  code        text primary key,
  doc_ids     text[] not null,
  created_at  timestamptz not null default now()
);
alter table public.compliance_links enable row level security;
drop policy if exists staff_all on public.compliance_links;
create policy staff_all on public.compliance_links for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
