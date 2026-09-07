-- ─── Scope of works image on a job assignment ──────────────────────────────
-- Admin-uploaded reference image (e.g. a Snipping Tool screenshot) shown to
-- the assigned cleaner on their job page. Stored path in the existing
-- public "job-photos" bucket, same pattern as job_photos.storage_path.
alter table job_assignments add column if not exists scope_of_works_path text;
