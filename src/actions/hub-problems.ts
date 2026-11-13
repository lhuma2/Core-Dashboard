'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/require-staff'
import { sendPushToUser } from '@/lib/push'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Result = { ok: true } | { ok: false, error: string }

/** Mark a reported problem as fixed, then let the cleaner who reported it know it's sorted. */
export async function markProblemFixed(id: string): Promise<Result> {
  const denied = await requireStaff()
  if (denied) return { ok: false, error: denied }
  if (!UUID.test(id)) return { ok: false, error: 'That problem could not be found.' }
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  const { data: me } = await supabase.from('profiles').select('id').eq('user_id', user!.id).maybeSingle()

  const { data: row, error } = await supabase
    .from('issues')
    .update({ resolved_at: new Date().toISOString(), resolved_by: me?.id ?? null })
    .eq('id', id)
    .is('resolved_at', null)
    .select('id, body, cleaner:profiles!issues_cleaner_id_fkey(user_id)')
    .maybeSingle()
  if (error) return { ok: false, error: 'Couldn’t save that. Please try again.' }
  if (!row) return { ok: false, error: 'That problem was already marked fixed, or it was removed.' }

  const cleanerUser = row.cleaner?.user_id
  if (cleanerUser) {
    const short = row.body.length > 80 ? row.body.slice(0, 77) + '…' : row.body
    // A failed notification shouldn't undo the fix.
    await sendPushToUser(cleanerUser, { title: 'Problem sorted', body: `Thanks for reporting it: ${short}`, url: '/cleaner/app' }).catch(() => {})
  }
  revalidatePath('/hub')
  revalidatePath('/hub/problems')
  return { ok: true }
}

/** Move a fixed problem back to Open. */
export async function reopenProblem(id: string): Promise<Result> {
  const denied = await requireStaff()
  if (denied) return { ok: false, error: denied }
  if (!UUID.test(id)) return { ok: false, error: 'That problem could not be found.' }
  const supabase = createClient() as any
  const { data: row, error } = await supabase
    .from('issues')
    .update({ resolved_at: null, resolved_by: null })
    .eq('id', id)
    .not('resolved_at', 'is', null)
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, error: 'Couldn’t save that. Please try again.' }
  if (!row) return { ok: false, error: 'That problem is already open, or it was removed.' }
  revalidatePath('/hub')
  revalidatePath('/hub/problems')
  return { ok: true }
}
