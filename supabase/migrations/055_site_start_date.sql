-- Migration 055 — First clean date per commercial site.
-- The cleaner portal schedules a site's recurring cleans from this date onward
-- (falls back to the client's start_date when unset).

alter table public.client_sites
  add column if not exists start_date date;
