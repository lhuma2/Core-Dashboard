-- Xero OAuth token storage (singleton — one row for the admin's connected Xero org)
create table if not exists xero_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tenant_name text,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Only one token record (singleton for admin)
create unique index if not exists xero_tokens_singleton on xero_tokens ((true));

-- Transactions you've approved for Core Cleaning P&L tracking
create table if not exists xero_approved_transactions (
  id uuid primary key default gen_random_uuid(),
  xero_id text not null unique,
  type text not null,        -- 'INCOME' | 'EXPENSE'
  contact text,
  description text,
  amount numeric(12,2) not null,
  date date,
  approved_at timestamptz default now()
);

create index if not exists idx_approved_tx_date on xero_approved_transactions (date);
create index if not exists idx_approved_tx_type on xero_approved_transactions (type);

-- Transactions explicitly ignored (personal spending, not Core Cleaning business)
create table if not exists xero_ignored_transactions (
  id uuid primary key default gen_random_uuid(),
  xero_id text not null unique,
  ignored_at timestamptz default now()
);
