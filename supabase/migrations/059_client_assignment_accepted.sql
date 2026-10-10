-- Migration 059 — Make sure clients.assignment_accepted exists.
--
-- The cleaner portal has used this flag since the first commit (pending vs accepted
-- client assignments), but no migration ever created it. Idempotent: a no-op where
-- the column is already there. Existing assignments are treated as accepted so no
-- cleaner suddenly loses a client they've been working; new assignments start pending.

alter table public.clients
  add column if not exists assignment_accepted boolean;

update public.clients set assignment_accepted = true
  where assignment_accepted is null and assigned_cleaner_id is not null;

alter table public.clients
  alter column assignment_accepted set default false;
