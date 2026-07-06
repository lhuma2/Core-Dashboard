-- ============================================================
-- CLEAN SLATE — reset the public schema, then restore Supabase's
-- default privileges. Safe on a brand-new project. Run before the
-- migration chain so a partial/failed prior run doesn't cause
-- "already exists" errors.
-- ============================================================
drop schema if exists public cascade;
create schema public;

grant usage on schema public to postgres, anon, authenticated, service_role;
grant all on schema public to postgres, service_role;

alter default privileges in schema public grant all on tables    to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
