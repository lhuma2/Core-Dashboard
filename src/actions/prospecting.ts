'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { searchApolloPeople, revealApolloContact } from '@/lib/prospecting/apollo'
import { searchLushaContacts, revealLushaContact } from '@/lib/prospecting/lusha'
import { ROLE_GROUPS, SEQ_CITIES } from '@/lib/prospecting/types'
import type { ProspectCandidate, ProspectSource } from '@/lib/prospecting/types'

export async function searchProspectsAction(source: ProspectSource, roleKeys: string[]) {
  const titles = ROLE_GROUPS.filter((r) => roleKeys.includes(r.key)).flatMap((r) => r.titles)
  if (titles.length === 0) return { error: 'Pick at least one role to search for.' }

  try {
    const candidates = source === 'apollo'
      ? await searchApolloPeople(titles, SEQ_CITIES.map((c) => `${c.city}, ${c.state}, ${c.country}`))
      : await searchLushaContacts(titles)

    // Don't show a contact already saved or dismissed.
    const db = createAdminClient() as any
    const { data: known } = await db.from('prospects').select('source, external_id')
    const knownKeys = new Set((known ?? []).map((k: any) => `${k.source}:${k.external_id}`))
    const fresh = candidates.filter((c: ProspectCandidate) => !knownKeys.has(`${c.source}:${c.external_id}`))

    return { success: true, candidates: fresh }
  } catch (err: any) {
    return { error: err?.message || 'Search failed' }
  }
}

export async function saveProspectAction(candidate: ProspectCandidate) {
  try {
    const revealed = candidate.source === 'apollo'
      ? await revealApolloContact(candidate.external_id)
      : await revealLushaContact(candidate.external_id)

    const db = createAdminClient() as any
    const { error } = await db.from('prospects').insert({
      source: candidate.source,
      external_id: candidate.external_id,
      company_name: revealed.company_name ?? candidate.company_name,
      company_domain: revealed.company_domain ?? candidate.company_domain,
      contact_name: revealed.contact_name ?? candidate.contact_name,
      job_title: revealed.job_title ?? candidate.job_title,
      location: candidate.location,
      linkedin_url: revealed.linkedin_url ?? candidate.linkedin_url,
      email: revealed.email,
      phone: revealed.phone,
      status: 'saved',
    })
    if (error) return { error: error.message }

    revalidatePath('/prospecting')
    return { success: true, email: revealed.email, phone: revealed.phone }
  } catch (err: any) {
    return { error: err?.message || 'Reveal failed' }
  }
}

export async function dismissProspectAction(id: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('prospects')
    .update({ status: 'dismissed', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/prospecting')
  return { success: true }
}
