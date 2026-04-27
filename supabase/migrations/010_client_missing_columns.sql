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
