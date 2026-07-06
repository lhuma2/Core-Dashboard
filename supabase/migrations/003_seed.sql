-- Core Cleaning Operations Hub — Seed Data
-- 8 realistic Brisbane commercial cleaning clients

insert into clients (
  business_name, contact_name, contact_email, contact_phone,
  address, suburb, postcode,
  service_type, frequency, rate_per_visit, monthly_value, annual_value,
  start_date, active, notes
) values

-- 1. Mitchelton Dental Centre — fortnightly, general cleaning
-- monthly = 250 × (26/12) = 541.67
(
  'Mitchelton Dental Centre',
  'Jodie',
  'jodie@mitcheltondental.com.au',
  '07 3355 1200',
  '12 Blackwood Street',
  'Mitchelton',
  '4053',
  ARRAY['general_cleaning']::service_type[],
  'fortnightly',
  250.00, 541.67, 6500.00,
  '2023-03-01', true,
  'Access via rear entry. Jodie manages all cleaning communications. Use hospital-grade disinfectant in treatment rooms.'
),

-- 2. Parkside Group — weekly, general cleaning + floor care
-- monthly = 380 × (52/12) = 1646.67
(
  'Parkside Group',
  'Ashleigh Muller',
  'ashleigh.muller@parksidegroup.com.au',
  '07 3844 5500',
  '45 Park Road',
  'Woolloongabba',
  '4102',
  ARRAY['general_cleaning', 'floor_care']::service_type[],
  'weekly',
  380.00, 1646.67, 19760.00,
  '2022-11-15', true,
  'Large commercial office space across 3 floors. Floor care (strip and seal) scheduled quarterly. Contact Ashleigh for after-hours access.'
),

-- 3. Toowong Medical Practice — fortnightly, general cleaning
-- monthly = 210 × (26/12) = 455.00
(
  'Toowong Medical Practice',
  'Sandra Nguyen',
  'admin@toowongmedical.com.au',
  '07 3371 4400',
  '88 Sherwood Road',
  'Toowong',
  '4066',
  ARRAY['general_cleaning']::service_type[],
  'fortnightly',
  210.00, 455.00, 5460.00,
  '2023-06-01', true,
  'Healthcare facility — use hospital-grade products only. No bleach on vinyl flooring. Reception area must be spotless by 7:30am.'
),

-- 4. Ascot Hair and Beauty — monthly, general cleaning
-- monthly = 400 × 1 = 400.00
(
  'Ascot Hair and Beauty',
  'Melissa Park',
  'mel@ascothairandbeauty.com.au',
  '07 3268 1100',
  '3 Racecourse Road',
  'Ascot',
  '4007',
  ARRAY['general_cleaning']::service_type[],
  'monthly',
  400.00, 400.00, 4800.00,
  '2024-01-10', true,
  'Salon cleaning. Pay close attention to mirrors, basins, and styling stations. Key held on file.'
),

-- 5. Fortitude Valley Co-Work — weekly, general cleaning + window cleaning
-- monthly = 290 × (52/12) = 1256.67
(
  'Fortitude Valley Co-Work',
  'Tom Briggs',
  'tom@fvcw.com.au',
  '07 3252 9900',
  '200 Brunswick Street',
  'Fortitude Valley',
  '4006',
  ARRAY['general_cleaning', 'window_cleaning']::service_type[],
  'weekly',
  290.00, 1256.67, 15080.00,
  '2023-09-01', true,
  'Coworking space — shared desks and private offices. Window cleaning done quarterly. Tom prefers early morning cleans before 7am.'
),

-- 6. Cannon Hill Accounting — fortnightly, general cleaning
-- monthly = 175 × (26/12) = 379.17
(
  'Cannon Hill Accounting',
  'Ray Torrisi',
  'ray@cannonhillaccounting.com.au',
  '07 3399 2211',
  '1 Wynnum Road',
  'Cannon Hill',
  '4170',
  ARRAY['general_cleaning']::service_type[],
  'fortnightly',
  175.00, 379.17, 4550.00,
  '2024-02-15', true,
  'Small accounting firm. 4 offices + boardroom + kitchenette. Access code: provided on site.'
),

