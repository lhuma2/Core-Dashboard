-- Admin-editable display name for a document. Overrides client_name in the
-- admin portal so sent/signed documents can be renamed without touching their
-- signed content (data, pdf_url, signature fields). Null = use client_name.
alter table public.proposal_documents
  add column if not exists title text;

notify pgrst, 'reload schema';
