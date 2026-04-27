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
