'use server'

// Commercial → Prospecting: Call (adds one to the count), Log walk-through / follow-up (emails the capability
// statement), Delete lead (with Undo), Upload CSV. Words from the mock-up. cold_leads has no RLS policies, so every
// action checks the person is staff and then uses the server key.

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/require-staff'
import { sendEmail } from '@/lib/email'
import { emailSignature } from '@/lib/hub/email-signature'
import { capabilityStatement } from '@/lib/hub/capability'
import { parseCsv, guessLeadCols, leadKey, type LeadStatus } from '@/lib/hub/prospecting'

type R = { ok: true; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const GONE = 'That lead was removed. Refresh the page.'
const uuid = (v: unknown) => z.string().uuid().safeParse(v).success
const fail = (error: string): R => ({ ok: false, error })
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const refresh = () => revalidatePath('/hub/commercial/prospecting')
const STATUSES: LeadStatus[] = ['new', 'called', 'follow_up', 'walkthrough', 'converted', 'not_interested']

function siteUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${h.get('x-forwarded-proto') || 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.corecleaning.services').replace(/\/$/, '')
}

async function lead(id: string) {
  const denied = await requireStaff(); if (denied) return { error: denied }
  if (!uuid(id)) return { error: GONE }
  const db = createAdminClient() as any
  const { data, error } = await db.from('cold_leads').select('*').eq('id', id).maybeSingle()
  if (error) return { error: NO_DB }
  if (!data) return { error: GONE }
  return { db, l: data as any }
}

/** Call: the phone dialler opens from the link; this adds one to the call count. */
export async function callLead(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const o = await lead(id); if ('error' in o) return { ok: false, error: o.error! }
  const { db, l } = o
  const now = new Date().toISOString()
  const { error } = await db.from('cold_leads').update({
    call_count: (Number(l.call_count) || 0) + 1, last_called_at: now,
    call_log: [...(Array.isArray(l.call_log) ? l.call_log : []), { at: now, outcome: 'called', note: null }],
  }).eq('id', id)
  if (error) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true }
}

