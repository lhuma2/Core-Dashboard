-- ============================================================
-- CLEAN SLATE — reset the public schema, then restore Supabase's
-- default privileges. Safe on a brand-new project. Run before the
-- migration chain so a partial/failed prior run doesn't cause
-- "already exists" errors.
-- ============================================================
drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

-- ============================================================
-- 001_schema.sql
-- ============================================================
-- Core Cleaning Operations Hub — Initial Schema
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
  ref_number text unique default 'CC-' || nextval('ref_number_seq'),
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

-- ============================================================
-- 002_rls.sql
-- ============================================================
-- Core Cleaning Operations Hub — Row Level Security
-- Single-tenant internal tool: all authenticated users have full access

-- Enable RLS on all tables
alter table clients enable row level security;
alter table documents enable row level security;
alter table financial_records enable row level security;
alter table sops enable row level security;
alter table surveys enable row level security;

-- Clients policies
create policy "clients_select" on clients for select to authenticated using (true);
create policy "clients_insert" on clients for insert to authenticated with check (true);
create policy "clients_update" on clients for update to authenticated using (true);
create policy "clients_delete" on clients for delete to authenticated using (true);

-- Documents policies
create policy "documents_select" on documents for select to authenticated using (true);
create policy "documents_insert" on documents for insert to authenticated with check (true);
create policy "documents_update" on documents for update to authenticated using (true);
create policy "documents_delete" on documents for delete to authenticated using (true);

-- Financial records policies
create policy "financial_records_select" on financial_records for select to authenticated using (true);
create policy "financial_records_insert" on financial_records for insert to authenticated with check (true);
create policy "financial_records_update" on financial_records for update to authenticated using (true);
create policy "financial_records_delete" on financial_records for delete to authenticated using (true);

-- SOPs policies
create policy "sops_select" on sops for select to authenticated using (true);
create policy "sops_insert" on sops for insert to authenticated with check (true);
create policy "sops_update" on sops for update to authenticated using (true);
create policy "sops_delete" on sops for delete to authenticated using (true);

-- Surveys policies
create policy "surveys_select" on surveys for select to authenticated using (true);
create policy "surveys_insert" on surveys for insert to authenticated with check (true);
create policy "surveys_update" on surveys for update to authenticated using (true);
create policy "surveys_delete" on surveys for delete to authenticated using (true);

-- ============================================================
-- 004_cleaner_costs_email.sql
-- ============================================================
-- Add cleaner cost tracking to clients
alter table clients
  add column if not exists cleaner_hourly_rate numeric(10,2),
  add column if not exists cleaner_hours_per_visit numeric(5,2);

-- Email templates
create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  subject text not null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Email log
create table if not exists emails_sent (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,
  template_id uuid references email_templates(id) on delete set null,
  to_email text not null,
  to_name text,
  subject text not null,
  body text not null,
  sent_at timestamptz default now(),
  status text default 'sent'
);

-- RLS
alter table email_templates enable row level security;
alter table emails_sent enable row level security;

create policy "auth_all_email_templates" on email_templates for all to authenticated using (true) with check (true);
create policy "auth_all_emails_sent" on emails_sent for all to authenticated using (true) with check (true);

