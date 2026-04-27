-- Delta Operations Hub — Enhanced Leads (idempotent)

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
