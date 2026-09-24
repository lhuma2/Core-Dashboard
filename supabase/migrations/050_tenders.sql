-- Migration 050 — tenders (government tender board for Sales)
-- Auto-sourced from AusTender + QTenders, filtered to residential/commercial/
-- end-of-lease cleaning + pressure washing. Service-role only (RLS enabled,
-- no policies) — same pattern as cold_leads; the app reaches it via the admin
-- client only.
--
-- status:
--   candidate — fetched and relevance-filtered, sitting in the buffer
--   active    — one of the 10 shown on the /tenders board
--   done      — ticked off by the user, or auto-expired past its close date

create table if not exists tenders (
  id                uuid primary key default gen_random_uuid(),
  source            text not null check (source in ('austender', 'qtenders')),
  external_id       text not null,              -- ATM ID / VP reference — used to dedupe across refreshes
  title             text not null,
  issuer            text,                        -- agency / department
  category          text,
  summary           text,                        -- short plain-text description
  location          text,
  status            text not null default 'candidate' check (status in ('candidate', 'active', 'done')),
  open_date         date,
  close_date        date,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  url               text not null,               -- link back to the listing on the source site
  activated_at      timestamptz,
  ticked_off_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists tenders_source_external_id_key on tenders (source, external_id);
create index if not exists tenders_status_idx     on tenders (status);
create index if not exists tenders_close_date_idx  on tenders (close_date);

alter table tenders enable row level security;
