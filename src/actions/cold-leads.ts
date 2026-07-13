'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export interface CommsEntry {
  kind: 'email' | 'follow_up_email' | 'sms'
  at: string          // ISO timestamp
  subject?: string
  body: string        // plain text of what was actually sent
}

export interface ColdLead {
  id: string
  business_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  suburb: string | null
  industry: string | null
  status: 'new' | 'called' | 'follow_up' | 'walkthrough' | 'converted' | 'not_interested'
  call_count: number
  last_called_at: string | null
  next_follow_up: string | null
  follow_up_note: string | null
  next_attempt: string | null
  has_spoken: boolean
  lead_id: string | null
  intro_email_sent_at: string | null
  intro_email_message_id: string | null
  intro_email_subject: string | null
  follow_up_email_sent_at: string | null
  follow_up_opt_in: boolean
  intro_sms_sent_at: string | null
  comms: CommsEntry[]
  call_log: CallLogEntry[]
  notes: string | null
  created_at: string
}

export interface CallLogEntry {
  at: string                 // ISO timestamp
  outcome: string            // no_answer | spoke | follow_up | walkthrough | not_interested
  note: string | null        // optional plain-English summary of the call
}

// How many days to wait before the next attempt after a no-answer — widens as
// attempts pile up so you don't burn a lead out.
function retryDays(callCount: number): number {
  if (callCount <= 1) return 1
  if (callCount === 2) return 2
  if (callCount === 3) return 4
  return 7
}

function addDays(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000)
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/').reverse().join('-')
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

export interface ColumnMap {
  business: number; contact: number; phone: number; email: number; suburb: number; industry: number
}

// Best-guess column mapping. Deliberately avoids picking an address column as
// the business name (a "Business Address" header would otherwise win).
function guessColumns(headers: string[]): ColumnMap {
  const has = (h: string, ...subs: string[]) => subs.some(s => h.includes(s))
  let business = headers.findIndex(h => has(h, 'business', 'company', 'organisation', 'organization', 'trading name') && !h.includes('address'))
  if (business === -1) business = headers.findIndex(h => h === 'name' || h.endsWith(' name') && !h.includes('contact') && !h.includes('first') && !h.includes('last'))
  return {
    business,
    contact:  detectColumn(headers, ['contact', 'owner', 'first name', 'full name', 'person', 'director', 'manager']),
    phone:    detectColumn(headers, ['phone', 'mobile', 'number', 'tel']),
    email:    detectColumn(headers, ['email', 'e-mail']),
    suburb:   detectColumn(headers, ['suburb', 'city', 'locality', 'area']),
    industry: detectColumn(headers, ['industry', 'category', 'type', 'niche', 'sector']),
  }
}

// Some lead lists put a street address in the "Company" cell. Detect that so we
// can fall back to a real company name derived from the website/email domain.
function looksLikeAddress(s: string | null): boolean {
  // Addresses in these lists always have commas plus either a leading street
  // number or a postcode. Requiring a comma avoids false hits on names like
  // "St James College" or "3M".
  if (!s || !s.includes(',')) return false
  return /^\s*\d/.test(s) || /\b\d{4,5}\b/.test(s)
}

function domainFrom(value: string | null): string | null {
  if (!value) return null
  let h = value.trim().toLowerCase()
  const at = h.indexOf('@')
  if (at >= 0) h = h.slice(at + 1)
  h = h.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  const parts = h.split('.').filter(Boolean)
  return parts.length >= 2 ? parts[0] : null
}

function companyFromDomain(sld: string | null): string | null {
  if (!sld) return null
  return sld.length <= 4 ? sld.toUpperCase() : sld.charAt(0).toUpperCase() + sld.slice(1)
}

// Step 1: parse and return columns + a guess so the user can confirm the mapping
export async function previewColdLeadsCsvAction(csvText: string) {
  const rows = parseCsv(csvText)
  if (rows.length < 2) return { error: 'Could not find any rows. Make sure the header row is included.' }
  const headers = rows[0].map(h => h.trim())
  const guess = guessColumns(headers.map(h => h.toLowerCase()))
  return { success: true as const, headers, guess, rowCount: rows.length - 1, sample: rows.slice(1, 4) }
}

