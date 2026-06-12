'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'

export interface ColdLead {
  id: string
  business_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  suburb: string | null
  industry: string | null
  status: 'new' | 'called' | 'follow_up' | 'walkthrough' | 'converted' | 'not_interested'
  call_count: number
  last_called_at: string | null
  next_follow_up: string | null
  follow_up_note: string | null
  intro_email_sent_at: string | null
  intro_sms_sent_at: string | null
  notes: string | null
  created_at: string
}

// ─── Import ──────────────────────────────────────────────────────────────────
// Accepts raw CSV text (exported from the purchased Google Sheet).
// Header detection is fuzzy so column names don't have to match exactly.

function detectColumn(headers: string[], candidates: string[]): number {
  for (const cand of candidates) {
    const i = headers.findIndex(h => h.includes(cand))
    if (i !== -1) return i
  }
  return -1
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some(f => f.trim() !== '')) rows.push(row)
  return rows
}

export async function importColdLeadsAction(csvText: string) {
  const rows = parseCsv(csvText)
  if (rows.length < 2) return { error: 'Could not find any rows. Paste the CSV including the header row.' }

  const headers = rows[0].map(h => h.trim().toLowerCase())
  const col = {
    business: detectColumn(headers, ['business', 'company', 'name of business', 'organisation', 'organization']),
    contact:  detectColumn(headers, ['contact', 'owner', 'first name', 'full name', 'person']),
    phone:    detectColumn(headers, ['phone', 'mobile', 'number', 'tel']),
    email:    detectColumn(headers, ['email', 'e-mail']),
    suburb:   detectColumn(headers, ['suburb', 'city', 'location', 'area', 'address']),
    industry: detectColumn(headers, ['industry', 'category', 'type', 'niche']),
  }
  // If no obvious business column, fall back to a generic "name" column
  if (col.business === -1) col.business = detectColumn(headers, ['name'])
  if (col.business === -1) return { error: `Couldn't find a business name column. Found columns: ${headers.join(', ')}` }

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() || null : null)

  const leads = rows.slice(1)
    .map(r => ({
      business_name: get(r, col.business),
      contact_name:  get(r, col.contact),
      phone:         get(r, col.phone),
      email:         get(r, col.email),
      suburb:        get(r, col.suburb),
      industry:      get(r, col.industry),
    }))
    .filter(l => l.business_name)

  if (leads.length === 0) return { error: 'No usable rows found under the header.' }

  const db = createAdminClient() as any

  // Skip duplicates already in the deck (same business name + phone)
  const { data: existing } = await db.from('cold_leads').select('business_name, phone')
  const seen = new Set((existing ?? []).map((e: any) => `${(e.business_name || '').toLowerCase()}::${e.phone || ''}`))
  const fresh = leads.filter(l => !seen.has(`${l.business_name!.toLowerCase()}::${l.phone || ''}`))

  if (fresh.length === 0) return { error: 'All of these leads are already in your deck.' }

  const { error } = await db.from('cold_leads').insert(fresh)
  if (error) return { error: error.message }

  revalidatePath('/calls')
  return { success: true, imported: fresh.length, skipped: leads.length - fresh.length }
}

// ─── Call logging ────────────────────────────────────────────────────────────

export async function logCallAction(
  id: string,
  outcome: 'no_answer' | 'spoke' | 'follow_up' | 'walkthrough' | 'not_interested',
  followUpDate?: string,
  note?: string
) {
  const db = createAdminClient() as any

  const { data: lead } = await db.from('cold_leads').select('call_count').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }

  const statusMap: Record<string, string> = {
    no_answer:      'called',
    spoke:          'called',
    follow_up:      'follow_up',
    walkthrough:    'walkthrough',
    not_interested: 'not_interested',
  }

  const update: Record<string, any> = {
    call_count: lead.call_count + 1,
    last_called_at: new Date().toISOString(),
    status: statusMap[outcome],
  }
  if (followUpDate) update.next_follow_up = followUpDate
  if (note !== undefined) update.follow_up_note = note || null

  const { error } = await db.from('cold_leads').update(update).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/calls')
  return { success: true }
}

export async function setFollowUpAction(id: string, date: string | null, note?: string) {
  const db = createAdminClient() as any
  const update: Record<string, any> = { next_follow_up: date }
  if (note !== undefined) update.follow_up_note = note || null
  if (date) update.status = 'follow_up'
  const { error } = await db.from('cold_leads').update(update).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/calls')
  return { success: true }
}

export async function updateColdLeadAction(id: string, fields: Partial<Pick<ColdLead, 'status' | 'notes' | 'phone' | 'email' | 'contact_name'>>) {
  const db = createAdminClient() as any
  const { error } = await db.from('cold_leads').update(fields).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/calls')
  return { success: true }
}

export async function deleteColdLeadAction(id: string) {
  const db = createAdminClient() as any
  const { error } = await db.from('cold_leads').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/calls')
  return { success: true }
}

// ─── Intro email ─────────────────────────────────────────────────────────────
// Plain, human copy. No marketing fluff — reads like a real person wrote it.

export async function sendIntroEmailAction(id: string) {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }

  const firstName = (lead.contact_name || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const area = lead.suburb ? ` around ${lead.suburb}` : ' in Brisbane'

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.65; max-width: 560px;">
  <p>${greeting}</p>
  <p>I'm Jackson from Delta Cleaning. We look after commercial cleaning for businesses${area} — offices, clinics, retail and shared spaces.</p>
  <p>I tried giving ${lead.business_name} a quick call. If your cleaning is up for review at any point, I'd be glad to come past, walk the site with you and put a fixed monthly price on it. The walk-through is free and takes about fifteen minutes.</p>
  <p>Either way, happy to be a contact for when you need one.</p>
  <p style="margin-top: 24px;">
    Jackson<br/>
    Delta Cleaning · Brisbane<br/>
    <a href="mailto:hello@deltacleaning.com.au" style="color: #1e3a5f;">hello@deltacleaning.com.au</a>
  </p>
</div>`

  const result = await sendEmail(
    lead.email,
    `Commercial cleaning for ${lead.business_name}`,
    html
  )
  if (!result.success) return { error: result.error || 'Email failed to send' }

  await db.from('cold_leads').update({ intro_email_sent_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/calls')
  return { success: true }
}

export async function markIntroSmsSentAction(id: string) {
  const db = createAdminClient() as any
  await db.from('cold_leads').update({ intro_sms_sent_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/calls')
  return { success: true }
}