-- 7. Eagle Farm Logistics — weekly, general cleaning + pressure washing
-- monthly = 420 × (52/12) = 1820.00
(
  'Eagle Farm Logistics',
  'Darren Walsh',
  'darren.walsh@eaglelogistics.com.au',
  '07 3868 4400',
  '15 Holt Street',
  'Eagle Farm',
  '4009',
  ARRAY['general_cleaning', 'pressure_washing']::service_type[],
  'weekly',
  420.00, 1820.00, 21840.00,
  '2022-07-01', true,
  'Warehouse + office complex. Pressure wash loading dock and external hardstand quarterly. Forklift bays require extra attention. 24/7 operations — coordinate with Darren for scheduling.'
),

-- 8. Newstead Cafe Group — monthly, general cleaning + hygiene bins
-- monthly = 550 × 1 = 550.00
(
  'Newstead Cafe Group',
  'Priya Sharma',
  'priya@newsteadcafe.com.au',
  '07 3252 6600',
  '22 Longland Street',
  'Newstead',
  '4006',
  ARRAY['general_cleaning', 'hygiene_bins']::service_type[],
  'monthly',
  550.00, 550.00, 6600.00,
  '2023-12-01', true,
  'Café and event space. Hygiene bins serviced same visit. Deep clean grease traps and kitchen surfaces monthly. Café opens at 6am — complete by 5:45am.'
);

-- Seed some survey results
insert into surveys (client_id, submitted_at, quality_score, reliability_score, communication_score, value_score, comments)
select
  c.id,
  now() - interval '60 days',
  9, 9, 8, 8,
  'Very happy with the service. Always on time and thorough.'
from clients c where c.business_name = 'Mitchelton Dental Centre';

insert into surveys (client_id, submitted_at, quality_score, reliability_score, communication_score, value_score, comments)
select
  c.id,
  now() - interval '45 days',
  8, 9, 9, 8,
  'Consistent and professional. Floor care results are excellent.'
from clients c where c.business_name = 'Parkside Group';

insert into surveys (client_id, submitted_at, quality_score, reliability_score, communication_score, value_score, comments)
select
  c.id,
  now() - interval '30 days',
  7, 8, 7, 8,
  'Good overall. A couple of areas missed last visit but communication was prompt.'
from clients c where c.business_name = 'Eagle Farm Logistics';

insert into surveys (client_id, submitted_at, quality_score, reliability_score, communication_score, value_score, comments)
select
  c.id,
  now() - interval '20 days',
  10, 10, 9, 9,
  'Outstanding service. The team always goes above and beyond.'
from clients c where c.business_name = 'Fortitude Valley Co-Work';

-- Seed some financial records (income from active clients, last 6 months)
insert into financial_records (client_id, record_date, amount, type, category, description)
select c.id, (date_trunc('month', now()) - interval '5 months')::date, c.monthly_value, 'income', 'Contract Cleaning', 'Monthly contract — ' || c.business_name
from clients c where c.active = true;

insert into financial_records (client_id, record_date, amount, type, category, description)
select c.id, (date_trunc('month', now()) - interval '4 months')::date, c.monthly_value, 'income', 'Contract Cleaning', 'Monthly contract — ' || c.business_name
from clients c where c.active = true;

insert into financial_records (client_id, record_date, amount, type, category, description)
select c.id, (date_trunc('month', now()) - interval '3 months')::date, c.monthly_value, 'income', 'Contract Cleaning', 'Monthly contract — ' || c.business_name
from clients c where c.active = true;

insert into financial_records (client_id, record_date, amount, type, category, description)
select c.id, (date_trunc('month', now()) - interval '2 months')::date, c.monthly_value, 'income', 'Contract Cleaning', 'Monthly contract — ' || c.business_name
from clients c where c.active = true;

insert into financial_records (client_id, record_date, amount, type, category, description)
select c.id, (date_trunc('month', now()) - interval '1 month')::date, c.monthly_value, 'income', 'Contract Cleaning', 'Monthly contract — ' || c.business_name
from clients c where c.active = true;

insert into financial_records (client_id, record_date, amount, type, category, description)
select c.id, date_trunc('month', now())::date, c.monthly_value, 'income', 'Contract Cleaning', 'Monthly contract — ' || c.business_name
from clients c where c.active = true;

