import type { ProspectCandidate } from './types'
import { SEQ_CITIES } from './types'

const PROSPECTING_URL = 'https://api.lusha.com/v3/contacts/prospecting'
const ENRICH_URL = 'https://api.lusha.com/v3/contacts/enrich'

export function lushaConfigured(): boolean {
  return Boolean(process.env.LUSHA_API_KEY)
}

interface LushaContact {
  id: string
  firstName: string | null
  lastName: string | null
  jobTitle: { title: string | null } | null
  company: { name: string | null; domain: string | null } | null
  location: { city: string | null; state: string | null; country: string | null } | null
  socialLinks: { linkedin: string | null } | null
  canReveal: { field: string; credits: number }[] | null
}

// Unlike Apollo's search, Lusha charges credits per result RETURNED by
// prospecting itself (not just on reveal) — surfaced in the UI so it's clear
// before the user runs a search.
export async function searchLushaContacts(titles: string[]): Promise<ProspectCandidate[]> {
  if (!lushaConfigured()) throw new Error('Lusha isn\'t connected yet — add LUSHA_API_KEY to the environment.')

  const res = await fetch(PROSPECTING_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api_key': process.env.LUSHA_API_KEY!,
    },
    body: JSON.stringify({
      pagination: { page: 1, size: 25 },
      filters: {
        contacts: { include: { jobTitles: titles, locations: SEQ_CITIES } },
      },
      options: { maxContactsPerCompany: 3 },
    }),
  })
  if (!res.ok) throw new Error(`Lusha search failed (${res.status})`)
  const data = await res.json() as { results: LushaContact[] }

  return (data.results ?? []).map((c) => ({
    source: 'lusha' as const,
    external_id: c.id,
    company_name: c.company?.name ?? null,
    company_domain: c.company?.domain ?? null,
    contact_name: [c.firstName, c.lastName].filter(Boolean).join(' ') || null,
    job_title: c.jobTitle?.title ?? null,
    location: [c.location?.city, c.location?.state].filter(Boolean).join(', ') || null,
    linkedin_url: c.socialLinks?.linkedin ?? null,
    can_reveal_email: (c.canReveal ?? []).some((r) => r.field === 'emails'),
    can_reveal_phone: (c.canReveal ?? []).some((r) => r.field === 'phones'),
  }))
}

interface LushaEnrichResult {
  emails: { email: string }[] | null
  phones: { number: string }[] | null
}

// Costs Lusha credits per revealed field (email/phone) — only call this for
// a contact the user has chosen to save. Lusha's enrich response doesn't add
// anything beyond email/phone (name/title/company already came from search).
export async function revealLushaContact(contactId: string): Promise<{
  email: string | null; phone: string | null; linkedin_url: null; contact_name: null
  job_title: null; company_name: null; company_domain: null
}> {
  if (!lushaConfigured()) throw new Error('Lusha isn\'t connected yet — add LUSHA_API_KEY to the environment.')

  const res = await fetch(ENRICH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'api_key': process.env.LUSHA_API_KEY!,
    },
    body: JSON.stringify({ ids: [contactId], reveal: ['emails', 'phones'] }),
  })
  if (!res.ok) throw new Error(`Lusha enrichment failed (${res.status})`)
  const data = await res.json() as { results: LushaEnrichResult[] }
  const result = data.results?.[0]

  return {
    email: result?.emails?.[0]?.email ?? null,
    phone: result?.phones?.[0]?.number ?? null,
    linkedin_url: null,
    contact_name: null,
    job_title: null,
    company_name: null,
    company_domain: null,
  }
}
