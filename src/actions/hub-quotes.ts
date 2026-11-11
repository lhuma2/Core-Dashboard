'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/require-staff'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { brisbaneToday } from '@/lib/hub/figures'
import {
  bodyOf, qCheck, qClean, qSaveCheck, quoteOf, quoteRef, quoteDoc, dLong, DECLINE_REASONS, QUOTE_COLS,
  type Quote, type QuoteRow,
} from '@/lib/hub/home-quotes'
import { snapFromQuote } from '@/lib/hub/home-agreements'

type Done = { ok: true; id: string; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'

// ── shape check (the editor sends the whole quote) ────────────
const s = (max: number) => z.string().max(max)
const task = z.object({ text: s(300) })
const quoteSchema = z.object({
  id: z.string().uuid().optional(), ref: s(20), status: z.enum(['draft', 'sent', 'changes', 'accepted', 'declined']), source: z.enum(['website', 'manual']),
  created: s(10), req: z.record(z.any()), name: s(200), email: s(320), phone: s(40),
  region: s(100), street: s(300), suburb: s(100), postcode: s(4), heading: s(200), intro: s(1000),
  type: z.enum(['deep', 'general']), every: z.enum(['oneoff', 'weekly', 'fortnightly', 'monthly']),
  beds: z.number().int().min(0).max(7), baths: z.number().int().min(0).max(7), living: z.number().int().min(0).max(7),
  start: s(10), hours: s(8), price: s(20), priceFromWeb: z.boolean(), notes: s(3000),
  scope: z.array(z.object({ heading: s(120), items: z.array(task).max(40) })).max(30),
  windows: z.object({ on: z.boolean(), price: s(20), detail: s(100), items: z.array(task).max(30), fromWeb: z.boolean(), webPrice: s(20), freq: z.enum(['each', 'monthly', 'quarterly', 'once']) }),
  carpet: z.object({ on: z.boolean(), items: z.array(task).max(30), price: s(20), rooms: s(2), halls: s(2), fromWeb: z.boolean(), webPrice: s(20) }),
}).passthrough()

function siteUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${h.get('x-forwarded-proto') || 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.corecleaning.services').replace(/\/$/, '')
}

const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function quoteEmail(q: Quote, link: string, revised: boolean, today: string): string {
  const d = quoteDoc(q, today)
  const first = esc((q.name || '').trim().split(/\s+/)[0] || 'there')
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#13201a">
  <div style="background:#00250e;color:#fff;padding:18px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">Core Cleaning</div>
  <div style="border:1px solid #d5dfda;border-top:0;border-radius:0 0 10px 10px;padding:22px 20px">
    <p style="margin:0 0 12px;font-size:16px">Hi ${first},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5">${revised ? 'Here is your updated quote' : 'Thanks for asking us to quote'}. ${esc(d.typeLabel)}, ${esc(d.freqLine.charAt(0).toLowerCase() + d.freqLine.slice(1))}: <strong>${esc(d.price)}${d.per ? ' ' + d.per : ''} incl GST</strong>.</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.5">You can read the full quote, and accept it, ask for changes or decline it, here:</p>
    <p style="margin:0 0 24px"><a href="${link}" style="background:#0f7a5a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">View your quote ${esc(q.ref)}</a></p>
    <p style="margin:0 0 6px;font-size:13px;color:#5d6b65">The quote is valid until ${esc(d.validTo)}.</p>
    <p style="margin:0;font-size:13px;color:#5d6b65">Questions? Reply to this email or call us.</p>
  </div></div>`
}

function agreementEmail(name: string, ref: string, link: string): string {
  const firstName = esc((name || '').trim().split(/\s+/)[0] || 'there')
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#13201a">
  <div style="background:#00250e;color:#fff;padding:18px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">Core Cleaning</div>
  <div style="border:1px solid #d5dfda;border-top:0;border-radius:0 0 10px 10px;padding:22px 20px">
    <p style="margin:0 0 12px;font-size:16px">Hi ${firstName},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5">Thank you for accepting your quote. Here is your service agreement (${esc(ref)}). Please read it, then sign at the bottom of the page.</p>
    <p style="margin:8px 0 20px"><a href="${link}" style="background:#0f7a5a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">Read and sign your agreement</a></p>
    <p style="margin:0;font-size:13px;color:#5d6b65">Questions? Reply to this email or call us on 0407 026 360.</p>
  </div></div>`
}

/** Emails the quote and marks it sent. On the test site (no email key) it marks it sent and says no email went. */
async function deliver(db: any, q: Quote, to: string, today: string): Promise<{ ok: true; tested: boolean } | { ok: false; error: string }> {
  const revised = q.status === 'sent' || q.status === 'changes'
  const link = `${siteUrl()}/q/${q.code}`
  const tested = !process.env.RESEND_API_KEY
  if (!tested) {
    const r = await sendEmail(to, `${revised ? 'Your updated quote' : 'Your quote'} from Core Cleaning (${q.ref})`, quoteEmail(q, link, revised, today))
    if (!r.success) return { ok: false, error: 'The email didn’t send, so the quote is still not sent. Check the address and try again.' }
  }
  const { error } = await db.from('home_quotes').update({ status: 'sent', sent_to: to, sent_at: today, email: to }).eq('id', q.id)
  if (error) return { ok: false, error: NO_DB }
  return { ok: true, tested }
}
const sentToast = (q: Quote, to: string, tested: boolean, revised: boolean) => tested
  ? `${revised ? 'Revised ' : ''}${q.ref} marked as sent to ${to}. This is the test site, so no email went out. Use Copy link to open the client’s page.`
  : `${revised ? 'Revised ' : ''}${q.ref} sent to ${to} from admin@. They can accept it straight from the email.`

function refresh() { revalidatePath('/hub/residential/quotes'); revalidatePath('/hub') }

async function loadQuote(db: any, id: string): Promise<Quote | null> {
  const { data } = await db.from('home_quotes').select(QUOTE_COLS).eq('id', id).maybeSingle()
  return data ? quoteOf(data as QuoteRow) : null
}

/** Save draft, Preview, or Send from the editor. */
export async function saveQuote(input: Quote, mode: 'draft' | 'preview' | 'send'): Promise<Done> {
  const denied = await requireStaff()
  if (denied) return { ok: false, error: denied }
  const parsed = quoteSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Some of the details didn’t come through properly. Refresh the page and try again.' }
  const today = brisbaneToday()
  const y = qClean(JSON.parse(JSON.stringify(parsed.data)) as Quote)
  const bad = qSaveCheck(y, today)
  if (bad) return { ok: false, error: bad }
  if (mode === 'send') { const b2 = qCheck(y, today); if (b2) return { ok: false, error: b2 } }

  const db = createClient() as any
  let cur: Quote | null = null
  if (y.id) {
    cur = await loadQuote(db, y.id)
    if (!cur) return { ok: false, error: 'That quote was deleted.' }
    if (cur.status === 'accepted' || cur.status === 'declined') return { ok: false, error: `${cur.ref} was ${cur.status} by the client, so it can’t be changed.` }
  }
  const row = { name: y.name, email: y.email || null, phone: (y.phone || '').trim() || null, body: bodyOf(y) }
  let id = y.id
  if (cur) {
    const { error } = await db.from('home_quotes').update(row).eq('id', cur.id)
    if (error) return { ok: false, error: NO_DB }
  } else {
    const { data: n, error: nErr } = await db.rpc('hub_next_number', { p_key: 'quote_res' })
    if (nErr || !n) return { ok: false, error: NO_DB }
    const { data, error } = await db.from('home_quotes').insert({ ...row, division: 'res', ref: quoteRef(n), source: 'manual', status: 'draft', created_on: today }).select('id').single()
    if (error) return { ok: false, error: NO_DB }
    id = data.id
  }
  const saved = await loadQuote(db, id!)
  if (!saved) return { ok: false, error: NO_DB }
  refresh()
  if (mode === 'send') {
    const revised = saved.status === 'sent' || saved.status === 'changes'
    const r = await deliver(db, saved, saved.email, today)
    if (!r.ok) return r
    refresh()
    return { ok: true, id: saved.id!, toast: sentToast(saved, saved.email, r.tested, revised) }
  }
  return { ok: true, id: saved.id!, toast: `${saved.ref} saved.` + (saved.status === 'sent' ? ' The client’s link shows the new version.' : '') }
}

/** Send to client / Send revised quote from the list or the preview. */
export async function sendQuote(id: string, to: string): Promise<Done> {
  const denied = await requireStaff()
  if (denied) return { ok: false, error: denied }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'That quote was deleted.' }
  const today = brisbaneToday()
  const db = createClient() as any
  const q = await loadQuote(db, id)
  if (!q) return { ok: false, error: 'That quote was deleted.' }
  if (q.status !== 'draft' && q.status !== 'changes') return { ok: false, error: `${q.ref} has already been sent.` }
  const email = (to || '').trim()
  const bad = qCheck({ ...q, email }, today)
  if (bad) return { ok: false, error: bad }
  const revised = q.status === 'changes'
  const r = await deliver(db, q, email, today)
  if (!r.ok) return r
  refresh()
  return { ok: true, id, toast: sentToast(q, email, r.tested, revised) }
}

