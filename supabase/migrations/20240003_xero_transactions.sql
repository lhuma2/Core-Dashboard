create table if not exists xero_transactions (
  id uuid primary key default gen_random_uuid(),
  xero_id text unique not null,           -- Xero InvoiceID or BankTransactionID
  type text not null,                      -- 'income' | 'expense'
  contact text,                            -- supplier or client name
  description text,                        -- line item description or reference
  amount numeric(10,2) not null,
  currency text default 'AUD',
  date date,
  due_date date,
  xero_status text,                        -- AUTHORISED, PAID, DRAFT etc
  category text,                           -- account name from Xero
  approved boolean,                        -- NULL = pending, TRUE = approved, FALSE = rejected
  approved_at timestamptz,
  synced_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists xero_transactions_approved_idx on xero_transactions (approved);
create index if not exists xero_transactions_type_idx on xero_transactions (type);
create index if not exists xero_transactions_date_idx on xero_transactions (date desc);
