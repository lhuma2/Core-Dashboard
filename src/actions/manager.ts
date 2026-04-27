'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushToUser } from '@/lib/push'

export async function assignCleanerToClientAction(
  clientId: string,
  cleanerId: string | null,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient()
  // Use admin client for profile lookup so RLS never blocks reading another user's record
  const admin = createAdminClient()

  // Fetch client name and new cleaner's user_id in parallel (before update)
  const [{ data: client }, { data: cleanerProfile }] = await Promise.all([
    (supabase as any).from('clients').select('business_name').eq('id', clientId).single(),
    cleanerId
      ? (admin as any).from('profiles').select('user_id').eq('id', cleanerId).single()
      : Promise.resolve({ data: null }),
  ])

  const { error } = await (supabase as any)
    .from('clients')
    .update({ assigned_cleaner_id: cleanerId ?? null, assignment_accepted: false })
    .eq('id', clientId)

  if (error) return { error: error.message }

  // Push notification to newly assigned cleaner
  if (cleanerProfile?.user_id) {
    sendPushToUser(cleanerProfile.user_id, {
      title: 'New Client Assigned',
      body:  `You've been assigned to ${client?.business_name ?? 'a new client'}. Tap to view your dashboard.`,
      url:   '/cleaner/dashboard',
    }).catch(() => {})
  }

  revalidatePath('/manager/clients')
  revalidatePath(`/manager/clients/${clientId}`)
  revalidatePath('/manager/flags')
  revalidatePath('/cleaner/dashboard')
  return { success: true }
}

export async function acceptClientAssignmentAction(
  clientId: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('clients')
    .update({ assignment_accepted: true })
    .eq('id', clientId)

  if (error) return { error: error.message }
  revalidatePath('/cleaner/dashboard')
  revalidatePath(`/cleaner/clients/${clientId}`)
  return { success: true }
}