// Step 2: import using an explicit mapping. A missing mapping means the call
// came from an out-of-date (cached) version of the app — refuse it so stale
// code can't silently import mis-mapped data, and prompt the user to update.
export async function importColdLeadsAction(csvText: string, mapping?: ColumnMap) {
  if (!mapping) {
    return { error: 'Your app needs to update. Fully close Core Cleaning (swipe it away in the app switcher) and reopen it, then import again — you’ll get a step to match your columns.' }
  }

  const rows = parseCsv(csvText)
  if (rows.length < 2) return { error: 'Could not find any rows. Paste the CSV including the header row.' }

  const col = mapping
  if (col.business < 0) return { error: 'Choose which column holds the business name.' }

  // Find a website/url column so we can recover a real company name when the
  // mapped business cell turns out to be a street address (common in JLL-style
  // exports where "Company" holds the office address).
  const headers = rows[0].map(h => h.trim().toLowerCase())
  const websiteCol = detectColumn(headers, ['website', 'url', 'domain', 'web'])

  const get = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() || null : null)

  const leads = rows.slice(1)
    .map(r => {
      let business = get(r, col.business)
      const email = get(r, col.email)
      if (looksLikeAddress(business)) {
        const derived = companyFromDomain(domainFrom(get(r, websiteCol)) || domainFrom(email))
        if (derived) business = derived
      }
      return {
        business_name: business,
        contact_name:  get(r, col.contact),
        phone:         get(r, col.phone),
        email,
        suburb:        get(r, col.suburb),
        industry:      get(r, col.industry),
      }
    })
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

  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }

  const statusMap: Record<string, string> = {
    no_answer:      'called',
    spoke:          'called',
    follow_up:      'follow_up',
    walkthrough:    'walkthrough',
    not_interested: 'not_interested',
  }

  // Reaching a person — these outcomes unlock the intro email / text
  const spokenOutcomes = ['spoke', 'follow_up', 'walkthrough']
  const newCount = lead.call_count + 1

  const update: Record<string, any> = {
    call_count: newCount,
    last_called_at: new Date().toISOString(),
    status: statusMap[outcome],
  }
  if (spokenOutcomes.includes(outcome)) update.has_spoken = true

  // No answer → auto-schedule the next attempt so the system tells you when to
  // try again. Any other outcome clears the retry timer.
  if (outcome === 'no_answer') {
    update.next_attempt = addDays(retryDays(newCount))
  } else {
    update.next_attempt = null
  }

  if (followUpDate) update.next_follow_up = followUpDate
  // follow_up_note drives the "follow-up due" banner — only set it for the dated outcomes.
  if ((outcome === 'follow_up' || outcome === 'walkthrough') && note !== undefined) {
    update.follow_up_note = note || null
  }

  // Append a timestamped summary entry to the call log (every outcome).
  update.call_log = [
    ...(Array.isArray(lead.call_log) ? lead.call_log : []),
    { at: new Date().toISOString(), outcome, note: note?.trim() || null },
  ]

  // Booking a walk-through means this is a real opportunity — push it into the
  // sales pipeline so cold calls and Leads stay in sync. Idempotent: only once.
  if (outcome === 'walkthrough' && !lead.lead_id) {
    const timeline = [{
      id: crypto.randomUUID(),
      type: 'status_change' as const,
      message: 'Created from a cold call (walkthrough booked)',
      timestamp: new Date().toISOString(),
    }]
    const { data: newLead } = await db.from('leads').insert({
      business_name: lead.business_name,
      contact_name:  lead.contact_name,
      contact_email: lead.email,
      contact_phone: lead.phone,
      suburb:        lead.suburb,
      state:         'QLD',
      source:        'Cold call',
      notes:         lead.notes,
      status:        'contacted',
      timeline,
    }).select('id').single()
    if (newLead?.id) update.lead_id = newLead.id
  }

  const { error } = await db.from('cold_leads').update(update).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/calls')
  revalidatePath('/leads')
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

// ─── Email (post-conversation) ───────────────────────────────────────────────
// Only sent after you have actually spoken with the lead and they have asked
// for something in writing. Plain, human copy. No dashes anywhere in the copy
// or subject lines (deliberate house style for these messages).

