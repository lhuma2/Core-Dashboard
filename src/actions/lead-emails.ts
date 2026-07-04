'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendThreadedEmail, buildCapabilityAttachment, introEmailContent, followUpEmailContent, type Prospect,
} from '@/lib/emails/prospect-email'

const prospectOf = (lead: any): Prospect => ({
  businessName: lead.business_name, contactName: lead.contact_name, suburb: lead.suburb,
})

function timelineEmailEvent(subject: string, kind: 'intro' | 'follow_up') {
  return {
    id: crypto.randomUUID(),
    type: 'note' as const,
    message: kind === 'intro' ? `Sent capability statement email — "${subject}"` : `Sent follow-up email — "${subject}"`,
    timestamp: new Date().toISOString(),
  }
}

export async function previewLeadIntroEmailAction(id: string): Promise<{ to?: string; subject?: string; body?: string; error?: string }> {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('leads').select('business_name, contact_name, contact_email, suburb').eq('id', id).maybeSingle()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.contact_email) return { error: 'This lead has no email address. Add one first.' }
  const { subject, bodyText } = introEmailContent(prospectOf(lead))
  return { to: lead.contact_email, subject, body: `${bodyText}\n\n📎 Capability statement (PDF) attached` }
}

export async function sendLeadIntroEmailAction(id: string, scheduleFollowUp = false): Promise<{ success?: boolean; error?: string }> {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('leads').select('*').eq('id', id).maybeSingle()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.contact_email) return { error: 'This lead has no email address. Add one first.' }

  const { subject, html } = introEmailContent(prospectOf(lead))
  const messageId = `<lead-intro-${id}-${Date.now()}@deltacleaning.com.au>`
  const attachments = await buildCapabilityAttachment()

  const result = await sendThreadedEmail({ to: lead.contact_email, subject, html, messageId, attachments })
  if (!result.success) return { error: result.error || 'Email failed to send' }

  const now = new Date().toISOString()
  await db.from('leads').update({
    intro_email_sent_at: now,
    intro_email_message_id: messageId,
    intro_email_subject: subject,
    follow_up_opt_in: !!scheduleFollowUp,
    last_contact_date: now,
    timeline: [...(Array.isArray(lead.timeline) ? lead.timeline : []), timelineEmailEvent(subject, 'intro')],
  }).eq('id', id)

  revalidatePath('/leads'); revalidatePath(`/leads/${id}`)
  return { success: true }
}

export async function previewLeadFollowUpEmailAction(id: string): Promise<{ to?: string; subject?: string; body?: string; error?: string }> {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('leads').select('business_name, contact_name, contact_email, suburb, intro_email_subject, intro_email_message_id').eq('id', id).maybeSingle()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.contact_email) return { error: 'This lead has no email address.' }
  if (!lead.intro_email_message_id || !lead.intro_email_subject) return { error: 'Send the first email before following up.' }
  const { subject, bodyText } = followUpEmailContent(prospectOf(lead), lead.intro_email_subject)
  return { to: lead.contact_email, subject, body: bodyText }
}

export async function sendLeadFollowUpEmailAction(id: string): Promise<{ success?: boolean; error?: string }> {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('leads').select('*').eq('id', id).maybeSingle()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.contact_email) return { error: 'This lead has no email address.' }
  if (!lead.intro_email_message_id || !lead.intro_email_subject) return { error: 'Send the first email before following up.' }

  const { subject, html } = followUpEmailContent(prospectOf(lead), lead.intro_email_subject)
  const result = await sendThreadedEmail({ to: lead.contact_email, subject, html, inReplyTo: lead.intro_email_message_id })
  if (!result.success) return { error: result.error || 'Email failed to send' }

  const now = new Date().toISOString()
  await db.from('leads').update({
    follow_up_email_sent_at: now,
    last_contact_date: now,
    timeline: [...(Array.isArray(lead.timeline) ? lead.timeline : []), timelineEmailEvent(subject, 'follow_up')],
  }).eq('id', id)

  revalidatePath('/leads'); revalidatePath(`/leads/${id}`)
  return { success: true }
}
