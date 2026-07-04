-- Opt-in flag for the automatic 5-day cold-lead follow-up email. Set when the
-- intro email is sent with the "5-day follow-up" box ticked; the follow-up cron
-- only sends to leads where this is true.

alter table public.cold_leads
  add column if not exists follow_up_opt_in boolean not null default false;
