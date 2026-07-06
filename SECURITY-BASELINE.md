# Core Cleaning Hub — Security Baseline

Canonical list of **intentional / accepted** security posture. A health check or
review should treat everything here as expected and **NOT report it as an issue**.
Only flag genuine *deviations* from this baseline. Reports are branded **Core Cleaning Hub**,
never "Claude".

_Last reviewed: 2026-07-03._

## Accepted — do not report

- **`submit_survey` (SECURITY DEFINER, callable by `anon`).** Intentional. The public
  client-satisfaction survey is submitted by not-logged-in people via a one-time
  token; the function validates the token internally. Working as designed.

- **`app_user_role()`, `app_profile_id()`, `app_linked_client_id()` (SECURITY DEFINER,
  callable by `authenticated`).** Intentional and required. These are the helpers the
  RLS policies call; they only ever return the *caller's own* role/ID (no data about
  anyone else), and they MUST stay executable by logged-in users or RLS breaks.

- **Tables with RLS enabled and no policies** (e.g. `cold_leads`, `jade_emails`,
  `proposal_documents`, `proposal_document_versions`, `xero_tokens`,
  `xero_approved_transactions`, `xero_ignored_transactions`). Intentional. RLS-on +
  no-policy = deny-all to clients. The app reaches these only via the server-side
  service-role key. This is the *secure* posture, not a gap.

- **`job-photos` storage bucket is public-read.** Accepted for now. These are cleaner
  job-completion photos. Listing is already blocked (no SELECT policy on
  storage.objects), so files can't be enumerated. Residual: someone holding a specific
  photo URL can view it, but URLs live in `job_submissions.photo_urls` (staff-only via
  RLS). Hardening to a private bucket + signed URLs is a known optional follow-up.

- **There is NO `signed-proposals` bucket.** Any report mentioning one is stale/wrong.
  The only bucket is `job-photos`. Signed agreements render on-demand, not from storage.

## Known follow-ups (real, low priority — report only if unchanged for a long time)

- **Leaked-password protection is OFF** (Supabase Auth). Deliberately deferred: clients
  currently share the weak password `corecleaning`, which is in breach lists — enabling
  the check must wait until clients move to stronger/individual logins.
- **`compute_client_profit` (single-site trigger) ignores days-per-week** — margins are
  correct, dollar amounts undercount for multi-day single-site clients. Cosmetic.
