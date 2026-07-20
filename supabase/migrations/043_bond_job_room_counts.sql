-- ─── Bed/bath + carpet steam cleaning counts for Bond Clients ────────────────
-- Lets the office record how many bedrooms/bathrooms are in the property, and
-- how many rooms/hallways need a carpet steam clean, when a bond clean is added.
alter table bond_jobs add column if not exists bedrooms smallint check (bedrooms between 0 and 7);
alter table bond_jobs add column if not exists bathrooms smallint check (bathrooms between 0 and 7);
alter table bond_jobs add column if not exists carpet_steam_rooms smallint check (carpet_steam_rooms between 0 and 7);
alter table bond_jobs add column if not exists carpet_steam_hallways smallint check (carpet_steam_hallways between 0 and 7);
