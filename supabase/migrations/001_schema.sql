-- Delta Operations Hub — Initial Schema
-- Run this migration against your Supabase project

-- Enums
create type service_type as enum (
  'general_cleaning', 'pressure_washing', 'window_cleaning', 'floor_care', 'hygiene_bins'
);

create type frequency_type as enum (
  'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annual', 'one_off'
);

create type document_type as enum (
  'proposal', 'cleaning_agreement', 'specialist_agreement'
);

create type document_status as enum (
  'draft', 'sent', 'signed', 'expired', 'cancelled'
);

-- Reference number sequence
create sequence ref_number_seq start 1000;

-- Clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  ref_number text unique default 'DC-' || nextval('ref_number_seq'),
  business_name text not null,
  contact_name text,
  contact_email text,
  contact_phone text,
  address text,
  suburb text,
  state text default 'QLD',
  postcode text,
  service_type service_type[],
  frequency frequency_type,
  rate_per_visit numeric(10,2),
  monthly_value numeric(10,2),
  annual_value numeric(10,2),
  start_date date,
  active boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  ref_number text unique default 'DOC-' || nextval('ref_number_seq'),
  client_id uuid references clients(id) on delete cascade,
  document_type document_type not null,
  status document_status default 'draft',
  title text,
  content jsonb,
  parent_id uuid references documents(id),
  version integer default 1,
  sent_at timestamptz,
  signed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Financial records
create table financial_records (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  record_date date not null,
  amount numeric(10,2) not null,
  type text check (type in ('income', 'expense')),
  category text,
  description text,
  created_at timestamptz default now()
);

-- SOPs
create table sops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  content text,
  version integer default 1,
  active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Surveys
create table surveys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  submitted_at timestamptz default now(),
  quality_score integer check (quality_score between 0 and 10),
  reliability_score integer check (reliability_score between 0 and 10),
  communication_score integer check (communication_score between 0 and 10),
  value_score integer check (value_score between 0 and 10),
  comments text
);

-- updated_at triggers
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at
  before update on clients
  for each row execute function handle_updated_at();

create trigger documents_updated_at
  before update on documents
  for each row execute function handle_updated_at();

create trigger sops_updated_at
  before update on sops
  for each row execute function handle_updated_at();
