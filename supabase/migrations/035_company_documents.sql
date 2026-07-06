-- Migration 035 — company_documents: admin-uploaded standard company files
-- (capability statements, agreements, SOPs, etc.) surfaced on the Documents page.
create table if not exists company_documents (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  file_url    text not null,
  created_at  timestamptz not null default now()
);

alter table company_documents enable row level security;

do $$ begin
  create policy company_documents_read on company_documents
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy company_documents_write on company_documents
    for all to authenticated
    using (app_user_role() in ('admin','manager'))
    with check (app_user_role() in ('admin','manager'));
exception when duplicate_object then null; end $$;

grant all on company_documents to authenticated, service_role;

create index if not exists company_documents_created_idx on company_documents (created_at desc);
