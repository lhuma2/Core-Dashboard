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

    // Don't show a contact that's ever been surfaced before, saved or not —
    // no crossover between searches.
    const db = createAdminClient() as any
    const { data: known } = await db.from('prospects').select('source, external_id')
    const knownKeys = new Set((known ?? []).map((k: any) => `${k.source}:${k.external_id}`))
    const fresh = candidates.filter((c: ProspectCandidate) => !knownKeys.has(`${c.source}:${c.external_id}`))

    // Record every fresh candidate as 'seen' immediately — before the user
    // even decides whether to save one — so it's excluded from here on
    // regardless of whether it ends up saved, dismissed, or just ignored.
    if (fresh.length > 0) {
      await db.from('prospects').insert(fresh.map((c: ProspectCandidate) => ({
        source: c.source,
        external_id: c.external_id,
        company_name: c.company_name,
        company_domain: c.company_domain,
        contact_name: c.contact_name,
        job_title: c.job_title,
        location: c.location,
        linkedin_url: c.linkedin_url,
        status: 'seen',
      })))
    }

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

    // The row already exists as 'seen' from the search step — upsert it to
    // 'saved' with the revealed contact details rather than inserting fresh.
    const db = createAdminClient() as any
    const { error } = await db.from('prospects').upsert({
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
      updated_at: new Date().toISOString(),
    }, { onConflict: 'source,external_id' })
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
