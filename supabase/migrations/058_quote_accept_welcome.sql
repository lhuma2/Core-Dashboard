-- Migration 058 — quote → agreement → client → welcome page.
--
-- clients.needs_review: profile was created automatically from a signed agreement;
--   shown as a prompt on the Clients tab until the owner saves it.
-- clients.welcome_code / welcome_sent_at: the commercial client's welcome page
--   (/welcome/<code>), sent once the owner has set their portal login.
-- proposal_documents.client_added_at: a signed residential / end-of-lease agreement
--   has been added on the Clients tab (or the prompt dismissed).
alter table public.clients
  add column if not exists needs_review    boolean not null default false,
  add column if not exists welcome_code    text,
  add column if not exists welcome_sent_at timestamptz;

create unique index if not exists clients_welcome_code_key
  on public.clients (welcome_code)
  where welcome_code is not null;

alter table public.proposal_documents
  add column if not exists client_added_at timestamptz;

notify pgrst, 'reload schema';