/** Resend a sent quote to the same address. */
export async function resendQuote(id: string): Promise<Done> {
  const denied = await requireStaff()
  if (denied) return { ok: false, error: denied }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'That quote was deleted.' }
  const today = brisbaneToday()
  const db = createClient() as any
  const q = await loadQuote(db, id)
  if (!q) return { ok: false, error: 'That quote was deleted.' }
  if (q.status !== 'sent' || !q.sentTo) return { ok: false, error: `${q.ref} isn’t waiting on the client.` }
  if (process.env.RESEND_API_KEY) {
    const r = await sendEmail(q.sentTo, `Your quote from Core Cleaning (${q.ref})`, quoteEmail(q, `${siteUrl()}/q/${q.code}`, false, today))
    if (!r.success) return { ok: false, error: 'The email didn’t send. Try again in a minute.' }
    return { ok: true, id, toast: `Quote sent again to ${q.sentTo}.` }
  }
  return { ok: true, id, toast: `This is the test site, so no email went out. Use Copy link to open the client’s page.` }
}

/** Delete any quote except an accepted one. */
export async function deleteQuote(id: string): Promise<Done> {
  const denied = await requireStaff()
  if (denied) return { ok: false, error: denied }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: 'That quote was deleted.' }
  const db = createClient() as any
  const q = await loadQuote(db, id)
  if (!q) return { ok: true, id, toast: 'That quote was already deleted.' }
  if (q.status === 'accepted') return { ok: false, error: `${q.ref} was accepted, so it stays on record.` }
  const { error } = await db.from('home_quotes').delete().eq('id', id).neq('status', 'accepted')
  if (error) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, id, toast: `${q.ref} deleted.` }
}