// Single source of truth for the sign-off on every cold-lead email (intro,
// follow-up, capability statement) — plain-text and HTML versions kept in sync.
const SIGNATURE_TEXT = 'Laith Humadi\nCore Cleaning\n0407 026 360\nadmin@corecleaning.services'

const SIGNATURE = `
  <p style="margin-top: 24px;">
    Laith Humadi<br/>
    Core Cleaning · Brisbane<br/>
    0407 026 360<br/>
    <a href="mailto:admin@corecleaning.services" style="color: #00250e;">admin@corecleaning.services</a>
  </p>`

const EMAIL_WRAP = (inner: string) =>
  `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.65; max-width: 560px;">${inner}${SIGNATURE}</div>`

// The imported "suburb" field often holds a full street address. Only echo it
// back when it's a clean locality, otherwise keep it generic.
function localityPhrase(suburb: string | null): string {
  if (!suburb) return ' in Brisbane'
  const s = suburb.trim()
  if (/\d/.test(s) || s.includes(',')) return ' in Brisbane'
  return ` around ${s}`
}

// Low-level threaded sender. Sets a Message-ID we control so a later follow-up
// can reference it (In-Reply-To / References) and land in the same email thread.
async function sendThreadedEmail(opts: {
  to: string
  subject: string
  html: string
  messageId?: string
  inReplyTo?: string
  attachments?: { filename: string; content: Buffer }[]
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'Email is not configured.' }

  const headers: Record<string, string> = {}
  if (opts.messageId) headers['Message-ID'] = opts.messageId
  if (opts.inReplyTo) {
    headers['In-Reply-To'] = opts.inReplyTo
    headers['References']  = opts.inReplyTo
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(apiKey)
    const res = await resend.emails.send({
      from: 'Laith at Core Cleaning <admin@corecleaning.services>',
      reply_to: 'admin@corecleaning.services',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      headers: Object.keys(headers).length ? headers : undefined,
      attachments: opts.attachments,
    })
    if (res.error) return { success: false, error: res.error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message ?? 'Email failed to send' }
  }
}

export async function sendIntroEmailAction(id: string, scheduleFollowUp = false) {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }
  if (!lead.has_spoken) return { error: 'Only send this once you’ve spoken with them on the phone.' }

  const firstName = (lead.contact_name || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const locality = localityPhrase(lead.suburb)

  // A Message-ID we own, so the follow-up can thread under this email
  const messageId = `<intro-${id}-${Date.now()}@corecleaning.services>`
  const subject = `Core Cleaning — capability statement for ${lead.business_name}`

  const bodyText =
    `${greeting}\n\n` +
    `Thanks for taking my call earlier — great to chat. As promised, I've attached Core Cleaning's capability statement so you can see exactly what we do.\n\n` +
    `We look after commercial cleaning for businesses${locality}: offices, clinics, retail and shared spaces — reliable teams, fixed monthly pricing and no lock-in.\n\n` +
    `Have a look when you get a moment. If you think we can help in any way, feel free to call me directly on 0407 026 360, or just reply here and I'll set up a quick, free site visit.\n\nThanks,\n${SIGNATURE_TEXT}`

  const html = EMAIL_WRAP(`
  <p>${greeting}</p>
  <p>Thanks for taking my call earlier — great to chat. As promised, I've attached Core Cleaning's capability statement so you can see exactly what we do.</p>
  <p>We look after commercial cleaning for businesses${locality}: offices, clinics, retail and shared spaces — reliable teams, fixed monthly pricing and no lock-in.</p>
  <p>Have a look when you get a moment. If you think we can help in any way, feel free to call me directly on <a href="tel:+61412844237">0407 026 360</a>, or just reply here and I'll set up a quick, free site visit.</p>`)

  // Attach the capability statement (best-effort — still send if the PDF service is down)
  let attachments: { filename: string; content: Buffer }[] | undefined
  try {
    const React = (await import('react')).default
    const { renderDocumentPdf } = await import('@/lib/documents/pdf')
    const { CapabilityDocument } = await import('@/components/documents/render/CapabilityDocument')
    const { DEFAULT_CAPABILITY } = await import('@/lib/documents/capability')
    const pdf = await renderDocumentPdf(React.createElement(CapabilityDocument, { data: DEFAULT_CAPABILITY as any }))
    attachments = [{ filename: 'Core Cleaning Capability Statement.pdf', content: pdf }]
  } catch { /* no attachment if the PDF service is unavailable */ }

  const result = await sendThreadedEmail({ to: lead.email, subject, html, messageId, attachments })
  if (!result.success) return { error: result.error || 'Email failed to send' }

  const now = new Date().toISOString()
  const comms: CommsEntry[] = [...(lead.comms ?? []), { kind: 'email', at: now, subject, body: bodyText }]
  await db.from('cold_leads').update({
    intro_email_sent_at: now,
    intro_email_message_id: messageId,
    intro_email_subject: subject,
    follow_up_opt_in: !!scheduleFollowUp,
    comms,
  }).eq('id', id)
  revalidatePath('/calls')
  return { success: true }
}

