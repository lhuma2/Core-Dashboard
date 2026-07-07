-- Migration 039 — cold_leads columns the app writes on every call log but that
-- were missing from the reconstructed table. Without these, logCallAction's
-- UPDATE failed silently, so a logged outcome never changed the lead's status
-- (the lead never moved to its tab / follow-up).
alter table cold_leads
  add column if not exists call_count              integer not null default 0,
  add column if not exists has_spoken              boolean not null default false,
  add column if not exists next_attempt            date,
  add column if not exists follow_up_note          text,
  add column if not exists intro_email_message_id  text,
  add column if not exists intro_email_subject     text,
  add column if not exists follow_up_email_sent_at timestamptz,
  add column if not exists intro_sms_sent_at        timestamptz,
  add column if not exists comms                   jsonb not null default '[]'::jsonb;