// ── the client's side (public page, matched by the private code) ──
type Pub = { ok: true; message: string; next?: string } | { ok: false; error: string }
const codeOk = (c: string) => /^[0-9a-f]{64}$/.test(c || '')

async function openByCode(code: string): Promise<{ db: any; q: Quote } | null> {
  if (!codeOk(code)) return null
  const db = createAdminClient() as any
  const { data } = await db.from('home_quotes').select(QUOTE_COLS).eq('code', code).maybeSingle()
  return data ? { db, q: quoteOf(data as QuoteRow) } : null
}

export async function clientAskChanges(code: string, note: string): Promise<Pub> {
  const n = String(note || '').trim().slice(0, 2000)
  if (n.length < 3) return { ok: false, error: 'Tell us what you’d like changed.' }
  const o = await openByCode(code)
  if (!o) return { ok: false, error: 'This quote link isn’t valid any more.' }
  if (o.q.status !== 'sent') return { ok: false, error: 'This quote can’t be changed any more.' }
  const { error } = await o.db.from('home_quotes').update({ status: 'changes', change_note: n, changed_at: brisbaneToday() }).eq('id', o.q.id).eq('status', 'sent')
  if (error) return { ok: false, error: 'That didn’t go through. Try again in a minute.' }
  await sendPushToRole('admin', { title: `${o.q.name} asked for changes`, body: `${o.q.ref}: “${n.slice(0, 120)}”`, url: `/hub/residential/quotes/${o.q.id}/edit` }).catch(() => {})
  refresh()
  return { ok: true, message: 'Thanks. We’ll update your quote and email you the new one.' }
}

