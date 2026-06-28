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