function capEmail(l: any, kind: 'walkthrough' | 'follow_up', site: string): { subject: string; html: string; text: string } {
  const first = String(l.contact_name || '').trim().split(/\s+/)[0]
  const hi = first ? `Hi ${first},` : 'Hi,'
  const lines = kind === 'walkthrough'
    ? ['Thanks for your time on the phone today. As promised, I’ve attached Core Cleaning’s capability statement so you can see what we do before the walk-through.',
       'If anything comes up before then, call me on 0407 026 360 or just reply here.']
    : ['Thanks for taking my call today. As promised, I’ve attached Core Cleaning’s capability statement so you can see what we do.',
       'Have a look when you get a moment. If you’d like a free site visit and a fixed monthly price, just reply here or call me on 0407 026 360.']
  const subject = `Core Cleaning capability statement for ${l.business_name}`
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#13201a;font-size:15px;line-height:1.5">
  <p>${esc(hi)}</p>${lines.map(x => `<p>${esc(x)}</p>`).join('')}
  <p>Kind regards,</p>
  ${emailSignature(site)}
</div>`
  return { subject, html, text: [hi, ...lines, 'Kind regards,', 'Laith Humadi', 'Core Cleaning'].join('\n\n') }
}

/** Log → Walk-through or Follow-up. Emails the capability statement when they have an email. `prev` is for Undo. */
export async function logLead(id: string, kind: 'walkthrough' | 'follow_up'): Promise<{ ok: true; toast: string; prev: LeadStatus } | { ok: false; error: string }> {
  if (kind !== 'walkthrough' && kind !== 'follow_up') return { ok: false, error: 'Choose Walk-through or Follow-up.' }
  const o = await lead(id); if ('error' in o) return { ok: false, error: o.error! }
  const { db, l } = o
  const label = kind === 'walkthrough' ? 'walk-through' : 'follow-up'
  const prev: LeadStatus = STATUSES.includes(l.status) ? l.status : 'new'
  const now = new Date().toISOString()
  const email = String(l.email || '').trim()
  const patch: any = { status: kind, has_spoken: true, call_log: [...(Array.isArray(l.call_log) ? l.call_log : []), { at: now, outcome: kind, note: null }] }
  let toast = `Logged ${label}. No email on file, so nothing was sent.`
  if (email) {
    if (!process.env.RESEND_API_KEY) toast = `Logged ${label}. This is the test site, so the capability statement wasn’t emailed to ${email}.`
    else {
      const pdf = await capabilityStatement()
      const m = capEmail(l, kind, siteUrl())
      const r = await sendEmail(email, m.subject, m.html, pdf ? [{ filename: 'Core Cleaning Capability Statement.pdf', content: pdf }] : undefined)
      if (!r.success) return { ok: false, error: 'The email didn’t send, so nothing was logged. Check your connection and try again.' }
      patch.comms = [...(Array.isArray(l.comms) ? l.comms : []), { kind: 'email', at: now, subject: m.subject, body: m.text }]
      toast = `Logged ${label}. Capability statement emailed to ${email}.`
    }
  }
  const { error } = await db.from('cold_leads').update(patch).eq('id', id)
  if (error) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, toast, prev }
}

/** Undo a log: puts the lead back where it was (an email that went out can't be unsent). */
export async function undoLeadLog(id: string, prev: string): Promise<R> {
  const o = await lead(id); if ('error' in o) return fail(o.error!)
  const st: LeadStatus = STATUSES.includes(prev as LeadStatus) ? (prev as LeadStatus) : 'new'
  const { error } = await o.db.from('cold_leads').update({ status: st }).eq('id', id)
  if (error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: 'Undone.' }
}

const KEEP = ['id', 'business_name', 'contact_name', 'phone', 'email', 'suburb', 'industry', 'address', 'website', 'status', 'notes', 'lead_id', 'last_called_at', 'next_follow_up', 'intro_email_sent_at', 'created_at', 'call_log', 'follow_up_opt_in', 'call_count', 'has_spoken', 'next_attempt', 'follow_up_note', 'intro_email_message_id', 'intro_email_subject', 'follow_up_email_sent_at', 'intro_sms_sent_at', 'comms']

/** Delete lead. Returns the row so Undo can put it back exactly as it was. */
export async function deleteLead(id: string): Promise<{ ok: true; toast: string; row: Record<string, unknown> } | { ok: false; error: string }> {
  const o = await lead(id); if ('error' in o) return { ok: false, error: o.error! }
  const { error } = await o.db.from('cold_leads').delete().eq('id', id)
  if (error) return { ok: false, error: NO_DB }
  refresh()
  const row: Record<string, unknown> = {}
  for (const k of KEEP) if (k in o.l) row[k] = o.l[k]
  return { ok: true, toast: `Deleted ${o.l.business_name || 'that lead'}.`, row }
}

export async function restoreLead(row: Record<string, unknown>): Promise<R> {
  const denied = await requireStaff(); if (denied) return fail(denied)
  if (!row || !uuid(row.id) || !String(row.business_name || '').trim()) return fail(GONE)
  const clean: Record<string, unknown> = {}
  for (const k of KEEP) if (k in row) clean[k] = row[k]
  const db = createAdminClient() as any
  const { error } = await db.from('cold_leads').insert(clean)
  if (error) return fail(/duplicate|unique/i.test(String(error.message)) ? 'That lead is already back.' : NO_DB)
  refresh()
  return { ok: true, toast: `${row.business_name} is back on your list.` }
}

/** Upload CSV: columns found by their header; leads already on the list (same business and phone) are skipped. */
export async function importLeads(csv: string): Promise<R> {
  const denied = await requireStaff(); if (denied) return fail(denied)
  const text = String(csv || '')
  if (text.length > 3_000_000) return fail('That file is too big. Split it into files under 3 MB.')
  const rows = parseCsv(text)
  if (rows.length < 2) return fail('That file has no leads in it. Check it’s a CSV with a header row.')
  const c = guessLeadCols(rows[0])
  if (c.business < 0) return fail('Couldn’t find the business name column. Name it Business or Company in the header row.')
  const get = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim().replace(/\s+/g, ' ') : '')
  const all = rows.slice(1).map(r => ({
    business_name: get(r, c.business).slice(0, 200), contact_name: get(r, c.contact).slice(0, 200) || null, phone: get(r, c.phone).slice(0, 40) || null,
    email: get(r, c.email).slice(0, 200) || null, address: get(r, c.address).slice(0, 300) || null, suburb: get(r, c.suburb).slice(0, 100) || null,
    industry: get(r, c.industry).slice(0, 100) || null, website: get(r, c.website).slice(0, 200) || null, status: 'new',
  })).filter(l => l.business_name)
  if (!all.length) return fail('That file has no leads in it. Check it’s a CSV with a header row.')
  if (all.length > 5000) return fail('That’s more than 5,000 leads. Split the file and upload it in parts.')
  const db = createAdminClient() as any
  const { data: have, error } = await db.from('cold_leads').select('business_name, phone').limit(20000)
  if (error) return fail(NO_DB)
  const seen = new Set(((have || []) as any[]).map(h => leadKey(h.business_name || '', h.phone || '')))
  const fresh = all.filter(l => { const k = leadKey(l.business_name, l.phone || ''); if (seen.has(k)) return false; seen.add(k); return true })
  const skipped = all.length - fresh.length
  if (!fresh.length) return { ok: true, toast: all.length === 1 ? 'Nothing new: the lead in that file is already here.' : `Nothing new: all ${all.length} leads in that file are already here.` }
  const ins = await db.from('cold_leads').insert(fresh)
  if (ins.error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: `Imported ${fresh.length} new ${fresh.length === 1 ? 'lead' : 'leads'}.` + (skipped ? ` Skipped ${skipped} already on your list.` : '') }
}
