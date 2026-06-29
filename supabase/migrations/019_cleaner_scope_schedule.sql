-- Migration 019 — Cleaner-facing scope-of-works schedule.
-- Structured scope is the single source of truth (per the design handoff).

alter table public.clients
  add column if not exists scope jsonb not null default '[]'::jsonb,
  add column if not exists clean_days text[] not null default '{}'::text[];

create table if not exists public.schedule_completions (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  task_id     text not null,
  clean_date  date not null,
  done        boolean not null default true,
  cleaner_id  uuid references public.profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (client_id, task_id, clean_date)
);
create index if not exists schedule_completions_client_date_idx
  on public.schedule_completions (client_id, clean_date);

alter table public.schedule_completions enable row level security;

create policy sc_select on public.schedule_completions for select to authenticated using (
  app_user_role() in ('admin','manager')
  or client_id in (select client_id from public.job_assignments where cleaner_id = app_profile_id()));
create policy sc_ins on public.schedule_completions for insert to authenticated
  with check (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy sc_upd on public.schedule_completions for update to authenticated
  using (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id())
  with check (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy sc_del on public.schedule_completions for delete to authenticated
  using (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
