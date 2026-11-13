-- 067: Commercial client page (new hub).
-- Safe to re-run. Additive only: the live portal keeps working.
--   * client_history: the dated log under Client status (paused, ended, resumed, reactivated).
--   * clients.status_reason: why a client is paused or ended, shown in the banner.
--   * client_addons.items: the task list for an additional service, edited when it's added.
--     Empty means the cleaner app uses Laith's standard list for that service.

create table if not exists public.client_history (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  date       date not null,
  text       text not null check (length(text) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists client_history_client_idx on public.client_history (client_id, date);
alter table public.client_history enable row level security;
drop policy if exists staff_all on public.client_history;
create policy staff_all on public.client_history for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

alter table public.clients add column if not exists status_reason text;
alter table public.client_addons add column if not exists items text[] not null default '{}';
