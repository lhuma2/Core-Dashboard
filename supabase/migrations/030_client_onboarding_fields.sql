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
