-- Migration 006c — tables that existed in the original prod DB but were never
-- captured as migration files (the later RLS/index migrations 013/016/017 alter
-- them, and the app queries them, but nothing creates them). Reconstructed from
-- app usage in src/actions/invoices.ts, src/actions/portal.ts, src/lib/push.ts.
-- RLS is enabled here to match; policies are added by 013/016/017.

-- ── Invoices (uploaded cleaner invoices, parsed into lines) ──────────────────
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text,
  invoice_date    date,
  billing_month   date,                      -- first-of-month
  total_ex_gst    numeric(12,2),
  total_gst       numeric(12,2),
  total_incl_gst  numeric(12,2),
  notes           text,
  status          text not null default 'processed',
  created_at      timestamptz not null default now()
);

create table if not exists invoice_line_items (
  id               uuid primary key default gen_random_uuid(),
  invoice_id       uuid not null references invoices(id) on delete cascade,
  line_number      integer,
  description      text,
  client_name_raw  text,
  client_id        uuid references clients(id) on delete set null,
  hours            numeric(10,2),
  rate_per_hour    numeric(10,2),
  cost_ex_gst      numeric(12,2),
  gst              numeric(12,2),
  cost_incl_gst    numeric(12,2),
  match_status     text default 'unmatched', -- matched | unmatched | manual
  created_at       timestamptz not null default now()
);
create index if not exists invoice_line_items_invoice_id_idx on invoice_line_items (invoice_id);

-- ── Per-client, per-month P&L (income vs cleaner cost) ───────────────────────
create table if not exists client_monthly_financials (
  id                     uuid primary key default gen_random_uuid(),
  client_id              uuid not null references clients(id) on delete cascade,
  month                  date not null,             -- first-of-month
  invoice_id             uuid references invoices(id) on delete set null,
  service_count          integer,
  income_ex_gst          numeric(12,2),
  rate_per_visit         numeric(10,2),
  cleaner_hours          numeric(10,2),
  cleaner_rate_per_hour  numeric(10,2),
  cleaner_cost_ex_gst    numeric(12,2),
  cleaner_gst            numeric(12,2),
  cleaner_cost_incl_gst  numeric(12,2),
  profit                 numeric(12,2),
  margin_pct             numeric(6,2),
  expected_hours         numeric(10,2),
  expected_cost_ex_gst   numeric(12,2),
  hours_variance         numeric(10,2),
  cost_variance          numeric(12,2),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (client_id, month)                          -- required for the app's upsert onConflict
);

-- ── Client portal: feedback / issue reports ──────────────────────────────────
create table if not exists client_feedback (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references clients(id) on delete cascade,
  type            text,                              -- feedback | issue
  message         text,
  rating          integer,
  service_date    date,
  area            text,
  request_photos  boolean not null default false,
  resolved        boolean not null default false,
  created_at      timestamptz not null default now()
);

-- ── Client portal: requests for an additional service ────────────────────────
create table if not exists service_requests (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  service_name  text,
  frequency     text,
  notes         text,
  status        text not null default 'pending',
  created_at    timestamptz not null default now()
);

-- ── Web-push subscriptions (one per browser endpoint per user) ───────────────
create table if not exists push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  endpoint    text not null unique,                  -- app upserts onConflict: endpoint
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- Push subscriptions: no later migration adds a policy, so add a self-manage one
-- here (the subscribe route runs as the authenticated user, not service-role).
alter table push_subscriptions enable row level security;
do $$ begin
  create policy push_subscriptions_self on push_subscriptions
    for all to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
