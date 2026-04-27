'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'

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

  // Fetch client name for the email
  const { data: clientData } = await (supabase as any)
    .from('clients')
    .select('business_name')
    .eq('id', clientId)
    .single()

  const businessName = clientData?.business_name ?? 'Client'

  // Send email — return error to user if it fails so it's visible
  const emailResult = await sendEmail(
    'hello@deltacleaning.com.au',
    `Photo Request — ${businessName}`,
    `<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; color: #111;">
      <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Photo Request</h2>
      <p style="font-size: 14px; color: #444;">${businessName} has requested photos from their most recent clean.</p>
      <p style="font-size: 14px; color: #444; margin-top: 8px;">Please ensure the cleaner submits photos at their next visit, or upload them manually from the admin dashboard.</p>
    </div>`
  )

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

  // Send admin notification email (non-blocking)
  try {
    const { data: clientData } = await (supabase as any)
      .from('clients')
      .select('business_name')
      .eq('id', payload.client_id)
      .single()

    const businessName = clientData?.business_name ?? 'Unknown Client'
    const isIssue      = payload.type === 'issue'
    const subject      = isIssue
      ? `${payload.request_photos ? '[📷 Photos Requested] ' : ''}Client Issue Reported — ${businessName}`
      : `Client Feedback — ${businessName}`

    const feedbackHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; color: #111;">
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">${isIssue ? 'Issue Reported' : 'Feedback Received'}</h2>
        ${payload.request_photos ? `<div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px; font-weight: 600; color: #856404;">📷 Client has requested photos from this clean</div>` : ''}
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #555; width: 120px;">Client</td><td style="padding: 8px 0; font-weight: 600;">${businessName}</td></tr>
          <tr><td style="padding: 8px 0; color: #555;">Type</td><td style="padding: 8px 0;">${payload.type}</td></tr>
          ${payload.rating != null ? `<tr><td style="padding: 8px 0; color: #555;">Rating</td><td style="padding: 8px 0;">${payload.rating}/5</td></tr>` : ''}
          ${payload.service_date ? `<tr><td style="padding: 8px 0; color: #555;">Service Date</td><td style="padding: 8px 0;">${payload.service_date}</td></tr>` : ''}
          ${payload.area ? `<tr><td style="padding: 8px 0; color: #555;">Area</td><td style="padding: 8px 0;">${payload.area}</td></tr>` : ''}
          <tr><td style="padding: 8px 0; color: #555; vertical-align: top;">Message</td><td style="padding: 8px 0;">${payload.message}</td></tr>
          ${payload.request_photos ? `<tr><td style="padding: 8px 0; color: #555;">Photos Requested</td><td style="padding: 8px 0; font-weight: 600;">Yes</td></tr>` : ''}
        </table>
      </div>
    `

    // Fetch all manager emails
    const { data: managers } = await (supabase as any)
      .from('profiles')
      .select('email')
      .eq('role', 'manager')

    const managerEmails: string[] = (managers ?? [])
      .map((m: any) => m.email)
      .filter(Boolean)

    const feedbackRecipients = ['hello@deltacleaning.com.au', ...managerEmails]
    for (const recipient of feedbackRecipients) {
      await sendEmail(recipient, subject, feedbackHtml)
    }
  } catch {
    // Email failure should not block feedback submission
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

  // Send email to admin and all managers
  try {
    const { data: clientData } = await (supabase as any)
      .from('clients')
      .select('business_name')
      .eq('id', payload.client_id)
      .single()

    const businessName = clientData?.business_name ?? 'Unknown Client'

    const recipients = ['hello@deltacleaning.com.au']
    const subject = `Service Request — ${businessName}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; color: #111;">
        <h2 style="font-size: 18px; font-weight: 700; margin-bottom: 16px;">Service Request Received</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr><td style="padding: 8px 0; color: #555; width: 120px;">Client</td><td style="padding: 8px 0; font-weight: 600;">${businessName}</td></tr>
          <tr><td style="padding: 8px 0; color: #555;">Service</td><td style="padding: 8px 0;">${payload.service_name}</td></tr>
          <tr><td style="padding: 8px 0; color: #555;">Frequency</td><td style="padding: 8px 0;">${payload.frequency}</td></tr>
          ${payload.notes ? `<tr><td style="padding: 8px 0; color: #555; vertical-align: top;">Notes</td><td style="padding: 8px 0;">${payload.notes}</td></tr>` : ''}
        </table>
      </div>
    `

    for (const recipient of recipients) {
      await sendEmail(recipient, subject, html)
    }
  } catch {
    // Email failure should not block the request
  }

  revalidatePath('/client/services')
  return { success: true }
}
