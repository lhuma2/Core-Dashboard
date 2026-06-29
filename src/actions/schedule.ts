'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ScopeTask } from '@/lib/scope'

async function currentProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await (supabase as any).from('profiles').select('id, role').eq('user_id', user.id).single()
  return data ?? null
}

// Completed task ids for a client on a given shift date.
export async function getCompletionsAction(clientId: string, dateISO: string): Promise<string[]> {
  const db = createAdminClient() as any
  const { data } = await db
    .from('schedule_completions')
    .select('task_id')
    .eq('client_id', clientId)
    .eq('clean_date', dateISO)
    .eq('done', true)
  return (data ?? []).map((r: any) => r.task_id)
}

// Tick / untick a task for the shift date. Untick deletes the row so it resets each shift.
export async function toggleTaskAction(clientId: string, taskId: string, dateISO: string, done: boolean) {
  const profile = await currentProfile()
  const db = createAdminClient() as any
  if (done) {
    const { error } = await db.from('schedule_completions').upsert(
      {
        client_id: clientId, task_id: taskId, clean_date: dateISO, done: true,
        cleaner_id: profile?.id ?? null, updated_at: new Date().toISOString(),
      },
      { onConflict: 'client_id,task_id,clean_date' }
    )
    if (error) return { error: error.message }
  } else {
    const { error } = await db.from('schedule_completions')
      .delete().eq('client_id', clientId).eq('task_id', taskId).eq('clean_date', dateISO)
    if (error) return { error: error.message }
  }
  return { success: true }
}

// Staff: save the structured scope + clean days for a client.
export async function saveScopeAction(clientId: string, scope: ScopeTask[], cleanDays: string[]) {
  const profile = await currentProfile()
  if (!profile || !['admin', 'manager'].includes(profile.role)) return { error: 'Not allowed.' }
  const db = createAdminClient() as any
  const { error } = await db.from('clients').update({ scope, clean_days: cleanDays }).eq('id', clientId)
  if (error) return { error: error.message }
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}
