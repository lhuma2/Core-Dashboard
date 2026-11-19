-- 073: a cleaner covered under Core Cleaning's own public liability policy (Team → "Covered by my insurance").
-- Safe to re-run. Additive only: off for everyone already sent or signed, so nothing changes for them.
-- When it's on, the pack page doesn't ask for their insurance, clause 4 of the agreement says they're covered by
-- Core Cleaning (and pay the excess on claims from their work), and the signed pack shows it.
alter table public.cleaner_packs add column if not exists covered_by_core boolean not null default false;
