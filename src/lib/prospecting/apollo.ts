import type { ProspectCandidate } from './types'

const SEARCH_URL = 'https://api.apollo.io/api/v1/mixed_people/api_search'
const MATCH_URL = 'https://api.apollo.io/api/v1/people/match'

export function apolloConfigured(): boolean {
  return Boolean(process.env.APOLLO_API_KEY)
}

interface ApolloPerson {
  id: string
  first_name: string | null
  last_name_obfuscated: string | null
  title: string | null
  has_email: boolean
  has_direct_phone: boolean
  organization: { id: string; name: string | null; website_url: string | null; primary_domain: string | null } | null
}

// Search is free (0 Apollo credits) and never returns email/phone — those
// only come from the enrichment call below, which the user triggers per
// contact via saveApolloProspectAction.
export async function searchApolloPeople(titles: string[], locations: string[]): Promise<ProspectCandidate[]> {
  if (!apolloConfigured()) throw new Error('Apollo isn\'t connected yet — add APOLLO_API_KEY to the environment.')

  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-api-key': process.env.APOLLO_API_KEY!,
    },
    body: JSON.stringify({
      person_titles: titles,
      organization_locations: locations,
      page: 1,
      per_page: 25,
    }),
  })
  if (!res.ok) throw new Error(`Apollo search failed (${res.status})`)
  const data = await res.json() as { people: ApolloPerson[] }

  return (data.people ?? []).map((p) => ({
    source: 'apollo' as const,
    external_id: p.id,
    company_name: p.organization?.name ?? null,
    company_domain: p.organization?.primary_domain ?? null,
    contact_name: [p.first_name, p.last_name_obfuscated].filter(Boolean).join(' ') || null,
    job_title: p.title,
    location: null, // not included on the search response — only on the org record
    linkedin_url: null,
    can_reveal_email: p.has_email,
    can_reveal_phone: p.has_direct_phone,
  }))
}

interface ApolloMatchResult {
  name: string | null
  email: string | null
  organization: { name: string | null; primary_domain: string | null } | null
  phone_numbers: { sanitized_number: string | null }[] | null
  linkedin_url: string | null
  title: string | null
}

// Costs Apollo credits: 1 for email/demographics, +8 more if a mobile phone
// is found — only call this for a contact the user has chosen to save.
export async function revealApolloContact(personId: string): Promise<{ email: string | null; phone: string | null; linkedin_url: string | null; contact_name: string | null; job_title: string | null; company_name: string | null; company_domain: string | null }> {
  if (!apolloConfigured()) throw new Error('Apollo isn\'t connected yet — add APOLLO_API_KEY to the environment.')

  const res = await fetch(MATCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-api-key': process.env.APOLLO_API_KEY!,
    },
    body: JSON.stringify({
      id: personId,
      reveal_personal_emails: true,
      reveal_phone_number: true,
      poll_only: true,
    }),
  })
  if (!res.ok) throw new Error(`Apollo enrichment failed (${res.status})`)
  const data = await res.json() as { person: ApolloMatchResult }
  const person = data.person

  return {
    email: person?.email ?? null,
    phone: person?.phone_numbers?.[0]?.sanitized_number ?? null,
    linkedin_url: person?.linkedin_url ?? null,
    contact_name: person?.name ?? null,
    job_title: person?.title ?? null,
    company_name: person?.organization?.name ?? null,
    company_domain: person?.organization?.primary_domain ?? null,
  }
}
