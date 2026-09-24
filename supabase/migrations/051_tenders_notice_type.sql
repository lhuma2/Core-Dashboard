-- Migration 051 — tenders.notice_type
-- Distinguishes a normal open tender from a "pipeline" notice (Forward
-- Procurement Notice / Prior Informative Notice etc) — advance warning that
-- a tender is coming, not yet something you can respond to.

alter table tenders add column if not exists notice_type text not null default 'tender'
  check (notice_type in ('tender', 'pipeline'));
