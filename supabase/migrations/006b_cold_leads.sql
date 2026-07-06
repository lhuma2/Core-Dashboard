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
