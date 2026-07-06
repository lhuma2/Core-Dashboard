-- Migration 036 — folders for organising signed documents.
create table if not exists document_folders (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table proposal_documents
  add column if not exists folder_id uuid references document_folders(id) on delete set null;

alter table document_folders enable row level security;
do $$ begin
  create policy document_folders_all on document_folders
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

grant all on document_folders to authenticated, service_role;
create index if not exists proposal_documents_folder_idx on proposal_documents (folder_id);
