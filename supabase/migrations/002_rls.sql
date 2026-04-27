-- Delta Operations Hub — Row Level Security
-- Single-tenant internal tool: all authenticated users have full access

-- Enable RLS on all tables
alter table clients enable row level security;
alter table documents enable row level security;
alter table financial_records enable row level security;
alter table sops enable row level security;
alter table surveys enable row level security;

-- Clients policies
create policy "clients_select" on clients for select to authenticated using (true);
create policy "clients_insert" on clients for insert to authenticated with check (true);
create policy "clients_update" on clients for update to authenticated using (true);
create policy "clients_delete" on clients for delete to authenticated using (true);

-- Documents policies
create policy "documents_select" on documents for select to authenticated using (true);
create policy "documents_insert" on documents for insert to authenticated with check (true);
create policy "documents_update" on documents for update to authenticated using (true);
create policy "documents_delete" on documents for delete to authenticated using (true);

-- Financial records policies
create policy "financial_records_select" on financial_records for select to authenticated using (true);
create policy "financial_records_insert" on financial_records for insert to authenticated with check (true);
create policy "financial_records_update" on financial_records for update to authenticated using (true);
create policy "financial_records_delete" on financial_records for delete to authenticated using (true);

-- SOPs policies
create policy "sops_select" on sops for select to authenticated using (true);
create policy "sops_insert" on sops for insert to authenticated with check (true);
create policy "sops_update" on sops for update to authenticated using (true);
create policy "sops_delete" on sops for delete to authenticated using (true);

-- Surveys policies
create policy "surveys_select" on surveys for select to authenticated using (true);
create policy "surveys_insert" on surveys for insert to authenticated with check (true);
create policy "surveys_update" on surveys for update to authenticated using (true);
create policy "surveys_delete" on surveys for delete to authenticated using (true);