export async function clientDecline(code: string, reason: string, note: string): Promise<Pub> {
  if (!(DECLINE_REASONS as readonly string[]).includes(reason)) return { ok: false, error: 'Pick a reason.' }
  const o = await openByCode(code)
  if (!o) return { ok: false, error: 'This quote link isn’t valid any more.' }
  if (o.q.status !== 'sent') return { ok: false, error: 'This quote can’t be changed any more.' }
  const why = reason + (String(note || '').trim() ? ', ' + String(note).trim().slice(0, 1000) : '')
  const { error } = await o.db.from('home_quotes').update({ status: 'declined', declined_at: brisbaneToday(), decline_reason: why }).eq('id', o.q.id).eq('status', 'sent')
  if (error) return { ok: false, error: 'That didn’t go through. Try again in a minute.' }
  await sendPushToRole('admin', { title: `${o.q.name} declined ${o.q.ref}`, body: why.slice(0, 160), url: '/hub/residential/quotes?show=closed' }).catch(() => {})
  refresh()
  return { ok: true, message: 'Thanks for letting us know. This quote was declined.' }
}

export async function clientAccept(code: string, a: { street: string; suburb: string; postcode: string; start: string }): Promise<Pub> {
  const o = await openByCode(code)
  if (!o) return { ok: false, error: 'This quote link isn’t valid any more.' }
  const cur = o.q
  if (cur.status !== 'sent') return { ok: false, error: 'This quote can’t be accepted any more.' }
  const today = brisbaneToday()
  const street = String(a?.street || '').trim(), suburb = String(a?.suburb || '').trim(), postcode = String(a?.postcode || ''), start = String(a?.start || '')
  if (!street) return { ok: false, error: 'Add the street address.' }
  if (!suburb) return { ok: false, error: 'Add the suburb.' }
  if (!/^\d{4}$/.test(postcode)) return { ok: false, error: 'Postcode is 4 digits.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { ok: false, error: 'Pick the ' + (cur.every === 'oneoff' ? 'clean date.' : 'first clean date.') }
  if (start <= today) return { ok: false, error: 'Pick a date from tomorrow on.' }
  if (street.length > 300 || suburb.length > 100) return { ok: false, error: 'That address is too long.' }
  // The agreement's particulars, scope and clauses, locked in as it's created (already sent, to the quote's email).
  const snap = snapFromQuote(cur, { street, suburb, postcode, start })
  const { data: made, error } = await o.db.rpc('hub_accept_home_quote', { p_code: code, p_street: street, p_suburb: suburb, p_postcode: postcode, p_start: start, p_snap: snap })
  if (error) {
    const m = String(error.message || '')
    if (m.includes('not_open')) return { ok: false, error: 'This quote can’t be accepted any more.' }
    if (m.includes('bad_street')) return { ok: false, error: 'Add the street address.' }
    if (m.includes('bad_start')) return { ok: false, error: 'Pick a date from tomorrow on.' }
    return { ok: false, error: 'That didn’t go through. Nothing was saved, so you can try again.' }
  }
  const agreeCode = String(made?.code || '')
  if (agreeCode && cur.email && process.env.RESEND_API_KEY) {
    const link = `${siteUrl()}/agree/${agreeCode}`
    await sendEmail(cur.email, `Your service agreement from Core Cleaning (${made.ref})`, agreementEmail(cur.name, String(made.ref), link)).catch(() => {})
  }
  await sendPushToRole('admin', {
    title: `${cur.name} accepted ${cur.ref}`,
    body: `${cur.every === 'oneoff' ? 'Clean on' : 'First clean'} ${dLong(start)}. Their agreement ${made?.ref || ''} is ready to sign. Add the time, cleaner and cost.`,
    url: '/hub/residential/quotes?show=closed',
  }).catch(() => {})
  refresh()
  revalidatePath('/hub/residential/documents')
  return {
    ok: true,
    message: `Thank you, ${cur.name.split(/\s+/)[0]}. Your ${cur.every === 'oneoff' ? 'clean is booked for' : 'first clean is booked for'} ${dLong(start)}. We’ll be in touch to confirm the time. The last step is your service agreement.`,
    next: agreeCode ? `/agree/${agreeCode}?from=quote` : undefined,
  }
}

