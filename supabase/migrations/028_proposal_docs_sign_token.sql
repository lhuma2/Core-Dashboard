-- Migration 028 — custom in-app e-signing (replaces DocuSign).
-- A unique sign_token generates the client's signing link (/sign/<token>). When the
-- client types their name and confirms, we stamp signed_name/at/ip and set status='signed'.
-- Already applied to prod via connector.
alter table public.proposal_documents
  add column if not exists sign_token   uuid,
  add column if not exists signer_email text,
  add column if not exists signed_name  text,
  add column if not exists signed_at    timestamptz,
  add column if not exists signed_ip    text;

create unique index if not exists proposal_documents_sign_token_key
  on public.proposal_documents (sign_token)
  where sign_token is not null;
