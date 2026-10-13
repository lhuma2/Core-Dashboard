'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/require-staff'
import { FOLLOW_UP_GAPS, FOLLOW_UP_STATUSES, type FollowUpData, type FollowUpOutcome } from '@/lib/documents/follow-up'

const OUTCOMES: FollowUpOutcome[] = ['spoke', 'no_answer', 'not_going_ahead']

// Log a follow-up call on a sent quote. The next call is scheduled from this one;
// "Not going ahead" stops the follow-ups and marks the quote declined.
export async function logFollowUpAction(id: string, outcome: FollowUpOutcome, phone?: string) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  if (!OUTCOMES.includes(outcome)) return { error: 'Pick how the call went.' }

  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('id, kind, status, data').eq('id', id).single()
  if (!doc || doc.kind !== 'proposal') return { error: 'Quote not found.' }
  if (!FOLLOW_UP_STATUSES.includes(doc.status)) return { error: 'This quote is no longer waiting on the client.' }

  const prev: FollowUpData = doc.data?.followUps ?? { log: [] }
  if ((prev.log?.length ?? 0) >= FOLLOW_UP_GAPS.length) return { error: 'All the follow-up calls for this quote are done.' }
  const typed = (phone ?? '').trim().slice(0, 40)
  const followUps: FollowUpData = {
    ...prev,
    ...(typed ? { phone: typed } : {}),
    log: [...(prev.log ?? []), { at: new Date().toISOString(), outcome }],
  }
  const { error } = await db.from('proposal_documents').update({
    data: { ...(doc.data ?? {}), followUps },
    ...(outcome === 'not_going_ahead' ? { status: 'declined' } : {}),
  }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/documents'); revalidatePath(`/documents/${id}`)
  return { success: true }
}
