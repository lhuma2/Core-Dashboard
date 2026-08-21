-- ─── Cleaner contact + labeling fields ────────────────────────────────────────
-- Phone number for the "Call" button on the Team page, plus a region
-- (Brisbane / Gold Coast) and a team-leader flag so admins can label cleaners.
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists region text
  check (region in ('brisbane','gold_coast'));
alter table profiles add column if not exists is_team_leader boolean not null default false;