-- Seed default email templates
insert into email_templates (name, type, subject, body) values
('Proposal Follow-Up', 'proposal_followup', 'Following up — Commercial Cleaning Proposal', 'Hi {{contact_name}},

I wanted to follow up on the proposal I sent through for {{business_name}}.

I''m happy to answer any questions, walk you through the scope again, or adjust anything to better suit your needs.

The proposal is valid for 30 days from the date of issue. If you''d like to proceed, simply reply to this email and I''ll send through the formal Service Agreement.

Looking forward to hearing from you.

Warm regards,
Laith Humadi
Director, Core Cleaning
+61 412 844 237
admin@corecleaning.services'),

('Agreement Follow-Up', 'agreement_followup', 'Following up — Service Agreement', 'Hi {{contact_name}},

Just checking in regarding the Service Agreement I sent through for {{business_name}}.

Once signed, we can lock in your start date and get everything organised from our end.

Please don''t hesitate to reach out if you have any questions about the terms.

Warm regards,
Laith Humadi
Director, Core Cleaning
+61 412 844 237
admin@corecleaning.services'),

('Onboarding Welcome', 'onboarding', 'Welcome to Core Cleaning — {{business_name}}', 'Hi {{contact_name}},

Welcome aboard! We''re really looking forward to working with {{business_name}}.

Here''s what to expect before your first clean:
— We''ll confirm access arrangements and any site-specific requirements
— Your assigned team will complete a pre-service briefing
— Laith will check in after your first visit to make sure everything met your expectations

If anything comes up in the meantime, don''t hesitate to reach out directly.

Warm regards,
Laith Humadi
Director, Core Cleaning
+61 412 844 237
admin@corecleaning.services'),

('Survey Request', 'survey', 'Quick check-in — How are we tracking?', 'Hi {{contact_name}},

I hope everything is going well at {{business_name}}.

I like to check in with all clients regularly to make sure the standard is where it should be. It only takes a minute — I''d really appreciate your honest feedback.

If there''s anything at all that could be improved, please let me know directly. I take every piece of feedback seriously.

Warm regards,
Laith Humadi
Director, Core Cleaning
+61 412 844 237
admin@corecleaning.services'),

('Survey Follow-Up', 'survey_followup', 'Following up on your feedback — {{business_name}}', 'Hi {{contact_name}},

Thank you for taking the time to leave feedback recently — it''s genuinely appreciated.

I wanted to follow up personally to make sure any concerns have been addressed and that the service is meeting your expectations.

If there''s anything specific you''d like me to look into, please let me know and I''ll get onto it straight away.

Warm regards,
Laith Humadi
Director, Core Cleaning
+61 412 844 237
admin@corecleaning.services'),

('Thank You', 'thankyou', 'Thank you — {{business_name}}', 'Hi {{contact_name}},

I just wanted to take a moment to say thank you for your continued trust in Core Cleaning.

It''s a pleasure working with {{business_name}} and we''re committed to maintaining a high standard on every visit.

Please never hesitate to reach out if there''s anything you need.

Warm regards,
Laith Humadi
Director, Core Cleaning
+61 412 844 237
admin@corecleaning.services'),

('Upsell — Additional Services', 'upsell', 'Additional services available for {{business_name}}', 'Hi {{contact_name}},

I hope things are going well.

I wanted to reach out because we''ve recently had a few clients take advantage of our specialist services — and I think they could add real value for {{business_name}} too.

We currently offer:
— Pressure washing (external surfaces, car parks, pathways)
— Carpet extraction (hot water extraction, stain treatment)
— Window washing (internal and external, frames and sills)
— Deep vinyl cleaning (machine scrub, strip and reseal)
— Female hygiene bin supply & servicing

All of these can be added to your existing schedule or done as a one-off. Happy to put together a quick quote if any of these are of interest.

Warm regards,
Laith Humadi
Director, Core Cleaning
+61 412 844 237
admin@corecleaning.services');

-- ============================================================
-- 004_survey_tokens.sql
-- ============================================================
-- Add nps_score to surveys if not already there
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS nps_score integer CHECK (nps_score between 0 and 10);

-- Survey tokens for email-based survey tracking
CREATE TABLE IF NOT EXISTS survey_tokens (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  token        uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  sent_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  survey_id    uuid REFERENCES surveys(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS survey_tokens_client_id_idx ON survey_tokens(client_id);
CREATE INDEX IF NOT EXISTS survey_tokens_token_idx ON survey_tokens(token);

-- RLS
ALTER TABLE survey_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_survey_tokens" ON survey_tokens FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_survey_tokens" ON survey_tokens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_survey_tokens" ON survey_tokens FOR UPDATE TO authenticated USING (true);

-- Allow anon to read token (for form lookup) and update (for submission)
CREATE POLICY "anon_select_survey_tokens" ON survey_tokens FOR SELECT TO anon USING (true);
CREATE POLICY "anon_update_survey_tokens" ON survey_tokens FOR UPDATE TO anon USING (submitted_at IS NULL);

-- Allow anon to insert surveys (for public form submission)
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'surveys' AND policyname = 'anon_insert_surveys'
  ) THEN
    CREATE POLICY "anon_insert_surveys" ON surveys FOR INSERT TO anon WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- 005_production_upgrade.sql
-- ============================================================
-- Core Cleaning Operations Hub — Production Upgrade (idempotent)

-- ─────────────────────────────────────────────
-- 1. LEADS PIPELINE
-- ─────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('lead', 'contacted', 'quoted', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS leads (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name     text        NOT NULL,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  status            lead_status NOT NULL DEFAULT 'lead',
  last_contact_date date,
  quote_value       numeric(10,2),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all_leads" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────
-- 2. SETTINGS TABLE
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text        UNIQUE NOT NULL,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all_settings" ON settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO settings (key, value) VALUES
  ('business', '{"name":"Core Cleaning","email":"admin@corecleaning.services","phone":"0407 026 360","website":"https://www.corecleaning.services","address":"Brisbane, QLD"}'),
  ('margin_thresholds', '{"red":24,"yellow":40}'),
  ('valuation_multiple', '2.5'),
  ('survey_frequency_days', '90'),
  ('lead_followup_days', '7'),
  ('contract_renewal_days', '60'),
  ('survey_questions', '[{"id":"q1","key":"quality_score","text":"How would you rate the quality of our cleaning service?","min":1,"max":10},{"id":"q2","key":"reliability_score","text":"How reliable is our team (on time, consistent)?","min":1,"max":10},{"id":"q3","key":"communication_score","text":"How would you rate our communication and responsiveness?","min":1,"max":10},{"id":"q4","key":"value_score","text":"How well does our service represent value for money?","min":1,"max":10},{"id":"q5","key":"nps_score","text":"How likely are you to recommend Core Cleaning to others? (0 = not at all, 10 = extremely likely)","min":0,"max":10}]')
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────
-- 3. CLIENT ENHANCEMENTS
-- ─────────────────────────────────────────────
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_expiry_date  date;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS visits_per_month      numeric(8,3);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_labour_cost   numeric(10,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_profit        numeric(10,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS margin_pct            numeric(5,2);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS profile_complete      boolean NOT NULL DEFAULT false;

-- ─────────────────────────────────────────────
-- 4. PROFIT CALCULATION TRIGGER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION frequency_to_visits_per_month(f frequency_type)
RETURNS numeric AS $$
BEGIN
  RETURN CASE f
    WHEN 'daily'       THEN 365.0 / 12.0
    WHEN 'weekly'      THEN 52.0  / 12.0
    WHEN 'fortnightly' THEN 26.0  / 12.0
    WHEN 'monthly'     THEN 1.0
    WHEN 'quarterly'   THEN 4.0   / 12.0
    WHEN 'annual'      THEN 1.0   / 12.0
    WHEN 'one_off'     THEN 1.0
    ELSE 1.0
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION compute_client_profit()
RETURNS TRIGGER AS $$
DECLARE
  v_visits   numeric;
  v_revenue  numeric;
  v_labour   numeric;
  v_profit   numeric;
  v_margin   numeric;
  v_complete boolean;
BEGIN
  v_visits := CASE WHEN NEW.frequency IS NOT NULL
    THEN frequency_to_visits_per_month(NEW.frequency) ELSE 1 END;

  v_revenue := CASE WHEN NEW.rate_per_visit IS NOT NULL
    THEN ROUND(NEW.rate_per_visit * v_visits, 2) ELSE NULL END;

  v_labour := CASE WHEN NEW.cleaner_hourly_rate IS NOT NULL AND NEW.cleaner_hours_per_visit IS NOT NULL
    THEN ROUND(NEW.cleaner_hourly_rate * NEW.cleaner_hours_per_visit * v_visits, 2) ELSE NULL END;

  v_profit := CASE WHEN v_revenue IS NOT NULL AND v_labour IS NOT NULL
    THEN ROUND(v_revenue - v_labour, 2) ELSE NULL END;

  v_margin := CASE WHEN v_revenue IS NOT NULL AND v_revenue > 0 AND v_profit IS NOT NULL
    THEN ROUND((v_profit / v_revenue) * 100, 1) ELSE NULL END;

  v_complete := (
    NEW.rate_per_visit          IS NOT NULL AND
    NEW.cleaner_hourly_rate     IS NOT NULL AND
    NEW.cleaner_hours_per_visit IS NOT NULL AND
    NEW.frequency               IS NOT NULL
  );

  NEW.visits_per_month    := ROUND(v_visits, 3);
  NEW.monthly_value       := v_revenue;
  NEW.annual_value        := CASE WHEN v_revenue IS NOT NULL THEN ROUND(v_revenue * 12, 2) ELSE NULL END;
  NEW.monthly_labour_cost := v_labour;
  NEW.monthly_profit      := v_profit;
  NEW.margin_pct          := v_margin;
  NEW.profile_complete    := v_complete;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS client_profit_calc ON clients;
CREATE TRIGGER client_profit_calc
  BEFORE INSERT OR UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION compute_client_profit();

-- Back-fill existing rows
UPDATE clients SET updated_at = now();

-- ─────────────────────────────────────────────
-- 5. INDEXES
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS clients_margin_pct_idx       ON clients(margin_pct)           WHERE active = true;
CREATE INDEX IF NOT EXISTS clients_contract_expiry_idx  ON clients(contract_expiry_date) WHERE active = true;
CREATE INDEX IF NOT EXISTS clients_profile_complete_idx ON clients(profile_complete)     WHERE active = true;
CREATE INDEX IF NOT EXISTS leads_status_idx             ON leads(status);
CREATE INDEX IF NOT EXISTS leads_last_contact_idx       ON leads(last_contact_date);

-- ============================================================
-- 006_leads_enhanced.sql
-- ============================================================
-- Core Cleaning Operations Hub — Enhanced Leads (idempotent)

-- ─────────────────────────────────────────────
-- 1. Extend lead_status enum with new values
-- ─────────────────────────────────────────────
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'proposal_sent';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'agreement_sent';
ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'signed';

-- ─────────────────────────────────────────────
-- 2. Add new columns to leads table
-- ─────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS address              text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS suburb              text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS state               text DEFAULT 'QLD';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS postcode            text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source              text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS proposal_data       jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS agreement_data      jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS proposal_created_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS proposal_sent_at    timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS agreement_created_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS agreement_sent_at   timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS signed_date         timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contract_expiry     timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_client_id uuid REFERENCES clients(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS timeline            jsonb DEFAULT '[]'::jsonb;

-- ─────────────────────────────────────────────
-- 3. Indexes for new columns
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS leads_converted_client_idx ON leads(converted_client_id) WHERE converted_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_proposal_sent_idx    ON leads(proposal_sent_at)    WHERE proposal_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS leads_agreement_sent_idx   ON leads(agreement_sent_at)   WHERE agreement_sent_at IS NOT NULL;

-- ============================================================
-- 006a_proposal_documents.sql
-- ============================================================
-- Migration 006a — proposal_documents + proposal_document_versions
-- These tables are used throughout the app (src/actions/proposal-docs.ts and the
-- documents portal) and are altered by later migrations (013 RLS/indexes, 028
-- sign_token, 029 sign_code, 030 onboarding) — but no earlier migration created
-- them. This backfills the base tables so the migration chain applies cleanly.

create table if not exists proposal_documents (
  id                    uuid primary key default gen_random_uuid(),
  kind                  text not null default 'proposal',   -- proposal | agreement | one_off | capability
  status                text not null default 'draft',
  ref_number            text,
  client_name           text,
  data                  jsonb,
  source_id             uuid,                                 -- proposal a converted agreement came from
  client_id             uuid references clients(id) on delete set null,
  lead_id               uuid references leads(id) on delete set null,
  pdf_url               text,
  signed_pdf_url        text,
  docusign_envelope_id  text,
  sent_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists proposal_documents_kind_idx    on proposal_documents (kind);
create index if not exists proposal_documents_status_idx  on proposal_documents (status);

-- Version snapshots for the document editor's "restore previous version" feature.
create table if not exists proposal_document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references proposal_documents(id) on delete cascade,
  data         jsonb,
  label        text,
  created_at   timestamptz not null default now()
);

create index if not exists proposal_document_versions_document_id_idx
  on proposal_document_versions (document_id);

-- ============================================================
-- 006b_cold_leads.sql
-- ============================================================
-- Migration 006b — cold_leads (the cold-call deck)
-- Used by src/actions/cold-leads.ts and the /calls page, and altered by later
-- migrations (013 RLS, 025 call_log, 033 follow_up_opt_in) — but no earlier
-- migration created it. This backfills the base table so the chain applies cleanly.
-- Service-role only (RLS enabled with no policies in 013); the app reaches it via
-- the admin client.

create table if not exists cold_leads (
  id                  uuid primary key default gen_random_uuid(),
  business_name       text not null,
  contact_name        text,
  phone               text,
  email               text,
  suburb              text,
  industry            text,
  address             text,
  website             text,
  status              text not null default 'new',
  notes               text,
  lead_id             uuid references leads(id) on delete set null, -- set when promoted to a pipeline lead
  last_called_at      timestamptz,
  next_follow_up      date,
  intro_email_sent_at timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists cold_leads_status_idx  on cold_leads (status);
create index if not exists cold_leads_created_idx  on cold_leads (created_at desc);

-- ============================================================
-- 006c_missing_prod_tables.sql
-- ============================================================
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

-- ============================================================
-- 006d_missing_functions.sql
-- ============================================================
-- Migration 006d — functions that existed in prod (via connector) but were never
-- captured as migration files. Migration 023 hardens their search_path and the app
-- calls submit_survey() as an RPC, but nothing defines them. Reconstructed from
-- usage in src/actions/survey-email.ts and the surveys/survey_tokens schema.

-- ── submit_survey: public survey submission (SECURITY DEFINER, bypasses RLS) ──
-- Validates the emailed token, inserts the survey, marks the token used. Returns
-- jsonb: { success: true } or { error: "..." }.
create or replace function public.submit_survey(
  p_token         text,
  p_quality       integer,
  p_reliability   integer,
  p_communication integer,
  p_value         integer,
  p_loyalty       integer,
  p_comments      text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token   survey_tokens%rowtype;
  v_survey_id uuid;
  v_uuid    uuid;
begin
  begin
    v_uuid := p_token::uuid;
  exception when others then
    return jsonb_build_object('error', 'Invalid survey link.');
  end;

  select * into v_token from survey_tokens where token = v_uuid;
  if not found then
    return jsonb_build_object('error', 'Survey link not found.');
  end if;
  if v_token.submitted_at is not null then
    return jsonb_build_object('error', 'This survey has already been submitted.');
  end if;

  insert into surveys (
    client_id, quality_score, reliability_score, communication_score,
    value_score, nps_score, comments, submitted_at
  ) values (
    v_token.client_id, p_quality, p_reliability, p_communication,
    p_value, p_loyalty, p_comments, now()
  ) returning id into v_survey_id;

  update survey_tokens
     set submitted_at = now(), survey_id = v_survey_id
   where id = v_token.id;

  return jsonb_build_object('success', true, 'survey_id', v_survey_id);
end;
$$;

-- Public survey form calls this with the anon key.
grant execute on function public.submit_survey(text,integer,integer,integer,integer,integer,text) to anon, authenticated, service_role;

-- ── touch_proposal_doc_updated_at: keep proposal_documents.updated_at current ─
create or replace function public.touch_proposal_doc_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$ begin
  create trigger trg_touch_proposal_doc_updated_at
    before update on public.proposal_documents
    for each row execute function public.touch_proposal_doc_updated_at();
exception when duplicate_object then null; end $$;

-- ============================================================
-- 007_roles_portal.sql
-- ============================================================
-- ─── Profiles (links auth.users to portal roles) ─────────────────────────────
create table if not exists profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users(id) on delete cascade not null unique,
  role              text not null default 'cleaner'
                      check (role in ('admin','cleaner','manager','client')),
  full_name         text,
  linked_client_id  uuid references clients(id) on delete set null,
  created_at        timestamptz default now() not null,
  updated_at        timestamptz default now() not null
);

-- ─── Job Assignments ──────────────────────────────────────────────────────────
create table if not exists job_assignments (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references clients(id) on delete cascade not null,
  cleaner_id       uuid references profiles(id) on delete set null,
  scheduled_date   date not null,
  address          text,
  access_notes     text,          -- entry codes, alarm pins, etc.
  frequency_label  text,          -- display only e.g. "Weekly"
  checklist        jsonb not null default '[]'::jsonb,
                                  -- [{id, label, required}]
  status           text not null default 'not_started'
                     check (status in ('not_started','in_progress','completed','flagged')),
  created_at       timestamptz default now() not null,
  updated_at       timestamptz default now() not null
);

-- ─── Job Submissions ──────────────────────────────────────────────────────────
create table if not exists job_submissions (
  id                  uuid primary key default gen_random_uuid(),
  job_id              uuid references job_assignments(id) on delete cascade not null unique,
  cleaner_id          uuid references profiles(id) on delete set null,
  photo_urls          jsonb not null default '[]'::jsonb,   -- array of storage URLs
  checklist_completed jsonb not null default '{}'::jsonb,   -- {item_id: boolean}
  notes               text,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz default now() not null
);

-- ─── Job Flags (cleaner-reported) ─────────────────────────────────────────────
create table if not exists job_flags (
  id           uuid primary key default gen_random_uuid(),
  job_id       uuid references job_assignments(id) on delete set null,
  cleaner_id   uuid references profiles(id) on delete set null,
  client_id    uuid references clients(id) on delete cascade,
  description  text not null,
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  resolved_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz default now() not null
);

-- ─── Client Issues (client-reported via portal) ───────────────────────────────
create table if not exists client_issues (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade not null,
  reported_by  uuid references profiles(id) on delete set null,
  description  text not null,
  resolved     boolean not null default false,
  resolved_at  timestamptz,
  resolved_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz default now() not null
);

-- ─── Photo Requests (client portal) ──────────────────────────────────────────
create table if not exists photo_requests (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade not null,
  requested_by uuid references profiles(id) on delete set null,
  fulfilled    boolean not null default false,
  fulfilled_at timestamptz,
  created_at   timestamptz default now() not null
);

-- ─── Compliance Documents (SDS, insurance) ───────────────────────────────────
create table if not exists compliance_documents (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('sds','insurance','other')),
  file_url    text not null,
  client_id   uuid references clients(id) on delete cascade,  -- null = global
  created_at  timestamptz default now() not null
);

-- ─── Triggers ─────────────────────────────────────────────────────────────────
create trigger set_profiles_updated_at
  before update on profiles
  for each row execute procedure handle_updated_at();

create trigger set_job_assignments_updated_at
  before update on job_assignments
  for each row execute procedure handle_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table profiles             enable row level security;
alter table job_assignments      enable row level security;
alter table job_submissions      enable row level security;
alter table job_flags            enable row level security;
alter table client_issues        enable row level security;
alter table photo_requests       enable row level security;
alter table compliance_documents enable row level security;

create policy "portal_profiles_all"       on profiles             for all to authenticated using (true) with check (true);
create policy "portal_jobs_all"           on job_assignments      for all to authenticated using (true) with check (true);
create policy "portal_submissions_all"    on job_submissions      for all to authenticated using (true) with check (true);
create policy "portal_flags_all"          on job_flags            for all to authenticated using (true) with check (true);
create policy "portal_client_issues_all"  on client_issues        for all to authenticated using (true) with check (true);
create policy "portal_photo_requests_all" on photo_requests       for all to authenticated using (true) with check (true);
create policy "portal_compliance_all"     on compliance_documents for all to authenticated using (true) with check (true);

-- ─── Storage bucket for job photos ───────────────────────────────────────────
-- Run this manually in the Supabase dashboard or via CLI:
-- create bucket 'job-photos' with (public = false);

-- ============================================================
-- 008_profiles_email.sql
-- ============================================================
-- Add email column to profiles for display purposes
alter table profiles add column if not exists email text;

-- ============================================================
-- 009_additional_services.sql
-- ============================================================
-- Migration 009: Additional services per client
-- Stores ad-hoc services (window cleaning, pressure washing, vinyl clean, etc.)
-- with their own frequency, charge rate and cleaner cost.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS additional_services jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN clients.additional_services IS
  'Array of { id, name, frequency, my_rate_per_visit, cleaner_cost_per_visit }';

-- ============================================================
-- 010_client_missing_columns.sql
-- ============================================================
-- Migration 010 — Add missing client columns
-- service_days, days_per_week, scope_of_work, access_details, assigned_cleaner_id
-- were referenced in actions/clients.ts but never created in the DB.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS service_days       text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS days_per_week      integer,
  ADD COLUMN IF NOT EXISTS scope_of_work      text,
  ADD COLUMN IF NOT EXISTS access_details     text,
  ADD COLUMN IF NOT EXISTS assigned_cleaner_id uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Also add carpet_cleaning to the service_type enum if missing
-- (the Zod schema includes it but the DB enum did not)
DO $$ BEGIN
  ALTER TYPE service_type ADD VALUE IF NOT EXISTS 'carpet_cleaning';
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS clients_assigned_cleaner_idx
  ON clients(assigned_cleaner_id) WHERE assigned_cleaner_id IS NOT NULL;

-- ============================================================
-- 011_job_submission_completed_by.sql
-- ============================================================
-- Track whether a job was completed by the cleaner, admin, or manager
ALTER TABLE job_submissions
  ADD COLUMN IF NOT EXISTS completed_by_role text
    CHECK (completed_by_role IN ('cleaner', 'admin', 'manager'));

-- Existing rows with completed_at and no role are assumed cleaner-submitted
UPDATE job_submissions
SET completed_by_role = 'cleaner'
WHERE completed_at IS NOT NULL AND completed_by_role IS NULL;

-- ============================================================
-- 012_client_sites.sql
-- ============================================================
-- Multi-site client support

-- Flag on clients table
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_multi_site boolean NOT NULL DEFAULT false;

-- Sites table — one row per location for multi-site clients
CREATE TABLE IF NOT EXISTS client_sites (
  id                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid          REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  site_name               text          NOT NULL,
  address                 text,
  suburb                  text,
  state                   text          DEFAULT 'QLD',
  postcode                text,
  scope_of_work           text,
  frequency               text,
  service_days            text[]        NOT NULL DEFAULT '{}',
  days_per_week           integer,
  access_details          text,
  assigned_cleaner_id     uuid          REFERENCES profiles(id) ON DELETE SET NULL,
  rate_per_visit          numeric(10,2),
  cleaner_hourly_rate     numeric(10,2),
  cleaner_hours_per_visit numeric(5,2),
  additional_services     jsonb         NOT NULL DEFAULT '[]',
  notes                   text,
  sort_order              integer       NOT NULL DEFAULT 0,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz   NOT NULL DEFAULT now()
);

-- Link jobs to a specific site (nullable — null = single-site client)
ALTER TABLE job_assignments
  ADD COLUMN IF NOT EXISTS site_id uuid REFERENCES client_sites(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE client_sites ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_all_client_sites" ON client_sites
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Trigger
DROP TRIGGER IF EXISTS set_client_sites_updated_at ON client_sites;
CREATE TRIGGER set_client_sites_updated_at
  BEFORE UPDATE ON client_sites
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS client_sites_client_idx  ON client_sites(client_id);
CREATE INDEX IF NOT EXISTS job_assignments_site_idx ON job_assignments(site_id)
  WHERE site_id IS NOT NULL;

-- ============================================================
-- 012_fix_multisite_profit_trigger.sql
-- ============================================================
-- Fix compute_client_profit trigger to handle multi-site clients.
-- For multi-site, monthly_labour_cost / monthly_profit / margin_pct are
-- pre-aggregated from client_sites by the server action and must not be
-- overwritten by the trigger.

CREATE OR REPLACE FUNCTION compute_client_profit()
RETURNS TRIGGER AS $$
DECLARE
  v_visits   numeric;
  v_revenue  numeric;
  v_labour   numeric;
  v_profit   numeric;
  v_margin   numeric;
  v_complete boolean;
BEGIN
  -- Multi-site clients: costs are aggregated from client_sites by the server action
  -- and passed in directly. Skip recalculation and only derive profile_complete.
  IF NEW.is_multi_site THEN
    NEW.profile_complete := (
      NEW.monthly_profit IS NOT NULL AND
      NEW.monthly_labour_cost IS NOT NULL AND
      NEW.monthly_value IS NOT NULL
    );
    RETURN NEW;
  END IF;

  -- Single-site clients: derive everything from the scalar fields
  v_visits := CASE WHEN NEW.frequency IS NOT NULL
    THEN frequency_to_visits_per_month(NEW.frequency) ELSE 1 END;

  v_revenue := CASE WHEN NEW.rate_per_visit IS NOT NULL
    THEN ROUND(NEW.rate_per_visit * v_visits, 2) ELSE NULL END;

  v_labour := CASE WHEN NEW.cleaner_hourly_rate IS NOT NULL AND NEW.cleaner_hours_per_visit IS NOT NULL
    THEN ROUND(NEW.cleaner_hourly_rate * NEW.cleaner_hours_per_visit * v_visits, 2) ELSE NULL END;

  v_profit := CASE WHEN v_revenue IS NOT NULL AND v_labour IS NOT NULL
    THEN ROUND(v_revenue - v_labour, 2) ELSE NULL END;

  v_margin := CASE WHEN v_revenue IS NOT NULL AND v_revenue > 0 AND v_profit IS NOT NULL
    THEN ROUND((v_profit / v_revenue) * 100, 1) ELSE NULL END;

  v_complete := (
    NEW.rate_per_visit          IS NOT NULL AND
    NEW.cleaner_hourly_rate     IS NOT NULL AND
    NEW.cleaner_hours_per_visit IS NOT NULL AND
    NEW.frequency               IS NOT NULL
  );

  NEW.visits_per_month    := ROUND(v_visits, 3);
  NEW.monthly_value       := v_revenue;
  NEW.annual_value        := CASE WHEN v_revenue IS NOT NULL THEN ROUND(v_revenue * 12, 2) ELSE NULL END;
  NEW.monthly_labour_cost := v_labour;
  NEW.monthly_profit      := v_profit;
  NEW.margin_pct          := v_margin;
  NEW.profile_complete    := v_complete;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 013_security_rls_indexes.sql
-- ============================================================
-- Migration 013 — Security hardening + performance indexes
-- Surfaced by the Supabase advisors (security + performance).
--
-- SAFE TO APPLY IMMEDIATELY: every table touched here is read/written ONLY via the
-- service-role client (createAdminClient) in the *currently deployed* code, so enabling
-- RLS (which the service role bypasses) has zero impact on the live app while closing
-- public-API exposure. The Xero token/transaction tables are handled separately in
-- migration 014 because their code only moves to service-role in this same release.

-- ─── 1. Enable RLS on public tables that had it disabled ──────────────────────
-- These were reachable through the public REST API with no row security.
-- No permissive policy is added: service role bypasses RLS, end-user roles get no access.
ALTER TABLE public.proposal_documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_document_versions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cold_leads                  ENABLE ROW LEVEL SECURITY;

-- ─── 2. Covering indexes for unindexed foreign keys ───────────────────────────
-- Improves join/lookup performance and avoids full scans on cascade checks.
CREATE INDEX IF NOT EXISTS client_feedback_client_id_idx              ON public.client_feedback (client_id);
CREATE INDEX IF NOT EXISTS client_issues_client_id_idx               ON public.client_issues (client_id);
CREATE INDEX IF NOT EXISTS client_issues_reported_by_idx             ON public.client_issues (reported_by);
CREATE INDEX IF NOT EXISTS client_issues_resolved_by_idx             ON public.client_issues (resolved_by);
CREATE INDEX IF NOT EXISTS client_monthly_financials_invoice_id_idx  ON public.client_monthly_financials (invoice_id);
CREATE INDEX IF NOT EXISTS client_sites_assigned_cleaner_id_idx      ON public.client_sites (assigned_cleaner_id);
CREATE INDEX IF NOT EXISTS cold_leads_lead_id_idx                    ON public.cold_leads (lead_id);
CREATE INDEX IF NOT EXISTS compliance_documents_client_id_idx        ON public.compliance_documents (client_id);
CREATE INDEX IF NOT EXISTS emails_sent_client_id_idx                 ON public.emails_sent (client_id);
CREATE INDEX IF NOT EXISTS emails_sent_template_id_idx               ON public.emails_sent (template_id);
CREATE INDEX IF NOT EXISTS financial_records_client_id_idx           ON public.financial_records (client_id);
CREATE INDEX IF NOT EXISTS job_assignments_cleaner_id_idx            ON public.job_assignments (cleaner_id);
CREATE INDEX IF NOT EXISTS job_assignments_client_id_idx             ON public.job_assignments (client_id);
CREATE INDEX IF NOT EXISTS job_flags_cleaner_id_idx                  ON public.job_flags (cleaner_id);
CREATE INDEX IF NOT EXISTS job_flags_client_id_idx                   ON public.job_flags (client_id);
CREATE INDEX IF NOT EXISTS job_flags_job_id_idx                      ON public.job_flags (job_id);
CREATE INDEX IF NOT EXISTS job_flags_resolved_by_idx                 ON public.job_flags (resolved_by);
CREATE INDEX IF NOT EXISTS job_submissions_cleaner_id_idx            ON public.job_submissions (cleaner_id);
CREATE INDEX IF NOT EXISTS photo_requests_client_id_idx              ON public.photo_requests (client_id);
CREATE INDEX IF NOT EXISTS photo_requests_requested_by_idx           ON public.photo_requests (requested_by);
CREATE INDEX IF NOT EXISTS profiles_linked_client_id_idx             ON public.profiles (linked_client_id);
CREATE INDEX IF NOT EXISTS proposal_documents_client_id_idx          ON public.proposal_documents (client_id);
CREATE INDEX IF NOT EXISTS proposal_documents_lead_id_idx            ON public.proposal_documents (lead_id);
CREATE INDEX IF NOT EXISTS proposal_documents_source_id_idx          ON public.proposal_documents (source_id);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx            ON public.push_subscriptions (user_id);
CREATE INDEX IF NOT EXISTS service_requests_client_id_idx            ON public.service_requests (client_id);
CREATE INDEX IF NOT EXISTS survey_tokens_survey_id_idx               ON public.survey_tokens (survey_id);
CREATE INDEX IF NOT EXISTS surveys_client_id_idx                     ON public.surveys (client_id);

-- ============================================================
-- 20240002_xero_tokens.sql
-- ============================================================
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

-- ============================================================
-- 20240003_xero_transactions.sql
-- ============================================================
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

-- ============================================================
-- 014_xero_tokens_rls.sql
-- ============================================================
-- Migration 014 — Lock down Xero token + transaction tables (CRITICAL)
--
-- The advisor flagged `xero_tokens` as exposed via the public API with no RLS, leaking
-- access_token + refresh_token. The transaction tables were also public with RLS off.
--
-- ⚠️ APPLY-TIMING: this migration MUST go out together with the code change in this
-- release that switches all Xero access from createClient() (anon/authenticated) to
-- createAdminClient() (service role). Applying it before that code is deployed would
-- break the live Xero integration, because the old code reads these tables as the
-- authenticated user and RLS-with-no-policy denies that.
--
-- After the code change, all access is service-role (which bypasses RLS), so enabling
-- RLS with no permissive policy fully removes public exposure with no functional impact.

ALTER TABLE public.xero_tokens                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_approved_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xero_ignored_transactions   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 015_tighten_job_photos_listing.sql
-- ============================================================
-- Migration 015 — Remove broad listing on the public job-photos bucket.
-- (Applied to prod 2026-06-29.)
--
-- The job-photos bucket is public, so images are served via getPublicUrl with no
-- SELECT policy required, and the app never calls .list() on it. This SELECT policy
-- only allowed any authenticated user to enumerate ALL files (advisor finding
-- public_bucket_allows_listing). Removing it has no effect on uploads (INSERT policy
-- retained) or on photo display (public URLs).
DROP POLICY IF EXISTS "authenticated can read job photos" ON storage.objects;

-- ============================================================
-- 016_rls_phase1_internal_tables.sql
-- ============================================================
-- Migration 016 — Cross-portal permissions, Phase 1: lock financial/sales/internal tables.
--
-- These 8 tables are read/written ONLY by the manager (app) area — the client and cleaner
-- portals never touch them (verified across pages + shared actions in src/). Today every
-- `authenticated` user (incl. 8 client + 4 cleaner logins) can read them via the REST API.
-- This restricts them to admin/manager. Service-role access (createAdminClient) bypasses
-- RLS and is unaffected; the manager portal keeps full access via the role check.
--
-- Phase 2 (separate, higher-touch) will row-scope the SHARED tables (clients, job_assignments,
-- client_sites, documents, compliance_documents, job_submissions, client_issues,
-- photo_requests, client_feedback, service_requests) so each client/cleaner sees only their own.

-- 1. Role helper — SECURITY DEFINER reads the caller's role without tripping RLS recursion.
create or replace function public.app_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$ select role from public.profiles where user_id = auth.uid() limit 1 $$;

revoke all on function public.app_user_role() from public, anon;
grant execute on function public.app_user_role() to authenticated;

-- 2. Drop the permissive (USING true) policies on the 8 internal tables.
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in (
        'financial_records','invoices','invoice_line_items','client_monthly_financials',
        'leads','emails_sent','email_templates','settings')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 3. Manager/admin-only access on each (one ALL policy covers select/insert/update/delete).
create policy manager_only on public.financial_records         for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.invoices                  for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.invoice_line_items        for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.client_monthly_financials for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.leads                     for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.emails_sent               for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.email_templates           for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));
create policy manager_only on public.settings                  for all to authenticated
  using (public.app_user_role() in ('admin','manager')) with check (public.app_user_role() in ('admin','manager'));

-- ============================================================
-- 017_rls_phase2_shared_tables.sql
-- ============================================================
-- Migration 017 — Cross-portal permissions, Phase 2: row-scope the SHARED tables.
--
-- These tables ARE used by the client/cleaner portals, but the app already filters every
-- read by owner (verified): clients .eq('id', linkedClientId), job_assignments
-- .eq('client_id'|'cleaner_id'), profiles .eq('user_id', auth uid), etc. These policies
-- enforce those same conditions so the app's existing queries keep working, while blocking
-- cross-account access via the raw API. Service-role (createAdminClient) bypasses RLS.
--
-- Embed paths validated against live data: a client can read their cleaner's profile
-- (job_assignments -> profiles) and their job photos (-> job_submissions); a cleaner can
-- read their assigned clients. See validation in the PR notes.
--
-- NOTE: the client-feedback action also reads manager emails (profiles where role=manager)
-- to CC them; under these policies that read returns empty, so managers lose the CC — the
-- feedback still saves and admin@corecleaning.services is still notified. Proper fix later:
-- move that read to the service-role client.

-- ── Identity helpers (SECURITY DEFINER → bypass RLS, no recursion) ──
create or replace function public.app_linked_client_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp
  as $$ select linked_client_id from public.profiles where user_id = auth.uid() limit 1 $$;
create or replace function public.app_profile_id() returns uuid
  language sql stable security definer set search_path = public, pg_temp
  as $$ select id from public.profiles where user_id = auth.uid() limit 1 $$;
revoke all on function public.app_linked_client_id() from public, anon;
revoke all on function public.app_profile_id()      from public, anon;
grant execute on function public.app_linked_client_id() to authenticated;
grant execute on function public.app_profile_id()      to authenticated;

-- ── Drop the permissive USING(true) policies on every shared table ──
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' and tablename in
    ('clients','job_assignments','client_sites','documents','compliance_documents',
     'job_submissions','client_issues','photo_requests','client_feedback','service_requests','profiles')
  loop execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename); end loop;
end $$;

-- Helper expressions used below:
--   manager := app_user_role() in ('admin','manager')

-- ── clients ── client sees own; cleaner sees assigned; manager all. Writes: manager only.
create policy clients_select on public.clients for select to authenticated using (
  app_user_role() in ('admin','manager') or id = app_linked_client_id() or assigned_cleaner_id = app_profile_id());
create policy clients_ins on public.clients for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy clients_upd on public.clients for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy clients_del on public.clients for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── job_assignments ── client sees own; cleaner sees + updates own; manager all.
create policy ja_select on public.job_assignments for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id() or cleaner_id = app_profile_id());
create policy ja_ins on public.job_assignments for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy ja_upd on public.job_assignments for update to authenticated using (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id())
  with check (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy ja_del on public.job_assignments for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── client_sites ── client sees own; cleaner sees assigned; manager writes.
create policy cs_select on public.client_sites for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id() or assigned_cleaner_id = app_profile_id());
create policy cs_ins on public.client_sites for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy cs_upd on public.client_sites for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy cs_del on public.client_sites for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── documents ── client sees own; manager writes.
create policy doc_select on public.documents for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy doc_ins on public.documents for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy doc_upd on public.documents for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy doc_del on public.documents for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── compliance_documents ── client sees own; manager writes.
create policy cd_select on public.compliance_documents for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy cd_ins on public.compliance_documents for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy cd_upd on public.compliance_documents for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy cd_del on public.compliance_documents for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── job_submissions ── cleaner reads/writes own; client reads their jobs'; manager all.
create policy js_select on public.job_submissions for select to authenticated using (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id()
  or job_id in (select id from public.job_assignments where client_id = app_linked_client_id()));
create policy js_ins on public.job_submissions for insert to authenticated with check (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy js_upd on public.job_submissions for update to authenticated using (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id())
  with check (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy js_del on public.job_submissions for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── client_issues ── client reads + creates own; manager all.
create policy ci_select on public.client_issues for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy ci_ins on public.client_issues for insert to authenticated with check (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy ci_upd on public.client_issues for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy ci_del on public.client_issues for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── photo_requests ── client reads + creates own; manager all.
create policy pr_select on public.photo_requests for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy pr_ins on public.photo_requests for insert to authenticated with check (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy pr_upd on public.photo_requests for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy pr_del on public.photo_requests for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── client_feedback ── client reads + creates own; manager all.
create policy cf_select on public.client_feedback for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy cf_ins on public.client_feedback for insert to authenticated with check (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy cf_upd on public.client_feedback for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy cf_del on public.client_feedback for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── service_requests ── client reads + creates own; manager all.
create policy sr_select on public.service_requests for select to authenticated using (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy sr_ins on public.service_requests for insert to authenticated with check (
  app_user_role() in ('admin','manager') or client_id = app_linked_client_id());
create policy sr_upd on public.service_requests for update to authenticated using (app_user_role() in ('admin','manager')) with check (app_user_role() in ('admin','manager'));
create policy sr_del on public.service_requests for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ── profiles ── everyone reads own; client also reads their assigned cleaner (embed);
--                manager reads all. Self-update allowed; create/delete is manager (admin client).
create policy prof_select on public.profiles for select to authenticated using (
  app_user_role() in ('admin','manager') or user_id = auth.uid()
  or id in (select cleaner_id from public.job_assignments where client_id = app_linked_client_id()));
create policy prof_ins on public.profiles for insert to authenticated with check (app_user_role() in ('admin','manager'));
create policy prof_upd on public.profiles for update to authenticated using (
  app_user_role() in ('admin','manager') or user_id = auth.uid())
  with check (app_user_role() in ('admin','manager') or user_id = auth.uid());
create policy prof_del on public.profiles for delete to authenticated using (app_user_role() in ('admin','manager'));

-- ============================================================
-- 018_fix_cleaner_job_insert.sql
-- ============================================================
-- Migration 018 — Fix: cleaners couldn't start jobs after RLS Phase 2 (017).
--
-- startCleanForClientAction inserts a new job_assignment (cleaner_id = the cleaner)
-- when starting a clean with no existing job record. Migration 017's ja_ins policy
-- only allowed admin/manager to insert, so cleaners got
-- "new row violates row-level security policy for table job_assignments".
--
-- Allow a cleaner to create a job assigned to THEMSELVES (still blocks creating
-- jobs for other cleaners). Verified live with RLS-enforced impersonation.

drop policy if exists ja_ins on public.job_assignments;
create policy ja_ins on public.job_assignments for insert to authenticated
  with check (app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());

-- ============================================================
-- 019_cleaner_scope_schedule.sql
-- ============================================================
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

-- ============================================================
-- 020_site_scope_and_assignment.sql
-- ============================================================
-- Migration 020 — Per-site scope-of-works for multi-site clients.
-- Each client_site carries its own structured scope + clean days (different sites,
-- different cleaners, different scopes). Already applied to prod via connector.

alter table public.client_sites
  add column if not exists scope jsonb not null default '[]'::jsonb,
  add column if not exists clean_days text[] not null default '{}'::text[];

-- Let the cleaner assigned to the CLIENT read that client's sites (client-level coverage),
-- on top of site-level assignment / client-portal / staff access.
drop policy if exists cs_select on public.client_sites;
create policy cs_select on public.client_sites for select to authenticated using (
  app_user_role() in ('admin','manager')
  or client_id = app_linked_client_id()
  or assigned_cleaner_id = app_profile_id()
  or client_id in (select id from public.clients where assigned_cleaner_id = app_profile_id())
);

-- ============================================================
-- 021_schedule_completions_cleaner_idx.sql
-- ============================================================
-- Migration 021 — cover the schedule_completions.cleaner_id foreign key with an index
-- (flagged by the Supabase performance advisor). Already applied to prod via connector.

create index if not exists schedule_completions_cleaner_id_idx
  on public.schedule_completions (cleaner_id);

-- ============================================================
-- 022_tighten_loose_rls.sql
-- ============================================================
-- Migration 022 — replace always-true write RLS policies with scoped ones.
-- Reads and the anon public-survey flow are left untouched. Already applied to prod
-- via connector and verified with RLS impersonation tests (cleaner can flag own jobs;
-- cleaners/clients blocked from staff writes; staff writes still allowed).

-- job_flags: cleaners create their own flags; only staff resolve/delete; reads scoped.
drop policy if exists portal_flags_all on public.job_flags;
create policy jf_select on public.job_flags for select to authenticated using (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy jf_insert on public.job_flags for insert to authenticated with check (
  app_user_role() in ('admin','manager') or cleaner_id = app_profile_id());
create policy jf_update on public.job_flags for update to authenticated
  using (app_user_role() in ('admin','manager'))
  with check (app_user_role() in ('admin','manager'));
create policy jf_delete on public.job_flags for delete to authenticated using (
  app_user_role() in ('admin','manager'));

-- sops: writes -> staff only (sops_select read policy kept as-is).
drop policy if exists sops_insert on public.sops;
drop policy if exists sops_update on public.sops;
drop policy if exists sops_delete on public.sops;
create policy sops_insert on public.sops for insert to authenticated with check (
  app_user_role() in ('admin','manager'));
create policy sops_update on public.sops for update to authenticated
  using (app_user_role() in ('admin','manager'))
  with check (app_user_role() in ('admin','manager'));
create policy sops_delete on public.sops for delete to authenticated using (
  app_user_role() in ('admin','manager'));

-- surveys: authenticated writes -> staff only (anon_insert_surveys + surveys_select kept).
drop policy if exists surveys_insert on public.surveys;
drop policy if exists surveys_update on public.surveys;
drop policy if exists surveys_delete on public.surveys;
create policy surveys_insert on public.surveys for insert to authenticated with check (
  app_user_role() in ('admin','manager'));
create policy surveys_update on public.surveys for update to authenticated
  using (app_user_role() in ('admin','manager'))
  with check (app_user_role() in ('admin','manager'));
create policy surveys_delete on public.surveys for delete to authenticated using (
  app_user_role() in ('admin','manager'));

-- survey_tokens: authenticated writes -> staff only (anon_select/anon_update/auth_select kept).
drop policy if exists auth_insert_survey_tokens on public.survey_tokens;
drop policy if exists auth_update_survey_tokens on public.survey_tokens;
create policy auth_insert_survey_tokens on public.survey_tokens for insert to authenticated with check (
  app_user_role() in ('admin','manager'));
create policy auth_update_survey_tokens on public.survey_tokens for update to authenticated
  using (app_user_role() in ('admin','manager'))
  with check (app_user_role() in ('admin','manager'));
create policy auth_delete_survey_tokens on public.survey_tokens for delete to authenticated using (
  app_user_role() in ('admin','manager'));

-- ============================================================
-- 024_drop_anon_insert_surveys.sql
-- ============================================================
-- Migration 024 — drop the unused, overly-permissive anon INSERT policy on surveys.
-- Public submission uses the submit_survey() SECURITY DEFINER function (bypasses RLS),
-- so anon never needs direct table-insert. Already applied to prod via connector.

drop policy if exists anon_insert_surveys on public.surveys;

-- ============================================================
-- 025_cold_leads_call_log.sql
-- ============================================================
-- Migration 025 — per-call summary timeline for the cold-call deck.
-- Each logged call appends { at, outcome, note } so reps can see the call history.
-- Already applied to prod via connector. cold_leads is service-role only (no RLS policies).

alter table public.cold_leads
  add column if not exists call_log jsonb not null default '[]'::jsonb;

-- ============================================================
-- 026_compliance_expiry_and_cleaner.sql
-- ============================================================
-- Migration 026 — compliance monitoring.
-- Add an expiry date to compliance documents and let a document belong to a CLEANER
-- (profile) for staff compliance (insurance, police check, white card, qualification),
-- alongside the existing per-client / global documents. Already applied to prod via connector.

alter table public.compliance_documents
  add column if not exists expiry_date date,
  add column if not exists profile_id uuid references public.profiles(id) on delete cascade;

create index if not exists compliance_documents_expiry_idx on public.compliance_documents (expiry_date);
create index if not exists compliance_documents_profile_idx on public.compliance_documents (profile_id);

-- ============================================================
-- 027_fix_multisite_labour_days.sql
-- ============================================================
-- Migration 027 — multi-site labour must use the SAME visit math as revenue:
-- frequency × days-per-week (weekly/fortnightly only). Previously the trigger ignored
-- days_per_week, so a 5-day site's labour was undercounted 5x and margins were wrong
-- (and disagreed with the per-site P&L view). Already applied to prod via connector.

create or replace function public.sync_multisite_client_profit()
 returns trigger
 language plpgsql
 set search_path = public
as $function$
declare
  v_client_id uuid; v_monthly_rev numeric; v_labour numeric; v_profit numeric; v_margin numeric; v_complete boolean;
begin
  v_client_id := coalesce(NEW.client_id, OLD.client_id);

  select sum(
    case when cs.cleaner_hourly_rate is not null and cs.cleaner_hours_per_visit is not null and cs.frequency is not null
      then round(
        cs.cleaner_hourly_rate * cs.cleaner_hours_per_visit
        * frequency_to_visits_per_month(cs.frequency::frequency_type)
        * case when cs.frequency in ('weekly','fortnightly') then coalesce(cs.days_per_week, 1) else 1 end,
      2)
      else 0 end
  )
  into v_labour
  from client_sites cs
  where cs.client_id = v_client_id;

  select monthly_value into v_monthly_rev from clients where id = v_client_id;

  v_profit := case when v_monthly_rev is not null and v_labour is not null and v_labour > 0 then round(v_monthly_rev - v_labour, 2) else null end;
  v_margin := case when v_monthly_rev is not null and v_monthly_rev > 0 and v_profit is not null then round((v_profit / v_monthly_rev) * 100, 1) else null end;
  v_complete := (v_monthly_rev is not null and v_labour is not null and v_labour > 0);

  update clients
  set monthly_labour_cost = case when v_labour > 0 then v_labour else null end,
      monthly_profit      = v_profit,
      margin_pct          = v_margin,
      profile_complete    = v_complete
  where id = v_client_id and is_multi_site = true;

  return NEW;
end;
$function$;

-- ============================================================
-- 023_function_search_path.sql
-- ============================================================
-- Migration 023 — pin search_path on functions flagged by function_search_path_mutable.
-- All reference only public objects + built-ins; matches the already-hardened
-- submit_survey(uuid) overload. Already applied to prod via connector.

alter function public.compute_client_profit() set search_path = public;
alter function public.frequency_to_visits_per_month(frequency_type) set search_path = public;
alter function public.handle_updated_at() set search_path = public;
alter function public.submit_survey(text,integer,integer,integer,integer,integer,text) set search_path = public;
alter function public.sync_multisite_client_profit() set search_path = public;
alter function public.touch_proposal_doc_updated_at() set search_path = public;

-- ============================================================
-- 028_proposal_docs_sign_token.sql
-- ============================================================
-- Migration 028 — custom in-app e-signing (replaces DocuSign).
-- A unique sign_token generates the client's signing link (/sign/<token>). When the
-- client types their name and confirms, we stamp signed_name/at/ip and set status='signed'.
-- Already applied to prod via connector.
alter table public.proposal_documents
  add column if not exists sign_token   uuid,
  add column if not exists signer_email text,
  add column if not exists signed_name  text,
  add column if not exists signed_at    timestamptz,
  add column if not exists signed_ip    text;

create unique index if not exists proposal_documents_sign_token_key
  on public.proposal_documents (sign_token)
  where sign_token is not null;

-- ============================================================
-- 029_proposal_docs_sign_code.sql
-- ============================================================
-- Migration 029 — friendly signing links. A short human-readable code
-- (e.g. "northpoint-commercial-k7m2qp") drives /sign/<code> instead of a raw UUID.
-- Already applied to prod via connector.
alter table public.proposal_documents
  add column if not exists sign_code text;

create unique index if not exists proposal_documents_sign_code_key
  on public.proposal_documents (sign_code)
  where sign_code is not null;

-- ============================================================
-- 030_client_onboarding_fields.sql
-- ============================================================
-- Migration 030 — details the client fills in when they sign (onboarding-on-sign).
-- Already applied to prod via connector.
alter table public.clients
  add column if not exists abn                 text,
  add column if not exists billing_email       text,
  add column if not exists po_number           text,
  add column if not exists site_contact_name   text,
  add column if not exists site_contact_phone  text;

-- Raw details the client submitted at signing, kept on the contract record.
alter table public.proposal_documents
  add column if not exists onboarding jsonb;

-- ============================================================
-- 031_subcontractor.sql
-- ============================================================
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

-- ============================================================
-- 032_inspections.sql
-- ============================================================
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

-- ============================================================
-- 033_cold_lead_followup_optin.sql
-- ============================================================
-- Opt-in flag for the automatic 5-day cold-lead follow-up email. Set when the
-- intro email is sent with the "5-day follow-up" box ticked; the follow-up cron
-- only sends to leads where this is true.

alter table public.cold_leads
  add column if not exists follow_up_opt_in boolean not null default false;

-- ============================================================
-- 034_lead_intro_email.sql
-- ============================================================
-- Capability-statement intro email + 5-day follow-up for pipeline leads, mirroring
-- the cold_leads fields. Sent from the lead profile; the follow-up cron picks up
-- opted-in leads.

alter table public.leads
  add column if not exists intro_email_sent_at     timestamptz,
  add column if not exists intro_email_message_id  text,
  add column if not exists intro_email_subject      text,
  add column if not exists follow_up_email_sent_at  timestamptz,
  add column if not exists follow_up_opt_in          boolean not null default false;

