-- Migration 029 — friendly signing links. A short human-readable code
-- (e.g. "northpoint-commercial-k7m2qp") drives /sign/<code> instead of a raw UUID.
-- Already applied to prod via connector.
alter table public.proposal_documents
  add column if not exists sign_code text;

create unique index if not exists proposal_documents_sign_code_key
  on public.proposal_documents (sign_code)
  where sign_code is not null;
