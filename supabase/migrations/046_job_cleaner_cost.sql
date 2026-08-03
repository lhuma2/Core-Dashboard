-- ─── Cleaner cost on one-off bond/residential jobs ────────────────────────────
-- These job types have no revenue field (that's invoiced directly in Xero), but
-- nothing previously tracked what the cleaner was paid for the job. This powers
-- the "Cleaner Pay" line the Xero P&L widget subtracts from Xero revenue.
alter table bond_jobs        add column if not exists cleaner_cost numeric(10,2);
alter table residential_jobs add column if not exists cleaner_cost numeric(10,2);
