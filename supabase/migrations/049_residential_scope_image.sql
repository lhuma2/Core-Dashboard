-- ─── Scope of works image on a residential job/client row ──────────────────
-- Same idea as migration 048 (clients / client_sites), but residential
-- clients don't have a separate parent record — the residential_jobs row
-- itself (template or one-off) IS the client, so the image lives here.
alter table residential_jobs add column if not exists scope_of_works_image_path text;
