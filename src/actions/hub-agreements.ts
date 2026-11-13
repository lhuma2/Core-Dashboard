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
import { EMAIL_RE, dLong } from '@/lib/hub/home-quotes'
import { agreeRef, refDiv, snapFromHome, type HomeLike } from '@/lib/hub/home-agreements'
import { AGRN, asDiv, divBase } from '@/lib/hub/div'

type Done = { ok: true; id: string; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const GONE = 'That agreement was removed.'
const HOME_COLS = 'id, name, email, street, suburb, state, postcode, kind, every, days, anchor, first_clean, start_time, price, beds, baths, carpet_rooms, hallways, windows_price, windows_freq'

function siteUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${h.get('x-forwarded-proto') || 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.corecleaning.services').replace(/\/$/, '')
}
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const first = (n: string) => (n || '').trim().split(/\s+/)[0] || 'there'

function mail(hi: string, lines: string[], button: string, link: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#13201a">
  <div style="background:#00250e;color:#fff;padding:18px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">Core Cleaning</div>
  <div style="border:1px solid #d5dfda;border-top:0;border-radius:0 0 10px 10px;padding:22px 20px">
    <p style="margin:0 0 12px;font-size:16px">Hi ${esc(hi)},</p>
    ${lines.map(l => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${l}</p>`).join('')}
    <p style="margin:8px 0 20px"><a href="${link}" style="background:#0f7a5a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">${esc(button)}</a></p>
    <p style="margin:0;font-size:13px;color:#5d6b65">Questions? Reply to this email or call us on 0407 026 360.</p>
  </div></div>`
}
const signMail = (name: string, ref: string, link: string) => mail(first(name), [
  'Here is your Core Cleaning service agreement (' + esc(ref) + '). Please read it, then sign at the bottom of the page.',
], 'Read and sign your agreement', link)

function refresh() { revalidatePath('/hub', 'layout') }

async function staffDb(): Promise<{ db: any } | { error: string }> {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  return { db: createClient() as any }
}
async function docById(db: any, id: string) {
  const { data } = await db.from('home_docs').select('id, ref, code, status, home_id, sent_to, homes(name)').eq('id', id).maybeSingle()
  return data as null | { id: string; ref: string; code: string; status: 'draft' | 'sent' | 'signed'; home_id: string | null; sent_to: string | null; homes: { name: string } | null }
}

/** Documents → New agreement, or Create agreement on a client's page. One open agreement per client at a time. */
export async function createAgreement(homeId: string): Promise<Done> {
  const s = await staffDb(); if ('error' in s) return { ok: false, error: s.error }
  if (!z.string().uuid().safeParse(homeId).success) return { ok: false, error: 'Pick a client.' }
  const { db } = s
  const { data: h, error: he } = await db.from('homes').select('id, name, division').eq('id', homeId).maybeSingle()
  if (he) return { ok: false, error: NO_DB }
  if (!h) return { ok: false, error: 'That client was removed.' }
  const { data: open, error: oe } = await db.from('home_docs').select('id').eq('home_id', homeId).in('status', ['draft', 'sent']).limit(1)
  if (oe) return { ok: false, error: NO_DB }
  if (open?.length) return { ok: false, error: `${h.name} already has an agreement waiting. Open it from Documents.` }
  const { data: n, error: ne } = await db.rpc('hub_next_number', { p_key: h.division === 'eol' ? 'agree_eol' : 'agree_res' })
  if (ne || !n) return { ok: false, error: NO_DB }
  const ref = agreeRef(n, asDiv(h.division))
  const { data: row, error } = await db.from('home_docs').insert({ division: asDiv(h.division), ref, home_id: homeId, status: 'draft' }).select('id').single()
  if (error || !row) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, id: row.id, toast: `Draft ${ref} for ${h.name} is ready. Check it, then send it for signature.` }
}

/** Send for signature: checks the email and the price, locks the particulars, fills the client's email if blank. */
export async function sendAgreement(id: string, to: string): Promise<Done> {
  const s = await staffDb(); if ('error' in s) return { ok: false, error: s.error }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: GONE }
  const { db } = s
  const d = await docById(db, id)
  if (!d) return { ok: false, error: GONE }
  if (d.status !== 'draft') return { ok: false, error: `${d.ref} has already been sent.` }
  const email = (to || '').trim()
  if (!EMAIL_RE.test(email) || email.length > 320) return { ok: false, error: 'Add the email to send the signing link to.' }
  if (!d.home_id) return { ok: false, error: 'This client was removed.' }
  const { data: h } = await db.from('homes').select(HOME_COLS).eq('id', d.home_id).maybeSingle()
  if (!h) return { ok: false, error: 'This client was removed.' }
  if (!(Number(h.price) > 0)) return { ok: false, error: `${h.name} has no price yet. Add it on their page first.` }
  const snap = snapFromHome({ ...h, price: Number(h.price), windows_price: h.windows_price == null ? null : Number(h.windows_price) } as HomeLike)
  const today = brisbaneToday()
  const tested = !process.env.RESEND_API_KEY
  if (!tested) {
    const r = await sendEmail(email, `Your service agreement from Core Cleaning (${d.ref})`, signMail(h.name, d.ref, `${siteUrl()}/agree/${d.code}`))
    if (!r.success) return { ok: false, error: 'The email didn’t send, so the agreement is still a draft. Check the address and try again.' }
  }
  const { error } = await db.from('home_docs').update({ status: 'sent', snap, sent_to: email, sent_at: today }).eq('id', id).eq('status', 'draft')
  if (error) return { ok: false, error: NO_DB }
  if (!h.email) await db.from('homes').update({ email }).eq('id', h.id)
  await db.from('home_history').insert({ home_id: h.id, date: today, text: `Agreement ${d.ref} sent to ${email}` })
  refresh()
  return {
    ok: true, id, toast: tested
      ? `${d.ref} marked as sent to ${email}. This is the test site, so no email went out. Use Copy signing link to open the client’s page.`
      : `${d.ref} sent to ${email} from admin@. You get a phone notification when they sign.`,
  }
}

export async function resendAgreement(id: string): Promise<Done> {
  const s = await staffDb(); if ('error' in s) return { ok: false, error: s.error }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: GONE }
  const d = await docById(s.db, id)
  if (!d) return { ok: false, error: GONE }
  if (d.status !== 'sent' || !d.sent_to) return { ok: false, error: `${d.ref} isn’t waiting to be signed.` }
  if (!process.env.RESEND_API_KEY) return { ok: true, id, toast: 'This is the test site, so no email went out. Use Copy signing link to open the client’s page.' }
  const r = await sendEmail(d.sent_to, `Your service agreement from Core Cleaning (${d.ref})`, signMail(d.homes?.name || '', d.ref, `${siteUrl()}/agree/${d.code}`))
  if (!r.success) return { ok: false, error: 'The email didn’t send. Try again in a minute.' }
  return { ok: true, id, toast: `Signing link sent again to ${d.sent_to}.` }
}

