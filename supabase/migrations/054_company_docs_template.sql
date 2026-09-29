-- Migration 054 — company document templates.
-- A company document with a `template` (editable field definitions) can be picked
-- under "New proposal" and filled in with text boxes that draw straight onto the PDF.
alter table company_documents add column if not exists template jsonb;
