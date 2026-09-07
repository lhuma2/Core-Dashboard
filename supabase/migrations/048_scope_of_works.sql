-- ─── Scope of works image on a client (or, for multi-site clients, a site) ──
-- Admin-uploaded reference image (e.g. a Snipping Tool screenshot) alongside
-- the existing scope_of_work text field, shown to cleaners assigned to that
-- client/site. Stored path in the existing public "job-photos" bucket.
alter table clients      add column if not exists scope_of_works_image_path text;
alter table client_sites add column if not exists scope_of_works_image_path text;
