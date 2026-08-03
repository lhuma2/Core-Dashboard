-- ─── Ongoing/recurring residential cleans ─────────────────────────────────────
-- A residential_jobs row is now either:
--   - a one-off job (frequency null, parent_id null) — unchanged from before, or
--   - a recurring TEMPLATE (frequency set, parent_id null) — clean_date is the
--     start-date anchor and clean_time the recurring time-of-day; it has no
--     status/started_at/finished_at of its own, or
--   - a generated INSTANCE of a template for one specific date (frequency null,
--     parent_id = the template's id) — tracked exactly like a one-off job.
alter table residential_jobs add column if not exists frequency text
  check (frequency is null or frequency in ('weekly', 'fortnightly', 'monthly'));
alter table residential_jobs add column if not exists service_days text[] not null default '{}';
alter table residential_jobs add column if not exists parent_id uuid references residential_jobs(id) on delete cascade;

create index if not exists residential_jobs_parent_idx on residential_jobs (parent_id);
