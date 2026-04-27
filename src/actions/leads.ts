'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { LeadInsert, TimelineEvent } from '@/types/app'

function timelineEvent(
  type: TimelineEvent['type'],
  message: string,
  metadata?: Record<string, any>
): TimelineEvent {
  return {
    id: crypto.randomUUID(),
    type,
    message,
    timestamp: new Date().toISOString(),
    metadata,
  }
}

export async function createLeadAction(formData: FormData) {
  const supabase = createClient()

  const quoteRaw = formData.get('quote_value') as string
  const insert: LeadInsert = {
    business_name: formData.get('business_name') as string,
    contact_name:  (formData.get('contact_name') as string) || null,
    contact_email: (formData.get('contact_email') as string) || null,
    contact_phone: (formData.get('contact_phone') as string) || null,
    address:       (formData.get('address') as string) || null,
    suburb:        (formData.get('suburb') as string) || null,
    state:         (formData.get('state') as string) || 'QLD',
    postcode:      (formData.get('postcode') as string) || null,
    source:        (formData.get('source') as string) || null,
    notes:         (formData.get('notes') as string) || null,
    quote_value:   quoteRaw ? parseFloat(quoteRaw) : null,
    status:        'lead',
  }

  if (!insert.business_name) return { error: 'Business name is required' }

  const timeline = [timelineEvent('status_change', 'Lead created')]
  const { error } = await (supabase as any)
    .from('leads')
    .insert({ ...insert, timeline })

  if (error) return { error: error.message }
  revalidatePath('/leads')
  return { success: true }
}

export async function updateLeadAction(id: string, updates: Record<string, any>) {
  const supabase = createClient()
  const { error } = await (supabase as any)
    .from('leads')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  return { success: true }
}

export async function updateLeadStatusAction(
  id: string,
  status: string,
  currentTimeline: any[]
) {
  const supabase = createClient()

  const statusLabels: Record<string, string> = {
    lead:           'New Lead',
    contacted:      'Contacted',
    quoted:         'Quoted',
    proposal_sent:  'Proposal Sent',
    agreement_sent: 'Agreement Sent',
    won:            'Won',
    lost:           'Lost',
  }

  const event = timelineEvent(
    'status_change',
    `Status changed to ${statusLabels[status] ?? status}`
  )
  const timeline = [...(currentTimeline || []), event]

  const updates: Record<string, any> = {
    status,
    timeline,
    updated_at: new Date().toISOString(),
  }
  if (status === 'proposal_sent') updates.proposal_sent_at = new Date().toISOString()
  if (status === 'agreement_sent') updates.agreement_sent_at = new Date().toISOString()
  if (status === 'won') updates.signed_date = new Date().toISOString()

  const { error } = await (supabase as any)
    .from('leads')
    .update(updates)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/leads')
  revalidatePath(`/leads/${id}`)
  return { success: true }
}

export async function saveProposalAction(
  id: string,
  proposalData: Record<string, any>,
  currentTimeline: any[]
) {
  const supabase = createClient()
  const event = timelineEvent('proposal', 'Proposal created')
  const timeline = [...(currentTimeline || []), event]

  const { error } = await (supabase as any).from('leads').update({
    proposal_data:        proposalData,
    proposal_created_at:  new Date().toISOString(),
    timeline,
    updated_at:           new Date().toISOString(),
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/leads/${id}`)
  return { success: true }
}

export async function saveAgreementAction(
  id: string,
  agreementData: Record<string, any>,
  currentTimeline: any[]
) {
  const supabase = createClient()
  const event = timelineEvent('agreement', 'Agreement created')
  const timeline = [...(currentTimeline || []), event]

  const { error } = await (supabase as any).from('leads').update({
    agreement_data:        agreementData,
    agreement_created_at:  new Date().toISOString(),
    timeline,
    updated_at:            new Date().toISOString(),
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/leads/${id}`)
  return { success: true }
}

export async function addTimelineNoteAction(
  id: string,
  message: string,
  currentTimeline: any[]
) {
  const supabase = createClient()
  const event = timelineEvent('note', message)
  const timeline = [...(currentTimeline || []), event]

  const { error } = await (supabase as any)
    .from('leads')
    .update({ timeline, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(`/leads/${id}`)
  return { success: true }
}

export async function convertToClientAction(leadId: string, lead: any) {
  const supabase = createClient()

  const { data: client, error: clientError } = await (supabase as any)
    .from('clients')
    .insert({
      business_name: lead.business_name,
      contact_name:  lead.contact_name,
      contact_email: lead.contact_email,
      contact_phone: lead.contact_phone,
      address:       lead.address,
      suburb:        lead.suburb,
      state:         lead.state || 'QLD',
      postcode:      lead.postcode,
      start_date:    new Date().toISOString().split('T')[0],
      active:        true,
      notes:         lead.notes,
    })
    .select()
    .single()

  if (clientError) return { error: clientError.message }

  const event = timelineEvent(
    'converted',
    `Converted to client: ${lead.business_name}`,
    { client_id: client.id }
  )
  const timeline = [...(lead.timeline || []), event]

  const { error: leadError } = await (supabase as any).from('leads').update({
    status:              'won',
    converted_client_id: client.id,
    signed_date:         new Date().toISOString(),
    timeline,
    updated_at:          new Date().toISOString(),
  }).eq('id', leadId)

  if (leadError) return { error: leadError.message }

  revalidatePath('/leads')
  revalidatePath('/clients')
  return { success: true, clientId: client.id }
}

export async function deleteLeadAction(id: string) {
  const supabase = createClient()
  const { error } = await (supabase as any).from('leads').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/leads')
  return { success: true }
}
