-- Migration 015 — Remove broad listing on the public job-photos bucket.
-- (Applied to prod 2026-06-29.)
--
-- The job-photos bucket is public, so images are served via getPublicUrl with no
-- SELECT policy required, and the app never calls .list() on it. This SELECT policy
-- only allowed any authenticated user to enumerate ALL files (advisor finding
-- public_bucket_allows_listing). Removing it has no effect on uploads (INSERT policy
-- retained) or on photo display (public URLs).
DROP POLICY IF EXISTS "authenticated can read job photos" ON storage.objects;