-- Seed some expenses
insert into financial_records (client_id, record_date, amount, type, category, description) values
(null, (date_trunc('month', now()) - interval '5 months')::date, 850.00, 'expense', 'Supplies', 'Monthly cleaning supplies — chemicals, mops, cloths'),
(null, (date_trunc('month', now()) - interval '5 months')::date, 320.00, 'expense', 'Equipment', 'Vacuum cleaner replacement bags and filters'),
(null, (date_trunc('month', now()) - interval '4 months')::date, 920.00, 'expense', 'Supplies', 'Monthly cleaning supplies'),
(null, (date_trunc('month', now()) - interval '4 months')::date, 180.00, 'expense', 'Fuel', 'Vehicle fuel — service runs'),
(null, (date_trunc('month', now()) - interval '3 months')::date, 780.00, 'expense', 'Supplies', 'Monthly cleaning supplies'),
(null, (date_trunc('month', now()) - interval '3 months')::date, 450.00, 'expense', 'Equipment', 'Pressure washer maintenance and hose replacement'),
(null, (date_trunc('month', now()) - interval '2 months')::date, 870.00, 'expense', 'Supplies', 'Monthly cleaning supplies'),
(null, (date_trunc('month', now()) - interval '2 months')::date, 210.00, 'expense', 'Fuel', 'Vehicle fuel — service runs'),
(null, (date_trunc('month', now()) - interval '1 month')::date, 830.00, 'expense', 'Supplies', 'Monthly cleaning supplies'),
(null, (date_trunc('month', now()) - interval '1 month')::date, 150.00, 'expense', 'Admin', 'Insurance premium instalment'),
(null, date_trunc('month', now())::date, 900.00, 'expense', 'Supplies', 'Monthly cleaning supplies'),
(null, date_trunc('month', now())::date, 195.00, 'expense', 'Fuel', 'Vehicle fuel — service runs');

-- Seed some SOPs
insert into sops (title, category, content, version, active) values

('General Office Cleaning Procedure', 'General Cleaning',
'## General Office Cleaning Procedure

### Equipment Required
- Microfibre cloths (colour-coded)
- Vacuum cleaner with attachments
- Mop and bucket
- All-purpose cleaner
- Glass cleaner
- Disinfectant spray
- Rubbish bin liners

### Procedure

#### 1. Preparation
- Don PPE: gloves, non-slip footwear
- Gather all equipment before entering the premises
- Check the site-specific notes in the Core Cleaning Operations Hub

#### 2. Rubbish Removal
- Remove rubbish from all bins
- Replace bin liners
- Take to building waste point

#### 3. Dusting
- Dust all horizontal surfaces top-to-bottom
- Include shelves, window sills, light fittings, and picture frames
- Use damp cloth on desks and hard surfaces

#### 4. Vacuuming
- Vacuum all carpeted areas
- Use crevice tool for edges and corners
- Vacuum fabric chairs and soft furnishings

#### 5. Hard Floor Mopping
- Sweep or vacuum first
- Mop with appropriate solution for floor type
- Allow to dry before replacing furniture

#### 6. Toilets and Amenities
- Clean and disinfect toilets, sinks, and benches
- Restock paper products and soap
- Empty sanitary bins if applicable

#### 7. Kitchen/Kitchenette
- Wipe benches and splashbacks
- Clean sink
- Wipe exterior of appliances
- Empty dishwasher if applicable

#### 8. Final Check
- Walk through all areas
- Ensure all lights are off and doors are locked as per site instructions
- Record completion in the site log',
1, true),

