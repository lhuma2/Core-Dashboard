-- Migration 038 — distinguish company documents vs company SOPs.
alter table company_documents add column if not exists kind text not null default 'document';

-- Move the bundled Bond Clean SOP into the table as a SOP so it's managed the
-- same way as uploads (view + remove), and new SOPs can be added alongside it.
insert into company_documents (name, file_url, kind)
select 'Bond Clean SOP', '/documents/bond-clean-sop.pdf', 'sop'
where not exists (select 1 from company_documents c where c.file_url = '/documents/bond-clean-sop.pdf');
