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
