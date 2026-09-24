export type ProspectSource = 'apollo' | 'lusha'
export type ProspectStatus = 'saved' | 'dismissed'

export interface Prospect {
  id: string
  source: ProspectSource
  external_id: string
  company_name: string | null
  company_domain: string | null
  contact_name: string | null
  job_title: string | null
  location: string | null
  linkedin_url: string | null
  email: string | null
  phone: string | null
  status: ProspectStatus
  notes: string | null
  created_at: string
  updated_at: string
}

// A search hit before contact details are revealed — nothing is saved to the
// DB (and no reveal credits spent) until the user explicitly saves one.
export interface ProspectCandidate {
  source: ProspectSource
  external_id: string
  company_name: string | null
  company_domain: string | null
  contact_name: string | null
  job_title: string | null
  location: string | null
  linkedin_url: string | null
  can_reveal_email: boolean
  can_reveal_phone: boolean
}

export const ROLE_GROUPS: { key: string; label: string; titles: string[] }[] = [
  { key: 'office_facilities', label: 'Office / Facilities Manager', titles: ['Office Manager', 'Facilities Manager'] },
  { key: 'practice_ops',      label: 'Practice / Operations Manager', titles: ['Practice Manager', 'Operations Manager'] },
  { key: 'property_strata',   label: 'Property / Strata Manager', titles: ['Property Manager', 'Strata Manager', 'Body Corporate Manager'] },
  // Bare "Owner" was dropped — it fuzzy-matches tech titles like "Product Owner" / "Scrum Owner" on Lusha/Apollo.
  { key: 'owner_director',    label: 'Owner / Director', titles: ['Business Owner', 'Company Owner', 'Director', 'Managing Director'] },
]

// North Brisbane to Gold Coast — same service area as the tender board.
export const SEQ_CITIES = [
  { city: 'Brisbane',   state: 'Queensland', country: 'Australia' },
  { city: 'Gold Coast', state: 'Queensland', country: 'Australia' },
]
