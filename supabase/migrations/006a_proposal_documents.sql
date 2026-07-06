-- Migration 006a — proposal_documents + proposal_document_versions
-- These tables are used throughout the app (src/actions/proposal-docs.ts and the
-- documents portal) and are altered by later migrations (013 RLS/indexes, 028
-- sign_token, 029 sign_code, 030 onboarding) — but no earlier migration created
-- them. This backfills the base tables so the migration chain applies cleanly.

create table if not exists proposal_documents (
  id                    uuid primary key default gen_random_uuid(),
  kind                  text not null default 'proposal',   -- proposal | agreement | one_off | capability
  status                text not null default 'draft',
  ref_number            text,
  client_name           text,
  data                  jsonb,
  source_id             uuid,                                 -- proposal a converted agreement came from
  client_id             uuid references clients(id) on delete set null,
  lead_id               uuid references leads(id) on delete set null,
  pdf_url               text,
  signed_pdf_url        text,
  docusign_envelope_id  text,
  sent_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists proposal_documents_kind_idx    on proposal_documents (kind);
create index if not exists proposal_documents_status_idx  on proposal_documents (status);

-- Version snapshots for the document editor's "restore previous version" feature.
create table if not exists proposal_document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references proposal_documents(id) on delete cascade,
  data         jsonb,
  label        text,
  created_at   timestamptz not null default now()
);

create index if not exists proposal_document_versions_document_id_idx
  on proposal_document_versions (document_id);