('Pressure Washing Procedure', 'Pressure Washing',
'## Pressure Washing Procedure

### Equipment Required
- Commercial pressure washer (minimum 2000 PSI)
- Extension wand
- Surface cleaner attachment
- Safety glasses and waterproof PPE
- Degreaser (for oil stains)
- Wet/dry vacuum (optional)

### Pre-Job Safety Check
- Inspect hoses and fittings for damage
- Confirm water connection point with site manager
- Identify electrical hazards — cover or avoid power outlets
- Ensure area is cleared of personnel and vehicles

### Procedure

#### 1. Pre-Treatment
- Apply degreaser to oil or grease stains
- Allow 5–10 minutes dwell time

#### 2. Pressure Washing
- Start from high point and work down
- Use 40° fan tip for general surfaces
- Use 15° tip for stubborn stains
- Keep wand at consistent 30cm distance

#### 3. Drainage
- Direct wash water toward drains
- Do not allow chemical runoff into garden beds or gutters

#### 4. Post-Wash Inspection
- Inspect all areas cleaned
- Touch up any missed spots
- Allow surface to dry before reopening to traffic

### Waste Disposal
All chemical wash water must be directed to a trade waste drain. Do not allow to enter stormwater.',
1, true),

('Window Cleaning Procedure', 'Window Cleaning',
'## Window Cleaning Procedure

### Equipment Required
- Squeegee (various sizes)
- Window cleaning applicator/washer
- Bucket with window cleaning solution
- Telescopic pole
- Microfibre cloths (lint-free)
- Ladder (if required — must be rated and inspected)

### Safety
- Never work on a wet ladder
- Two-person team required for any work above 2m
- Check weather — do not clean in direct sunlight (streak risk)

### Procedure

#### 1. Internal Windows
- Apply cleaning solution with applicator
- Squeegee from top to bottom in single strokes
- Wipe squeegee blade between strokes
- Detail edges with microfibre cloth
- Wipe sills and frames

#### 2. External Windows (Ground Level)
- Same technique as internal
- Remove cobwebs from frames first
- Pay attention to bird marks and mineral deposits (use appropriate remover)

#### 3. External Windows (Height)
- Use telescopic pole with correct attachments
- Work in sections
- Rinse pole and attachments between sections

#### 4. Final Inspection
- Inspect from inside — look for streaks
- Check frames and sills are dry and clean',
1, true),

('Floor Care — Strip and Seal', 'Floor Care',
'## Floor Care — Strip and Seal Procedure

### When to Use
- Vinyl/linoleum floors requiring complete resurfacing
- Typically performed quarterly or annually depending on traffic

### Equipment Required
- Floor stripping machine (low-speed buffer)
- Wet/dry vacuum
- Mop and buckets (separate for stripper and rinse)
- Floor stripper solution
- Neutral floor cleaner
- Floor sealer
- Floor finish/polish
- Non-slip signage

### Procedure

#### 1. Preparation
- Clear all furniture from area
- Place wet floor signs
- Dilute stripper per manufacturer instructions

#### 2. Stripping
- Apply stripper solution evenly
- Allow 5–10 minutes dwell
- Agitate with buffer fitted with stripping pad
- Vacuum up slurry immediately
- Repeat if old finish remains
- Rinse floor thoroughly with clean water
- Allow to dry completely (minimum 30 minutes)

#### 3. Sealing
- Apply sealer in thin, even coats
- Allow each coat to dry before applying next (20–30 mins)
- Minimum 2 coats of sealer

#### 4. Finishing
- Apply finish in thin even coats
- Minimum 3–4 coats for high-traffic areas
- Final coat must be fully dry before foot traffic (2 hours minimum)

### Quality Check
- Surface should have uniform sheen
- No swirl marks or applicator lines
- Test slip resistance before reopening',
1, true),

('Hygiene Bin Service Procedure', 'Hygiene Bins',
'## Sanitary/Hygiene Bin Service Procedure

### PPE Required
- Heavy-duty gloves (mandatory)
- Apron
- Eye protection if applicable
- Closed-toe footwear

### Procedure

#### 1. Collection
- Use sealed waste bags for all bin contents
- Do not compress waste — fill bag and seal immediately
- Label bags as clinical/sanitary waste
- Transport in sealed container to vehicle

#### 2. Bin Cleaning
- Spray interior of bin with disinfectant
- Wipe interior and exterior with disinfectant cloth
- Allow to dry

#### 3. Re-lining
- Place fresh liner in each bin
- Ensure liner is secured at rim

#### 4. Waste Disposal
- All sanitary waste must be disposed of via licensed clinical waste contractor
- Do not place in general waste

### Record Keeping
- Record service date and bin locations serviced
- Report any bins that are unusually full or damaged',
1, true);