/** Delete a draft, or withdraw one waiting to sign (its link stops working). A signed agreement stays. */
export async function deleteAgreement(id: string): Promise<Done> {
  const s = await staffDb(); if ('error' in s) return { ok: false, error: s.error }
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: GONE }
  const { db } = s
  const d = await docById(db, id)
  if (!d) return { ok: true, id, toast: 'That agreement was already removed.' }
  if (d.status === 'signed') return { ok: false, error: `${d.ref} is signed, so it stays on record.` }
  const { error } = await db.from('home_docs').delete().eq('id', id).neq('status', 'signed')
  if (error) return { ok: false, error: NO_DB }
  if (d.status === 'sent' && d.home_id) await db.from('home_history').insert({ home_id: d.home_id, date: brisbaneToday(), text: `Agreement ${d.ref} withdrawn` })
  refresh()
  return { ok: true, id, toast: d.status === 'sent' ? `${d.ref} withdrawn. The link no longer works.` : `${d.ref} removed.` }
}

// ── the client signs (public page, matched by the private code) ──
type Pub = { ok: true; message: string } | { ok: false; error: string }

export async function clientSign(code: string, name: string, agree: boolean): Promise<Pub> {
  if (!/^[0-9a-f]{64}$/.test(code || '')) return { ok: false, error: 'This agreement link isn’t valid any more.' }
  const nm = String(name || '').trim().replace(/\s+/g, ' ')
  if (nm.length < 2) return { ok: false, error: 'Type your full name to sign.' }
  if (nm.length > 200) return { ok: false, error: 'That name is too long.' }
  if (!agree) return { ok: false, error: 'Tick the box to agree.' }
  const db = createAdminClient() as any
  const { data, error } = await db.rpc('hub_sign_home_doc', { p_code: code, p_name: nm })
  if (error) {
    const m = String(error.message || '')
    if (m.includes('not_open') || m.includes('not_found')) return { ok: false, error: 'This agreement can’t be signed any more.' }
    if (m.includes('bad_name')) return { ok: false, error: 'Type your full name to sign.' }
    return { ok: false, error: 'That didn’t go through. Nothing was saved, so you can try again.' }
  }
  const ref = String(data?.ref || '')
  const link = `${siteUrl()}/agree/${code}`
  if (process.env.RESEND_API_KEY) {
    const copy = (hi: string) => mail(hi, [`${esc(nm)} signed ${AGRN[refDiv(ref)].toLowerCase()} ${esc(ref)} on ${esc(dLong(brisbaneToday()))}.`, 'You can open the signed copy, and save it as a PDF, here:'], 'Open the signed agreement', link)
    if (data?.sent_to) await sendEmail(data.sent_to, `Your signed service agreement (${ref})`, copy(first(nm))).catch(() => {})
    await sendEmail('admin@corecleaning.services', `${nm} signed ${ref}`, copy('Laith')).catch(() => {})
  }
  await sendPushToRole('admin', { title: `${nm} signed ${ref}`, body: `Their ${AGRN[refDiv(ref)].toLowerCase()} is signed.`, url: divBase(refDiv(ref)) + '/documents?show=signed' }).catch(() => {})
  refresh()
  return { ok: true, message: `Thank you, ${first(nm)}. Your agreement is signed. A signed copy is on its way to your email, and you can save it below.` }
}
