-- job_submissions columns the app writes/reads that no earlier migration created.
-- Without video_urls, every cleaner submit failed with
-- "Could not find the 'video_urls' column of 'job_submissions' in the schema cache".
alter table public.job_submissions
  add column if not exists video_urls        jsonb not null default '[]'::jsonb,
  add column if not exists completed_by_name text,
  add column if not exists completed_by_role text
    check (completed_by_role in ('cleaner','admin','manager')),
  add column if not exists submitted_at      timestamptz;

notify pgrst, 'reload schema';
