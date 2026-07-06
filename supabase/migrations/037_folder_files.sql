-- Migration 037 — arbitrary files uploaded straight into a folder (drag-drop).
create table if not exists folder_files (
  id          uuid primary key default gen_random_uuid(),
  folder_id   uuid references document_folders(id) on delete cascade,
  name        text not null,
  file_url    text not null,
  created_at  timestamptz not null default now()
);

alter table folder_files enable row level security;
do $$ begin
  create policy folder_files_all on folder_files
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

grant all on folder_files to authenticated, service_role;
create index if not exists folder_files_folder_idx on folder_files (folder_id);
