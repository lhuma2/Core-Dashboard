'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendPushToRole } from '@/lib/push'

async function getCurrentProfile() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  return data ?? null
}

// ─── Client reports an issue ──────────────────────────────────────────────────

export async function reportIssueAction(clientId: string, description: string) {
  const supabase = createClient()
  const profile = await getCurrentProfile()

  const { error } = await (supabase as any)
    .from('client_issues')
    .insert({
      client_id:   clientId,
      reported_by: profile?.id ?? null,
      description,
    })

  if (error) return { error: error.message }

  revalidatePath('/client/dashboard')
  revalidatePath('/manager/flags')
  return { success: true }
}

// ─── Client requests photos ───────────────────────────────────────────────────

export async function requestPhotosAction(clientId: string) {
  const supabase = createClient()
  const profile = await getCurrentProfile()

  // Save request to DB (non-blocking — don't fail if this errors)
  await (supabase as any)
    .from('photo_requests')
    .insert({
      client_id:    clientId,
      requested_by: profile?.id ?? null,
    })

  // Notify managers + admins by push (replaces the old email).
  const { data: clientData } = await (supabase as any)
    .from('clients').select('business_name').eq('id', clientId).single()
  const businessName = clientData?.business_name ?? 'A client'

  const payload = { title: '📷 Photo request', body: `${businessName} has requested photos from their most recent clean.`, url: '/manager/dashboard' }
  sendPushToRole('manager', payload).catch(() => {})
  sendPushToRole('admin', payload).catch(() => {})

  revalidatePath('/client/dashboard')
  return { success: true, error: undefined }
}

// ─── Submit client feedback (issue or general feedback) ───────────────────────

export async function submitClientFeedbackAction(payload: {
  client_id: string
  type: 'issue' | 'feedback'
  message: string
  rating?: number | null
  service_date?: string | null
  area?: string | null
  request_photos?: boolean
}) {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('client_feedback')
    .insert({
      client_id:      payload.client_id,
      type:           payload.type,
      message:        payload.message,
      rating:         payload.rating ?? null,
      service_date:   payload.service_date ?? null,
      area:           payload.area ?? null,
      request_photos: payload.request_photos ?? false,
      resolved:       false,
    })

  if (error) return { error: error.message }

  // Notify managers + admins by push (replaces the old email).
  try {
    const { data: clientData } = await (supabase as any)
      .from('clients').select('business_name').eq('id', payload.client_id).single()
    const businessName = clientData?.business_name ?? 'A client'
    const isIssue = payload.type === 'issue'
    const note = {
      title: isIssue
        ? `⚠️ ${businessName} reported an issue${payload.request_photos ? ' (photos requested)' : ''}`
        : `💬 ${businessName} left feedback`,
      body: (payload.message || '').slice(0, 150) || (isIssue ? 'A client reported an issue.' : 'New client feedback received.'),
      url: '/manager/flags',
    }
    sendPushToRole('manager', note).catch(() => {})
    sendPushToRole('admin', note).catch(() => {})
  } catch {
    // Notification failure should not block feedback submission
  }

  revalidatePath('/client/contact')
  return { success: true }
}

// ─── Request an additional service ────────────────────────────────────────────

export async function requestServiceAction(payload: {
  client_id: string
  service_name: string
  frequency: string
  notes?: string | null
}) {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('service_requests')
    .insert({
      client_id:    payload.client_id,
      service_name: payload.service_name,
      frequency:    payload.frequency,
      notes:        payload.notes ?? null,
      status:       'pending',
    })

  if (error) return { error: error.message }

  // Notify managers + admins by push (replaces the old email).
  try {
    const { data: clientData } = await (supabase as any)
      .from('clients').select('business_name').eq('id', payload.client_id).single()
    const businessName = clientData?.business_name ?? 'A client'
    const note = {
      title: `➕ Service request — ${businessName}`,
      body: `${businessName} requested ${payload.service_name} (${payload.frequency}).`,
      url: '/manager/dashboard',
    }
    sendPushToRole('manager', note).catch(() => {})
    sendPushToRole('admin', note).catch(() => {})
  } catch {
    // Notification failure should not block the request
  }

  revalidatePath('/client/services')
  return { success: true }
}
