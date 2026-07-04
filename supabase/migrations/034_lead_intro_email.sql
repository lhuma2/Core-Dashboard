-- Capability-statement intro email + 5-day follow-up for pipeline leads, mirroring
-- the cold_leads fields. Sent from the lead profile; the follow-up cron picks up
-- opted-in leads.

alter table public.leads
  add column if not exists intro_email_sent_at     timestamptz,
  add column if not exists intro_email_message_id  text,
  add column if not exists intro_email_subject      text,
  add column if not exists follow_up_email_sent_at  timestamptz,
  add column if not exists follow_up_opt_in          boolean not null default false;
