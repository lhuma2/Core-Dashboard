// Core Cleaning — Safe Work Method Statements (SWMS) + compliance policies.
// Standard, Australian-WHS-aligned content baked in as Core Cleaning's safety library.
// These are templates: review and tailor to actual site conditions, chemicals
// and equipment before relying on them (see the note rendered on each document).

export interface SwmsRow {
  hazard: string
  risk: string
  controls: string[]
  ppe: string[]
  emergency: string
}

export interface Swms {
  code: string
  title: string
  scope: string
  rows: SwmsRow[]
  chemicals?: string[]   // named products this SWMS applies to (e.g. Chemical Handling)
}

// ─── Document governance (applies to every SWMS + policy) ──────────────────────
export const DOC_CONTROL = {
  version: '1.0',
  issueDate: '04/07/2026',
  reviewDate: '04/07/2027',
  approvedBy: 'Laith Humadi, Director',
}

export const COMPANY = {
  name: 'Core Cleaning',
  abn: '',
  location: 'Brisbane, QLD',
  email: 'contact@corecleaning.services',
  web: 'www.corecleaning.services',
  phone: '0407 026 360',
}

export const LEGISLATION =
  'This document has been prepared in accordance with the Work Health and Safety Act 2011 (Qld) and associated regulations.'

export const REVIEW_TRIGGERS = [
  'Every 12 months',
  'Following an incident',
  'Following a significant change in work methods',
  'Following introduction of new equipment or chemicals',
]

export const EMERGENCY_CONTACTS = [
  { label: 'Emergency', value: '000' },
  { label: 'Poisons Information Centre', value: '13 11 26' },
  { label: 'Core Cleaning Management', value: COMPANY.phone },
]

