-- ============================================================
-- 061_move_residential_from_old_hub.sql
-- Copies the old hub's residential clients (residential_jobs) into the new homes / home_history / jobs
-- tables. Run once at switch-over. Safe to re-run: each home is keyed on old_hub_id, so nothing doubles.
-- The old residential_jobs rows are left exactly as they are.
--
-- Rules (agreed with Laith, 11 Nov 2026; see go-live-wiring.md "Moving residential clients"):
--  * A row with no parent_id is the client. Rows with a parent_id are cleans of that client.
--  * "Jack/Sabrina" style names become "Jack and Sabrina".
--  * address "Street, Suburb 4066[, phone]" -> street / suburb / postcode. A phone number typed into the
--    address is dropped. Suburbs typed without a postcode get it from the small list below.
--  * contact_phone: +61 -> 0, formatted 04xx xxx xxx.
--  * no frequency = one-off. Days are lower-cased (Fri -> fri).
--  * A start time before 5:00 am was a typing slip for pm (Carolyn Ash had 01:30) and becomes pm.
--  * cleaner_cost -> cost. Client price wasn't stored, except a "Fee: $x" line in the comments.
--  * "Frequency:" and "Fee:" lines are dropped from the notes (they're now proper fields).
--  * One-offs dated before today are moved as finished; if the old hub never marked them completed,
--    their history says so.
-- ============================================================

with parents as (
  select * from public.residential_jobs where parent_id is null
),
known_postcodes(suburb, postcode) as (
  values ('carina','4152'), ('rochedale south','4123')
),
parsed as (
  select p.*,
    trim(split_part(p.address, ',', 1))                                             as street_p,
    trim(split_part(p.address, ',', 2))                                             as rest_p,
    regexp_replace(p.contact_phone, '\s+', '', 'g')                                 as phone_raw
  from parents p
),
cleaned as (
  select x.*,
    trim(regexp_replace(x.rest_p, '\s*\d{4}\s*$', ''))                              as suburb_c,
    substring(x.rest_p from '(\d{4})\s*$')                                          as postcode_c,
    regexp_replace(case when x.phone_raw like '+61%' then '0' || substring(x.phone_raw from 4) else x.phone_raw end, '[^0-9]', '', 'g') as phone_d
  from parsed x
)
insert into public.homes (division, name, phone, street, suburb, state, postcode, kind, every, days, anchor, first_clean,
                          start_time, price, cost, cleaner_id, beds, baths, carpet_rooms, hallways, notes, status, done, old_hub_id)
select
  'res',
  regexp_replace(trim(c.client_name), '\s*/\s*', ' and ', 'g'),
  case when length(c.phone_d) = 10 and c.phone_d like '04%' then substr(c.phone_d,1,4)||' '||substr(c.phone_d,5,3)||' '||substr(c.phone_d,8,3)
       when length(c.phone_d) = 10 then substr(c.phone_d,1,2)||' '||substr(c.phone_d,3,4)||' '||substr(c.phone_d,7,4)
       else nullif(c.phone_d,'') end,
  c.street_p,
  c.suburb_c,
  'QLD',
  coalesce(c.postcode_c, (select k.postcode from known_postcodes k where k.suburb = lower(c.suburb_c))),
  case when c.frequency is null or c.frequency = '' then 'oneoff' else 'recurring' end,
  nullif(c.frequency, ''),
  coalesce(array(select lower(d) from unnest(c.service_days) d), '{}'),
  case when c.frequency is null or c.frequency = '' then null else c.clean_date end,
  c.clean_date,
  case when c.clean_time < time '05:00' then c.clean_time + interval '12 hours' else c.clean_time end,
  coalesce((substring(c.comments from 'Fee:\s*\$\s*([0-9]+(?:\.[0-9]{1,2})?)'))::numeric, 0),
  coalesce(c.cleaner_cost, 0),
  c.cleaner_id,
  c.bedrooms, c.bathrooms, coalesce(c.carpet_steam_rooms, 0), coalesce(c.carpet_steam_hallways, 0),
  nullif(trim(regexp_replace(c.comments, '^\s*(Frequency|Fee):[^\n]*\n?', '', 'gm')), ''),
  'active',
  (c.frequency is null or c.frequency = '') and c.clean_date < current_date,
  c.id
from cleaned c
on conflict (old_hub_id) do nothing;

-- History: first clean, each later clean, any one-off that was never marked finished, and the move itself.
insert into public.home_history (home_id, date, text)
select h.id, r.clean_date,
  case when r.parent_id is null then 'First clean' || case when r.status = 'completed' or exists (
              select 1 from public.residential_jobs k where k.parent_id = r.id and k.clean_date = r.clean_date and k.status = 'completed') then ', done' else '' end
       when r.status = 'completed' then 'Clean done'
       else 'Clean booked in the old hub' end
       || case when r.parent_id is null and h.kind = 'oneoff' and r.status <> 'completed' and r.clean_date < current_date
               then ' (the old hub never marked it finished)' else '' end
from public.residential_jobs r
join public.homes h on h.old_hub_id = coalesce(r.parent_id, r.id)
where not exists (select 1 from public.home_history x where x.home_id = h.id and x.text like 'Moved across from the old hub%')
  -- the parent row of a recurring client and its same-day child describe the same clean: keep one
  and not (r.parent_id is not null and exists (select 1 from public.residential_jobs pp where pp.id = r.parent_id and pp.clean_date = r.clean_date));

insert into public.home_history (home_id, date, text)
select h.id, current_date, 'Moved across from the old hub'
from public.homes h
where h.old_hub_id is not null
  and not exists (select 1 from public.home_history x where x.home_id = h.id and x.text = 'Moved across from the old hub');

-- Past cleans that were finished become done jobs, so they show on the calendar and in the cleaner's history.
insert into public.jobs (type, home_id, clean_date, start_time, status, started_at, finished_at)
select 'residential', h.id, r.clean_date, h.start_time, 'done', r.started_at, r.finished_at
from public.residential_jobs r
join public.homes h on h.old_hub_id = coalesce(r.parent_id, r.id)
where r.status = 'completed'
  and not exists (select 1 from public.jobs j where j.home_id = h.id and j.clean_date = r.clean_date);

insert into public.job_cleaners (job_id, cleaner_id)
select j.id, h.cleaner_id
from public.jobs j join public.homes h on h.id = j.home_id
where h.old_hub_id is not null and h.cleaner_id is not null
on conflict do nothing;