export async function sendFollowUpEmailAction(id: string) {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }
  if (!lead.intro_email_message_id || !lead.intro_email_subject) {
    return { error: 'Send the first email before following up.' }
  }

  const firstName = (lead.contact_name || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'

  // "Re:" + the original subject + the original Message-ID = same Gmail thread
  const subject = lead.intro_email_subject.startsWith('Re: ')
    ? lead.intro_email_subject
    : `Re: ${lead.intro_email_subject}`

  const bodyText =
    `${greeting}\n\n` +
    `Just following up on my note below. I know things get busy.\n\n` +
    `The offer still stands: a free site visit of about fifteen minutes and a fixed monthly price, with no obligation. If you would like me to come past, just reply with a day that suits and I will make it work.\n\nThanks,\n${SIGNATURE_TEXT}`

  const html = EMAIL_WRAP(`
  <p>${greeting}</p>
  <p>Just following up on my note below. I know things get busy.</p>
  <p>The offer still stands: a free site visit of about fifteen minutes and a fixed monthly price, with no obligation. If you would like me to come past, just reply with a day that suits and I will make it work.</p>`)

  const result = await sendThreadedEmail({
    to: lead.email,
    subject,
    html,
    inReplyTo: lead.intro_email_message_id,
  })
  if (!result.success) return { error: result.error || 'Email failed to send' }

  const now = new Date().toISOString()
  const comms: CommsEntry[] = [...(lead.comms ?? []), { kind: 'follow_up_email', at: now, subject, body: bodyText }]
  await db.from('cold_leads').update({ follow_up_email_sent_at: now, comms }).eq('id', id)
  revalidatePath('/calls')
  return { success: true }
}

// ─── Email previews (no send) — power the "review before sending" step ────────
// Mirror the exact subject + body the send actions produce, so what you see is
// what goes out. Returns the plain-text body for display.

export async function previewIntroEmailAction(id: string): Promise<{ to?: string; subject?: string; body?: string; error?: string }> {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }
  if (!lead.has_spoken) return { error: 'Only send this once you’ve spoken with them on the phone.' }

  const firstName = (lead.contact_name || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const locality = localityPhrase(lead.suburb)
  const subject = `Core Cleaning — capability statement for ${lead.business_name}`
  const body =
    `${greeting}\n\n` +
    `Thanks for taking my call earlier — great to chat. As promised, I've attached Core Cleaning's capability statement so you can see exactly what we do.\n\n` +
    `We look after commercial cleaning for businesses${locality}: offices, clinics, retail and shared spaces — reliable teams, fixed monthly pricing and no lock-in.\n\n` +
    `Have a look when you get a moment. If you think we can help in any way, feel free to call me directly on 0407 026 360, or just reply here and I'll set up a quick, free site visit.\n\nThanks,\n${SIGNATURE_TEXT}\n\n📎 Capability statement (PDF) attached`
  return { to: lead.email, subject, body }
}