export const SWMS_LIST: Swms[] = [
  {
    code: 'SWMS 001',
    title: 'Commercial Cleaning Operations',
    scope: 'General commercial cleaning of offices, clinics, retail and shared spaces.',
    rows: [
      {
        hazard: 'Wet or slippery floors during and after mopping',
        risk: 'Slips, trips and falls — sprains, fractures, bruising',
        controls: ['Place "Wet Floor" signs before starting', 'Mop in sections, leaving a dry walkway', 'Work in low-traffic periods where possible', 'Dry high-traffic areas promptly'],
        ppe: ['Slip-resistant footwear'],
        emergency: 'Assist anyone who falls, do not move them if injured; call 000 for serious injury and record the incident.',
      },
      {
        hazard: 'Cleaning chemicals (contact, splash, inhalation)',
        risk: 'Skin/eye irritation, respiratory irritation, burns',
        controls: ['Follow the Safety Data Sheet (SDS) for every product', 'Use correct dilution ratios — never mix products', 'Ensure ventilation when using strong chemicals', 'Keep chemicals labelled and lidded'],
        ppe: ['Chemical-resistant gloves', 'Safety glasses'],
        emergency: 'Flush skin/eyes with water for 15 minutes; refer to the SDS first-aid section; seek medical help if symptoms persist.',
      },
      {
        hazard: 'Manual handling of equipment, bins and stock',
        risk: 'Muscular strain, back injury',
        controls: ['Use correct lifting technique — bend knees, keep load close', 'Use trolleys for heavy or bulky loads', 'Team-lift anything over safe limits', 'Empty bins before they are overfull'],
        ppe: ['Gloves', 'Enclosed footwear'],
        emergency: 'Stop work, rest the injured area, apply first aid; report strains promptly so they can be managed early.',
      },
      {
        hazard: 'Electrical equipment and trailing cords (vacuums, machines)',
        risk: 'Electric shock, trips',
        controls: ['Visually check leads/plugs before use — tag out damaged gear', 'Keep cords clear of walkways and water', 'Use only tested-and-tagged equipment', 'Never operate electrical gear with wet hands'],
        ppe: ['Enclosed footwear'],
        emergency: 'Switch off power at the source before touching a shock victim; call 000; do not use damaged equipment.',
      },
      {
        hazard: 'Biological hazards — waste, washrooms, bodily fluids',
        risk: 'Infection, exposure to contaminants',
        controls: ['Treat all waste and washroom surfaces as potentially contaminated', 'Use dedicated colour-coded cloths/mops per area', 'Wash hands thoroughly after each task', 'Use a spill kit for bodily-fluid spills'],
        ppe: ['Disposable gloves', 'Face mask where required'],
        emergency: 'For a needle-stick or exposure, wash the area, do not scrub, and seek medical advice immediately; report it.',
      },
      {
        hazard: 'Working alone / after hours',
        risk: 'Delayed help if injured, personal security',
        controls: ['Keep a charged phone on you at all times', 'Advise a contact of start/finish times', 'Lock the site behind you; be aware of surroundings', 'Follow the site access and alarm procedure'],
        ppe: ['Hi-vis where required on site'],
        emergency: 'Call 000 in an emergency; then notify Core Cleaning on 0407 026 360.',
      },
    ],
  },
  {
    code: 'SWMS 002',
    title: 'Chemical Handling & Storage',
    scope: 'Handling, mixing, transporting and storing cleaning chemicals.',
    chemicals: ['Fast Glass', 'Shower Star', 'Kuranda Disinfectant', 'pH 7 Detergent', 'Sequal'],
    rows: [
      {
        hazard: 'Chemical splash to eyes or skin',
        risk: 'Eye injury, chemical burns, irritation',
        controls: ['Wear safety glasses and gloves when decanting or mixing', 'Follow the SDS for each product', 'Use correct dilution ratios; add chemical to water, not water to chemical', 'Pour at a low height to avoid splashing'],
        ppe: ['Chemical-resistant gloves', 'Safety glasses'],
        emergency: 'Flush the affected area with clean water for at least 15 minutes; follow SDS first aid; seek medical help.',
      },
      {
        hazard: 'Inhalation of fumes/vapours',
        risk: 'Respiratory irritation, dizziness, nausea',
        controls: ['Use in well-ventilated areas', 'Never mix bleach and acids/ammonia', 'Keep containers sealed when not in use', 'Use the minimum effective quantity'],
        ppe: ['Face mask / respirator where SDS requires'],
        emergency: 'Move to fresh air immediately; seek medical help if breathing difficulty continues.',
      },
      {
        hazard: 'Mixing incompatible chemicals',
        risk: 'Toxic gas, violent reaction',
        controls: ['NEVER mix products', 'Use one product for one task', 'Rinse equipment between different chemicals', 'Keep original labels on all containers'],
        ppe: ['Gloves', 'Safety glasses'],
        emergency: 'Evacuate and ventilate the area; do not re-enter until clear; call 000 if anyone is affected.',
      },
      {
        hazard: 'Storage and spills',
        risk: 'Slips, contamination, reactions',
        controls: ['Store chemicals upright, lidded and labelled, away from food and heat', 'Keep an SDS folder accessible at each site', 'Keep a spill kit available', 'Store incompatible chemicals apart'],
        ppe: ['Gloves', 'Safety glasses'],
        emergency: 'Contain the spill with the spill kit, ventilate, and dispose of per the SDS; report the spill.',
      },
    ],
  },
  {
    code: 'SWMS 003',
    title: 'Manual Handling',
    scope: 'Lifting, carrying, pushing and pulling loads and equipment.',
    rows: [
      {
        hazard: 'Lifting heavy or awkward loads',
        risk: 'Back and muscular strain',
        controls: ['Assess the load first; get help or a trolley if heavy', 'Bend the knees, keep the back straight, load close to the body', 'Avoid twisting — turn with the feet', 'Break loads into smaller amounts'],
        ppe: ['Gloves', 'Enclosed footwear'],
        emergency: 'Stop, rest and apply first aid; report any strain early so it can be managed.',
      },
      {
        hazard: 'Repetitive movements (scrubbing, wiping, vacuuming)',
        risk: 'Overuse injury, fatigue',
        controls: ['Alternate tasks and hands', 'Take short micro-breaks', 'Use ergonomic tools and extension handles', 'Keep equipment well maintained so it runs easily'],
        ppe: ['Gloves'],
        emergency: 'Rest the affected area; report persistent pain or numbness.',
      },
      {
        hazard: 'Pushing/pulling trolleys and machines',
        risk: 'Strain, collisions',
        controls: ['Push rather than pull where possible', 'Keep wheels/castors maintained', 'Keep clear sightlines; go slowly around corners', 'Do not overload trolleys'],
        ppe: ['Enclosed footwear'],
        emergency: 'Apply first aid to any strain or impact injury; report it.',
      },
    ],
  },
  {
    code: 'SWMS 004',
    title: 'Slip, Trip & Fall Prevention',
    scope: 'Preventing slips, trips and falls during all cleaning activities.',
    rows: [
      {
        hazard: 'Wet floors',
        risk: 'Slips and falls',
        controls: ['Use "Wet Floor" signage', 'Clean in sections, leaving a dry path', 'Dry floors promptly in walkways', 'Wear slip-resistant footwear'],
        ppe: ['Slip-resistant footwear'],
        emergency: 'Assist anyone who falls; call 000 for serious injury; record the incident.',
      },
      {
        hazard: 'Trailing cords and hoses',
        risk: 'Trips',
        controls: ['Route cords along walls, away from walkways', 'Use the nearest power point', 'Coil unused cord', 'Warn others working nearby'],
        ppe: ['Enclosed footwear'],
        emergency: 'Apply first aid; report and photograph the hazard if it caused an injury.',
      },
      {
        hazard: 'Clutter, uneven surfaces, poor lighting',
        risk: 'Trips and falls',
        controls: ['Keep work areas tidy; clear obstacles before cleaning', 'Turn on lighting; report faulty lighting', 'Report damaged flooring to the client and Core Cleaning', 'Take extra care on stairs and ramps'],
        ppe: ['Enclosed footwear'],
        emergency: 'Apply first aid; report the hazard so it can be fixed.',
      },
      {
        hazard: 'Working at height (step stools, low ladders)',
        risk: 'Falls from height',
        controls: ['Use a rated, stable ladder/step on firm level ground', 'Maintain three points of contact; do not overreach', 'Do not stand on the top step', 'Have a second person foot the ladder where needed'],
        ppe: ['Slip-resistant footwear'],
        emergency: 'Do not move a seriously injured person; call 000; report the incident.',
      },
    ],
  },
  {
    code: 'SWMS 005',
    title: 'Pressure Washing',
    scope: 'High-pressure washing of hard surfaces, walkways, bins and exteriors.',
    rows: [
      {
        hazard: 'High-pressure water jet',
        risk: 'Injection injury, lacerations to skin/eyes',
        controls: ['Never point the lance at people or yourself', 'Keep hands and feet clear of the nozzle', 'Start at low pressure and increase as needed', 'Release pressure before changing nozzles'],
        ppe: ['Safety glasses/face shield', 'Waterproof gloves', 'Enclosed waterproof footwear'],
        emergency: 'Treat any injection injury as serious — seek medical help immediately even if it looks minor.',
      },
      {
        hazard: 'Electricity near water',
        risk: 'Electric shock',
        controls: ['Use an RCD/safety switch on the supply', 'Keep leads and connections out of water', 'Inspect leads before use; tag out damaged gear', 'Never operate with wet hands on connections'],
        ppe: ['Waterproof footwear'],
        emergency: 'Isolate power before assisting a shock victim; call 000.',
      },
      {
        hazard: 'Flying debris and slippery surfaces',
        risk: 'Eye injury, slips',
        controls: ['Clear or cordon the area of people', 'Wear eye protection at all times', 'Be aware of the surface becoming slippery', 'Work away from your footing'],
        ppe: ['Safety glasses/face shield', 'Slip-resistant footwear'],
        emergency: 'Flush eyes with water; seek medical help for embedded debris.',
      },
      {
        hazard: 'Noise',
        risk: 'Hearing damage',
        controls: ['Wear hearing protection with petrol/high-noise units', 'Limit continuous exposure', 'Maintain the machine to reduce noise'],
        ppe: ['Hearing protection'],
        emergency: 'Report any ringing/loss of hearing; review controls.',
      },
    ],
  },
  {
    code: 'SWMS 006',
    title: 'Floor Scrubbing & Polishing',
    scope: 'Use of scrubbers, buffers and polishers on hard floors.',
    rows: [
      {
        hazard: 'Rotating pad/brush entanglement',
        risk: 'Cuts, entanglement of clothing/cords',
        controls: ['Keep loose clothing, cords and hair clear', 'Never tilt/lift the machine while running', 'Switch off and unplug before changing pads', 'Keep bystanders clear'],
        ppe: ['Enclosed footwear'],
        emergency: 'Switch off immediately; apply first aid; report the incident.',
      },
      {
        hazard: 'Electrical (leads, wet operation)',
        risk: 'Electric shock',
        controls: ['Use an RCD/safety switch', 'Keep the lead behind the machine and out of water', 'Inspect leads; tag out damaged gear', 'Do not run cords through standing water'],
        ppe: ['Enclosed footwear'],
        emergency: 'Isolate power before assisting; call 000.',
      },
      {
        hazard: 'Wet/slippery floors and polish fumes',
        risk: 'Slips, respiratory irritation',
        controls: ['Signage and barriers around the work area', 'Ensure ventilation when applying polish/sealer', 'Follow SDS for stripper/sealer products', 'Allow floors to cure before re-opening'],
        ppe: ['Slip-resistant footwear', 'Gloves', 'Mask where SDS requires'],
        emergency: 'Move to fresh air for fume exposure; flush skin/eyes for chemical contact; seek help if needed.',
      },
      {
        hazard: 'Noise and vibration',
        risk: 'Hearing damage, fatigue',
        controls: ['Wear hearing protection where noisy', 'Take breaks; rotate operators', 'Maintain machines to reduce vibration'],
        ppe: ['Hearing protection'],
        emergency: 'Report hearing symptoms or hand numbness; review controls.',
      },
    ],
  },
  {
    code: 'SWMS 007',
    title: 'Window Cleaning',
    scope: 'Internal and accessible external window and glass cleaning.',
    rows: [
      {
        hazard: 'Working at height (ladders, low reach)',
        risk: 'Falls from height',
        controls: ['Use water-fed poles from the ground where possible', 'Use a rated, stable ladder on firm level ground', 'Maintain three points of contact; do not overreach', 'Do not work at height in high wind or wet conditions'],
        ppe: ['Slip-resistant footwear'],
        emergency: 'Do not move a seriously injured person; call 000; report the incident.',
      },
      {
        hazard: 'Glass breakage',
        risk: 'Lacerations',
        controls: ['Inspect glass for cracks before applying pressure', 'Use correct tools; do not force scrapers', 'Clean up broken glass with a dustpan, never bare hands', 'Report damaged glass to the client and Core Cleaning'],
        ppe: ['Cut-resistant gloves'],
        emergency: 'Apply pressure to bleeding cuts; seek medical help for deep wounds.',
      },
      {
        hazard: 'Cleaning chemicals and streaking solutions',
        risk: 'Skin/eye irritation',
        controls: ['Follow the SDS; use correct dilution', 'Avoid overhead spraying near the face', 'Ventilate internal areas'],
        ppe: ['Gloves', 'Safety glasses'],
        emergency: 'Flush skin/eyes with water; follow SDS first aid.',
      },
      {
        hazard: 'Weather and public access (external work)',
        risk: 'Slips, falls, struck-by',
        controls: ['Cordon the work area below', 'Postpone in rain/high wind', 'Watch for pedestrians and vehicles', 'Secure equipment against wind'],
        ppe: ['Hi-vis where required'],
        emergency: 'Apply first aid; call 000 for serious injury; report the incident.',
      },
    ],
  },
  {
    code: 'SWMS 008',
    title: 'Bond Cleaning Operations',
    scope: 'End-of-lease bond cleans of vacant properties, including kitchens, bathrooms, ovens, carpets and fixtures, to inspection-ready standard.',
    chemicals: ['Oven degreaser', 'Mould & mildew remover', 'Kuranda Disinfectant', 'pH 7 Detergent'],
    rows: [
      {
        hazard: 'Oven and rangehood degreasing (confined space, strong chemicals)',
        risk: 'Skin/eye burns, respiratory irritation from concentrated degreaser',
        controls: ['Follow the SDS for the degreaser in use', 'Ventilate the kitchen — open windows/doors before starting', 'Apply in a well-lit area and avoid contact with skin', 'Never mix degreaser with other chemicals'],
        ppe: ['Chemical-resistant gloves', 'Safety glasses', 'Face mask'],
        emergency: 'Flush skin/eyes with water for 15 minutes; move to fresh air for fume exposure; seek medical help if symptoms persist.',
      },
      {
        hazard: 'Mould and mildew in bathrooms/wet areas',
        risk: 'Respiratory irritation, skin contact with mould spores and remover',
        controls: ['Ventilate the room before and during treatment', 'Follow the SDS dilution for mould/mildew remover', 'Avoid dry-brushing mould — dampen first to limit airborne spores', 'Do not mix mould remover with other chemicals'],
        ppe: ['Chemical-resistant gloves', 'Face mask', 'Safety glasses'],
        emergency: 'Move to fresh air if affected; flush skin/eyes with water; follow SDS first aid.',
      },
      {
        hazard: 'Unfamiliar / vacant property (no power, unknown layout, exposed hazards)',
        risk: 'Trips, falls, working in the dark, electrical hazards',
        controls: ['Confirm power/lighting is connected before starting; use a torch if not', 'Do a walkthrough first to identify hazards, damage or exposed wiring', 'Report any exposed wiring, gas smell or structural damage before working — do not proceed', 'Be alert for items left behind (sharps, broken glass)'],
        ppe: ['Enclosed footwear', 'Gloves'],
        emergency: 'Stop work and evacuate for a suspected gas leak or exposed live wiring; call 000/the relevant utility; notify Core Cleaning.',
      },
      {
        hazard: 'Older properties — pre-1990 renovations (potential asbestos-containing materials)',
        risk: 'Asbestos fibre exposure from damaged sheeting, tiles or textured surfaces',
        controls: ['Do not drill, sand, scrape or forcefully clean any damaged or friable wall/ceiling sheeting', 'If suspected asbestos-containing material is identified, stop work in that area and notify Core Cleaning and the property manager', 'Clean intact surfaces only with a damp cloth — never dry-sweep or use high pressure on suspect surfaces', 'Never attempt removal or disturbance of suspected ACM'],
        ppe: ['Gloves', 'Face mask where dust is present'],
        emergency: 'Stop work immediately, leave the area, and notify Core Cleaning management; do not disturb the material further.',
      },
      {
        hazard: 'Carpet steam cleaning (hot water, electrical equipment)',
        risk: 'Scalds, electric shock, slips on wet carpet',
        controls: ['Check leads and machine before use; use an RCD/safety switch', 'Keep the hot water hose and wand away from skin', 'Work from the back of the room to the exit to avoid re-walking wet carpet', 'Allow adequate drying time before the property is walked through'],
        ppe: ['Enclosed waterproof footwear', 'Gloves'],
        emergency: 'Isolate power before assisting a shock victim; run scalds under cool water; call 000 for serious injury.',
      },
      {
        hazard: 'Time pressure to meet agent/inspection deadlines',
        risk: 'Rushed work leading to slips, strains or missed hazards',
        controls: ['Plan the job realistically before booking; allow time for drying/curing', 'Do not skip PPE or SDS steps to save time', 'Ask for help or reschedule rather than rushing a hazardous task', 'Communicate delays to the client/agent early'],
        ppe: ['As required per task above'],
        emergency: 'Stop and address any injury before continuing; report near-misses caused by time pressure.',
      },
    ],
  },
  {
    code: 'SWMS 009',
    title: 'Residential Cleaning Operations',
    scope: 'Routine and deep cleaning of occupied private homes, including kitchens, bathrooms, living areas and bedrooms, while residents, children or pets may be present.',
    rows: [
      {
        hazard: 'Occupied home — residents, children and visitors present',
        risk: 'Slips/collisions in shared spaces, privacy concerns, disruption to the household',
        controls: ['Confirm the cleaning schedule and any areas to avoid with the client beforehand', 'Keep work areas tidy and clear as you go to avoid trip hazards for residents', 'Respect private/off-limits rooms and personal belongings', 'Pause chemical use in a room if a child is present until it is ventilated'],
        ppe: ['Enclosed footwear'],
        emergency: 'If a resident is injured due to the clean, apply first aid where appropriate and notify Core Cleaning immediately.',
      },
      {
        hazard: 'Pets in the home',
        risk: 'Bites, scratches, tripping over animals, chemical exposure to pets',
        controls: ['Ask the client to secure pets before the clean where possible', 'Keep chemicals, mop buckets and cords out of reach of pets', 'Move calmly around animals; do not corner or startle them', 'Close doors/gates behind you to keep pets out of wet or chemical-treated areas'],
        ppe: ['Gloves'],
        emergency: 'For a bite or scratch, wash the wound thoroughly and seek medical advice if it breaks the skin; report the incident.',
      },
      {
        hazard: 'Unknown household hazards (clutter, stairs, uneven surfaces, pests)',
        risk: 'Slips, trips and falls',
        controls: ['Do a quick visual check of each room before starting', 'Ask the client to clear valuable/fragile clutter from work areas beforehand', 'Take extra care on stairs and with loose rugs/cords', 'Report any pest activity or hazardous conditions to Core Cleaning'],
        ppe: ['Enclosed, slip-resistant footwear'],
        emergency: 'Assist anyone who falls; call 000 for serious injury; record and report the incident.',
      },
      {
        hazard: 'Kitchen and bathroom chemical use in a lived-in home',
        risk: 'Skin/eye irritation, accidental exposure to residents or pets',
        controls: ['Follow the SDS for every product used', 'Never leave chemicals unattended or within reach of children/pets', 'Ventilate the room during and after use', 'Store and transport chemicals securely between homes'],
        ppe: ['Chemical-resistant gloves', 'Safety glasses'],
        emergency: 'Flush skin/eyes with water for 15 minutes; follow SDS first aid; seek medical help if symptoms persist.',
      },
      {
        hazard: 'Working alone in a private residence',
        risk: 'Delayed help if injured, personal security',
        controls: ['Keep a charged phone on you at all times', 'Advise Core Cleaning or a contact of the address and expected finish time', 'Trust your judgement — leave and report if a situation feels unsafe', 'Confirm identity/access with the client or agent before entering'],
        ppe: ['As required per task'],
        emergency: 'Call 000 in an emergency; then notify Core Cleaning on ' + COMPANY.phone + '.',
      },
    ],
  },
]

