-- Migration 052 — prospects (Apollo/Lusha lead sourcing for Sales)
-- Manually-triggered search results from Apollo.io and Lusha, saved by the
-- user for cold calling. Service-role only (RLS enabled, no policies) — same
-- pattern as cold_leads/tenders; the app reaches it via the admin client only.
--
-- status:
--   saved     — kept for cold calling
--   dismissed — reviewed and not relevant

create table if not exists prospects (
  id                uuid primary key default gen_random_uuid(),
  source            text not null check (source in ('apollo', 'lusha')),
  external_id       text not null,              -- provider's person/contact id — used to dedupe
  company_name      text,
  company_domain    text,
  contact_name      text,
  job_title         text,
  location          text,
  linkedin_url      text,
  email             text,
  phone             text,
  status            text not null default 'saved' check (status in ('saved', 'dismissed')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists prospects_source_external_id_key on prospects (source, external_id);
create index if not exists prospects_status_idx on prospects (status);

alter table prospects enable row level security;
