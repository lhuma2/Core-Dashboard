-- Migration 031 — single subcontractor company onboarding record.
-- Already applied to prod via connector.
create table if not exists public.subcontractors (
  id               uuid primary key default gen_random_uuid(),
  company_name     text,
  abn              text,
  contact_name     text,
  contact_email    text,
  contact_phone    text,
  insurance_expiry date,
  insurance_url    text,
  sign_code        text unique,
  signed_name      text,
  signed_at        timestamptz,
  signed_ip        text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Accessed only via the server-side service role (deny-all to clients).
alter table public.subcontractors enable row level security;