export const MODERN_SLAVERY = {
  code: 'POLICY',
  title: 'Modern Slavery Declaration',
  paragraphs: [
    'Core Cleaning is committed to ethical business practices and does not tolerate any form of modern slavery, forced labour, child labour, human trafficking, or exploitation within its operations or supply chain.',
    'Core Cleaning requires all subcontractors and suppliers to comply with applicable workplace, employment, and human rights laws.',
    'Core Cleaning verifies contractor identity, ABN registration, and right-to-work status where applicable.',
    'Any suspected breach of this policy must be reported immediately to Core Cleaning management.',
  ],
}

export interface Policy {
  code: string
  slug: string
  title: string
  intro?: string
  sections: { heading?: string; body?: string; bullets?: string[] }[]
}

export const POLICIES: Policy[] = [
  {
    code: 'POL-002',
    slug: 'environmental-policy',
    title: 'Environmental Policy',
    intro: 'Core Cleaning is committed to minimising the environmental impact of its operations and to continual improvement in its environmental performance.',
    sections: [
      { heading: 'Waste reduction', body: 'We minimise waste by using the correct amount of product, reusing durable equipment, and disposing of waste responsibly and in line with site requirements.' },
      { heading: 'Responsible chemical use', body: 'Chemicals are used strictly in accordance with their Safety Data Sheets and at the correct dilution. We avoid over-use and select lower-toxicity, environmentally responsible products where practical.' },
      { heading: 'Recycling', body: 'We separate and recycle materials where site facilities allow, and encourage clients to support recycling on their premises.' },
      { heading: 'Water & energy conservation', body: 'We use water efficiently, avoid unnecessary running of taps and equipment, and switch off lights and equipment that are not in use.' },
      { heading: 'Compliance', body: 'Core Cleaning complies with all applicable environmental laws and regulations, and reviews this policy at least annually.' },
    ],
  },
  {
    code: 'POL-003',
    slug: 'business-continuity',
    title: 'Business Continuity Plan',
    intro: 'This plan sets out how Core Cleaning maintains service to clients during a disruption. It is reviewed annually and after any activation.',
    sections: [
      { heading: 'Cleaner unavailable or resigns', bullets: ['A backup cleaner or subcontractor from our bench is deployed', 'Site Packs (site details, access, scope) let a replacement step in and perform correctly', 'The client is notified if any change to timing is expected'] },
      { heading: 'Flood, fire or site incident', bullets: ['The client and management are notified immediately', 'Affected cleans are rescheduled once the site is safe', 'Alternative arrangements are made where access is lost'] },
      { heading: 'Vehicle breakdown', bullets: ['Backup or hired transport is arranged', 'Affected sites are re-sequenced or rescheduled the same day where possible'] },
      { heading: 'Equipment failure', bullets: ['Spare or hired equipment is sourced', 'Supplier contacts are maintained for rapid replacement'] },
      { heading: 'Pandemic or widespread illness', bullets: ['Enhanced hygiene protocols are followed', 'Essential/priority sites are maintained first', 'Coordination continues remotely via Core Cleaning Hub'] },
      { heading: 'Key person unavailable', bullets: ['Operations are documented in Core Cleaning Hub so the business runs without a single point of failure', 'A delegated contact manages client communication'] },
      { heading: 'Communication', body: 'Clients are kept informed promptly during any disruption. Core Cleaning management can be reached on ' + COMPANY.phone + '.' },
    ],
  },
]

export function findPolicy(slug: string): Policy | undefined {
  return POLICIES.find((p) => p.slug === slug)
}

export const SDS_REGISTER = {
  code: 'SDS-REG',
  title: 'Safety Data Sheet (SDS) Register',
  intro: 'Current Safety Data Sheets for all chemicals in use are available to workers. Each SDS must be read before first use of a product and followed at all times.',
  products: [
    { product: 'Fast Glass', sds: 'Current', location: 'Cleaner Portal' },
    { product: 'Shower Star', sds: 'Current', location: 'Cleaner Portal' },
    { product: 'Kuranda Disinfectant', sds: 'Current', location: 'Cleaner Portal' },
    { product: 'pH 7 Detergent', sds: 'Current', location: 'Cleaner Portal' },
    { product: 'Sequal', sds: 'Current', location: 'Cleaner Portal' },
  ],
}

export function findSwms(code: string): Swms | undefined {
  return SWMS_LIST.find((s) => s.code.replace(/\s+/g, '-').toLowerCase() === code.toLowerCase())
}