export async function previewFollowUpEmailAction(id: string): Promise<{ to?: string; subject?: string; body?: string; error?: string }> {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }
  if (!lead.intro_email_message_id || !lead.intro_email_subject) return { error: 'Send the first email before following up.' }

  const firstName = (lead.contact_name || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const subject = lead.intro_email_subject.startsWith('Re: ') ? lead.intro_email_subject : `Re: ${lead.intro_email_subject}`
  const body =
    `${greeting}\n\n` +
    `Just following up on my note below. I know things get busy.\n\n` +
    `The offer still stands: a free site visit of about fifteen minutes and a fixed monthly price, with no obligation. If you would like me to come past, just reply with a day that suits and I will make it work.\n\nThanks,\n${SIGNATURE_TEXT}`
  return { to: lead.email, subject, body }
}

// ─── Capability statement email — short note + the real static PDF ───────────
// Distinct from sendIntroEmailAction above: no has_spoken gate, a short fixed
// message, the actual Capability Statement.pdf (not the generated document),
// and it moves the lead into the "Follow-ups" tab once sent.

function capabilityEmailContent(lead: ColdLead) {
  const firstName = (lead.contact_name || '').split(' ')[0]
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const subject = 'Core Cleaning Intro & Capability Statement'
  const bodyText =
    `${greeting}\n\n` +
    `I've attached our Capability Statement for your review. I'm happy to visit any commercial space for a quick, no-obligation 15 minute quote.\n\nThanks,\n${SIGNATURE_TEXT}`
  const html = EMAIL_WRAP(`
  <p>${greeting}</p>
  <p>I've attached our Capability Statement for your review. I'm happy to visit any commercial space for a quick, no-obligation 15 minute quote.</p>`)
  return { subject, bodyText, html }
}

export async function previewCapabilityEmailAction(id: string): Promise<{ to?: string; subject?: string; body?: string; error?: string }> {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }

  const { subject, bodyText } = capabilityEmailContent(lead)
  return { to: lead.email, subject, body: `${bodyText}\n\n📎 Capability Statement (PDF) attached` }
}

export async function sendCapabilityEmailAction(id: string, includeBondGuide = false) {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('*').eq('id', id).single()
  if (!lead) return { error: 'Lead not found' }
  if (!lead.email) return { error: 'This lead has no email address.' }

  const { subject, bodyText, html } = capabilityEmailContent(lead)

  const toAttach: { filename: string; assetPath: string }[] = [
    { filename: 'Core Cleaning Capability Statement.pdf', assetPath: 'src/lib/documents/assets/capability-statement.pdf' },
  ]
  if (includeBondGuide) {
    toAttach.push({ filename: 'Core Cleaning Bond Cleaning Price Guide.pdf', assetPath: 'src/lib/documents/assets/bond-cleaning-price-guide.pdf' })
  }

  // Read each file independently — if one is missing/unreadable, still send
  // with whichever attachments did load rather than dropping all of them.
  const attachments: { filename: string; content: Buffer }[] = []
  for (const a of toAttach) {
    try {
      const { readFile } = await import('node:fs/promises')
      const path = await import('node:path')
      const content = await readFile(path.join(process.cwd(), a.assetPath))
      attachments.push({ filename: a.filename, content })
    } catch { /* skip this one, still send with the rest */ }
  }

  const result = await sendThreadedEmail({ to: lead.email, subject, html, attachments: attachments.length ? attachments : undefined })
  if (!result.success) return { error: result.error || 'Email failed to send' }

  const now = new Date().toISOString()
  const comms: CommsEntry[] = [...(lead.comms ?? []), { kind: 'email', at: now, subject, body: bodyText }]
  // Move the lead into the Follow-ups tab now that they've been sent something to review.
  await db.from('cold_leads').update({
    comms,
    status: 'follow_up',
    next_follow_up: lead.next_follow_up ?? addDays(5),
  }).eq('id', id)

  revalidatePath('/calls')
  return { success: true }
}

export async function markIntroSmsSentAction(id: string, body?: string) {
  const db = createAdminClient() as any
  const { data: lead } = await db.from('cold_leads').select('comms').eq('id', id).single()
  const now = new Date().toISOString()
  const update: Record<string, any> = { intro_sms_sent_at: now }
  if (body) {
    update.comms = [...((lead?.comms as CommsEntry[]) ?? []), { kind: 'sms', at: now, body }]
  }
  await db.from('cold_leads').update(update).eq('id', id)
  revalidatePath('/calls')
  return { success: true }
}
