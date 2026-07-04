-- QA site inspections. Written and read via the service-role admin client
-- (admin routes are auth-gated; the client portal reads only its own shared
-- inspections through an admin-scoped query). RLS on + no policy = deny to
-- anon/authenticated, consistent with the rest of the app's admin-only tables.

create table if not exists public.inspections (
  id                 uuid primary key default gen_random_uuid(),
  client_id          uuid references public.clients(id) on delete cascade,
  site_id            uuid references public.client_sites(id) on delete set null,
  site_label         text,
  inspector          text,
  status             text not null default 'completed',
  score              int,
  areas              jsonb not null default '[]'::jsonb,
  rectifications     jsonb not null default '[]'::jsonb,
  notes              text,
  shared_with_client boolean not null default false,
  inspected_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists inspections_client_idx on public.inspections (client_id, inspected_at desc);
create index if not exists inspections_shared_idx on public.inspections (client_id, shared_with_client, inspected_at desc);

alter table public.inspections enable row level security;
