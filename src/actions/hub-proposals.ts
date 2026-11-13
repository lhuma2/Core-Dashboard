'use server'

// Commercial → Documents → Proposals: save, send (PDF + accept link from admin@), resend (new link, fresh 30 days),
// delete, and the client's own page (accept, ask for a revised quote, decline). Words from the mock-up.

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/require-staff'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { brisbaneToday } from '@/lib/hub/figures'
import { offOn } from '@/lib/hub/timetable'
import { emailSignature } from '@/lib/hub/email-signature'
import { proposalPdf } from '@/lib/hub/proposal-pdf'
import { loadProp, reqClientOf } from '@/lib/hub/documents-data'
import {
  COMM_CLAUSES, DECLINE_WHY, SPEC_CLAUSES, EMAIL_OK, bodyOf, checkProp, cleanProp, dLong, draftCheck, isoAdd, jobName, propDoc, propSnap,
  quoteRef, tidy, type Pf, type Prop,
} from '@/lib/hub/proposals'

type Done = { ok: true; id: string; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const GONE = 'That proposal was deleted.'
const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const uuidOk = (v: unknown) => z.string().uuid().safeParse(v).success

function siteUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${h.get('x-forwarded-proto') || 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.corecleaning.services').replace(/\/$/, '')
}
function refresh() { revalidatePath('/hub', 'layout') }

// ── shape check (the form sends the whole proposal) ──
const s = (max: number) => z.string().max(max)
const task = z.object({ text: s(300), orig: s(300).optional(), src: z.array(s(40)).max(20).optional() })
const pfSchema = z.object({
  id: z.string().uuid().nullable(), ptype: z.enum(['comm', 'spec']), ref: s(30), created: s(10), status: z.enum(['draft', 'sent', 'revision', 'accepted', 'declined']),
  biz: s(200), contact: s(200), email: s(320), address: s(300),
  leadId: z.string().uuid().nullable(), clientId: z.string().uuid().nullable(), requestId: z.string().uuid().nullable(),
  freq: z.enum(['d5', 'w3', 'w2', 'w1', 'f1']), when: z.enum(['after', 'early', 'day', 'weekend']), price: s(20),
  presets: z.record(z.boolean()), sow: z.array(z.object({ heading: s(120), src: z.array(s(40)).max(20).optional(), items: z.array(task).max(40) })).max(20),
  addons: z.array(z.object({ kind: s(60), custom: s(120), freq: s(20), desc: s(300), price: s(20), items: z.array(z.object({ text: s(300) })).max(30).optional() })).max(6),
  jobs: z.array(z.object({ kind: s(60), custom: s(120), area: s(300), included: s(4000), price: s(20) })).max(10),
  date2: s(10), window: z.enum(['day', 'after', 'weekend']), excl: s(1000), uploadName: s(200),
}).passthrough()

function proposalEmail(p: Prop, link: string, site: string, validTo: string, again: boolean): string {
  const first = esc(tidy(p.contact).split(' ')[0] || 'there')
  const what = p.ptype === 'comm' ? 'commercial cleaning' : (p.jobs.map(jobName).filter(Boolean).join(', ').toLowerCase() || 'specialist cleaning')
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#13201a;font-size:15px;line-height:1.5">
  <p>Hi ${first},</p>
  <p>${again ? 'Here is our proposal again' : 'Thank you for the opportunity to quote'} for the ${esc(what)} at ${esc(p.biz)}. The proposal (${esc(p.ref)}) is attached as a PDF.</p>
  <p>You can read it and accept it online, or ask for changes, here:</p>
  <p><a href="${link}" style="background:#0f7a5a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">View your proposal</a></p>
  <p>It’s valid for 30 days, until ${esc(validTo)}. If anything needs adjusting, just reply here or call me on 0407 026 360.</p>
  <p>Kind regards,</p>
  ${emailSignature(site)}
</div>`
}

async function staff(): Promise<{ db: any } | { error: string }> {
  const denied = await requireStaff()
  return denied ? { error: denied } : { db: createClient() as any }
}

/** Save draft, or Save and preview (which needs every field). Returns the id for the preview. */
export async function saveProposal(input: Pf, mode: 'draft' | 'preview'): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  const parsed = pfSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Some of the details didn’t come through properly. Refresh the page and try again.' }
  const today = brisbaneToday()
  const y = cleanProp(parsed.data as unknown as Pf)
  const bad = mode === 'draft' ? draftCheck(y) : checkProp(y, today)
  if (bad) return { ok: false, error: bad }
  const { db } = st
  const row = {
    ptype: y.ptype, biz: y.biz, contact: y.contact || null, email: y.email || null, address: y.address || null, body: bodyOf(y),
    lead_id: y.leadId, client_id: y.clientId, request_id: y.requestId,
  }
  let id = y.id
  if (id) {
    const { data: cur, error } = await db.from('proposals').select('id, ref, status, ptype').eq('id', id).is('deleted_at', null).maybeSingle()
    if (error) return { ok: false, error: NO_DB }
    if (!cur) return { ok: false, error: GONE }
    if (cur.status === 'accepted') return { ok: false, error: `${cur.ref} was accepted, so it can’t be changed.` }
    if (cur.status === 'sent') return { ok: false, error: `${cur.ref} is with the client. Wait for their reply, or Revise it if they ask for changes.` }
    if (cur.ptype !== y.ptype) return { ok: false, error: 'Some of the details didn’t come through properly. Refresh the page and try again.' }
    // Saving a declined or revision-requested proposal reopens it as a draft with the same ref.
    const { error: uErr } = await db.from('proposals').update({ ...row, status: 'draft' }).eq('id', id).neq('status', 'accepted')
    if (uErr) return { ok: false, error: NO_DB }
  } else {
    const year = today.slice(0, 4)
    const { data: n, error: nErr } = await db.rpc('hub_next_number', { p_key: 'comm_' + year })
    if (nErr || !n) return { ok: false, error: NO_DB }
    const { data, error } = await db.from('proposals').insert({ ...row, ref: quoteRef(year, n), status: 'draft', created_on: today }).select('id').single()
    if (error || !data) return { ok: false, error: NO_DB }
    id = data.id
  }
  refresh()
  return { ok: true, id: id!, toast: `Draft saved for ${y.biz}.` + (y.requestId ? ' Send it from Documents, Proposals when it’s ready.' : '') }
}

async function emailProposal(p: Prop, to: string, again: boolean): Promise<{ ok: true; tested: boolean } | { ok: false; error: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: true, tested: true }
  const today = brisbaneToday(), site = siteUrl()
  const doc = propDoc({ ...p, sentAt: today }, today)
  const pdf = await proposalPdf(doc, site)
  const r = await sendEmail(to, `Your proposal from Core Cleaning (${p.ref})`, proposalEmail(p, `${site}/proposal/${p.code}`, site, dLong(isoAdd(today, 30)), again),
    pdf ? [{ filename: `Core Cleaning proposal ${p.ref}.pdf`, content: pdf }] : undefined)
  return r.success ? { ok: true, tested: false } : { ok: false, error: 'The email didn’t send, so the proposal is still not sent. Check the address and try again.' }
}

/** Send to client: needs a finished proposal and an email. */
export async function sendProposal(id: string, to: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  if (!uuidOk(id)) return { ok: false, error: GONE }
  const p = await loadProp(id, st.db)
  if (!p) return { ok: false, error: GONE }
  if (p.status !== 'draft') return { ok: false, error: `${p.ref} has already been sent.` }
  const today = brisbaneToday()
  const bad = checkProp(p, today)
  if (bad) return { ok: false, error: 'This proposal isn’t finished yet: ' + bad + ' Open Edit to fix it.' }
  const email = String(to || '').trim()
  if (!EMAIL_OK(email) || email.length > 320) return { ok: false, error: 'Enter a valid email address.' }
  const r = await emailProposal(p, email, false)
  if (!r.ok) return r
  const { error } = await st.db.from('proposals').update({
    status: 'sent', sent_to: email, sent_at: today, email: p.email || email, revision_at: null, revision_note: null, declined_at: null, decline_reason: null, decline_note: null,
  }).eq('id', id).eq('status', 'draft')
  if (error) return { ok: false, error: NO_DB }
  refresh()
  const linked = p.requestId ? ' It also shows under their request in the client portal.' : ''
  return {
    ok: true, id, toast: r.tested
      ? `${p.ref} marked as sent to ${email}. This is the test site, so no email went out. Use Copy link to open the client’s page.${linked}`
      : `Proposal emailed to ${email} from admin@corecleaning.services, with the PDF attached and a link to accept online.${linked}`,
  }
}

/** Resend: a new link (the old one stops working) and a fresh 30 days. */
export async function resendProposal(id: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  if (!uuidOk(id)) return { ok: false, error: GONE }
  const p = await loadProp(id, st.db)
  if (!p) return { ok: false, error: GONE }
  if (p.status !== 'sent' || !p.sentTo) return { ok: false, error: `${p.ref} isn’t waiting on the client.` }
  const code = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
  const today = brisbaneToday()
  const r = await emailProposal({ ...p, code }, p.sentTo, true)
  if (!r.ok) return { ok: false, error: 'The email didn’t send. Try again in a minute.' }
  const { error } = await st.db.from('proposals').update({ code, sent_at: today }).eq('id', id).eq('status', 'sent')
  if (error) return { ok: false, error: NO_DB }
  refresh()
  return {
    ok: true, id, toast: r.tested
      ? `${p.ref} has a new link, valid for 30 days from today. This is the test site, so no email went out. Use Copy link to open the client’s page.`
      : `Proposal sent again to ${p.sentTo}. It’s valid for 30 days from today.`,
  }
}

/** Delete a draft or declined proposal (kept on file, out of the list). Accepted ones stay. */
export async function deleteProposal(id: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  if (!uuidOk(id)) return { ok: false, error: GONE }
  const { data: p, error } = await st.db.from('proposals').select('id, ref, status').eq('id', id).is('deleted_at', null).maybeSingle()
  if (error) return { ok: false, error: NO_DB }
  if (!p) return { ok: true, id, toast: 'That proposal was already deleted.' }
  if (p.status !== 'draft' && p.status !== 'declined') return { ok: false, error: p.status === 'accepted' ? `${p.ref} was accepted, so it stays on record.` : `${p.ref} is with the client, so it can’t be deleted.` }
  const { error: dErr } = await st.db.from('proposals').update({ deleted_at: new Date().toISOString() }).eq('id', id).in('status', ['draft', 'declined'])
  if (dErr) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, id, toast: 'Proposal deleted.' }
}

// ── the client's page (no login: matched by the private code in the link) ──
type Pub = { ok: true; message: string; next?: string } | { ok: false; error: string }
const codeOk = (c: string) => /^[0-9a-f]{64}$/.test(c || '')
const DEAD = 'This proposal link isn’t valid any more. Contact Core Cleaning on 0407 026 360 for a new one.'

async function byCode(code: string): Promise<{ db: any; p: Prop } | null> {
  if (!codeOk(code)) return null
  const db = createAdminClient() as any
  const { data } = await db.from('proposals').select('id').eq('code', code).is('deleted_at', null).maybeSingle()
  if (!data) return null
  const p = await loadProp(data.id, db)
  return p ? { db, p } : null
}

async function tellLaith(subject: string, lines: string[], push: { title: string; body: string; url: string }) {
  if (process.env.RESEND_API_KEY) await sendEmail('admin@corecleaning.services', subject, `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5">${lines.map(l => `<p>${l}</p>`).join('')}</div>`).catch(() => {})
  await sendPushToRole('admin', push).catch(() => {})
}

export async function clientAcceptProposal(code: string, worksDate: string): Promise<Pub> {
  const o = await byCode(code)
  if (!o) return { ok: false, error: DEAD }
  const p = o.p, today = brisbaneToday()
  if (p.status !== 'sent') return { ok: false, error: 'This proposal can’t be accepted any more.' }
  if (!p.sentAt || isoAdd(p.sentAt, 30) < today) return { ok: false, error: 'This proposal has expired. Contact Core Cleaning on 0407 026 360 for an updated one.' }
  const rc = await reqClientOf(o.db, p, today)
  if (rc) {
    const wd = p.date2 && p.date2 >= today ? p.date2 : String(worksDate || '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(wd)) return { ok: false, error: 'Choose the day you’d like the works done.' }
    if (wd < today) return { ok: false, error: 'That day has already passed. Choose another day.' }
    if (offOn({ status: rc.status, paused_from: rc.paused_from, resume_on: rc.resume_on, ended_on: rc.ended_on }, wd)) return { ok: false, error: 'Your service is paused on that day. Choose another day.' }
    const { error } = await o.db.rpc('hub_accept_proposal', { p_code: code, p_snap: null, p_book: { date: wd } })
    if (error) return { ok: false, error: /not_open|expired/.test(String(error.message)) ? 'This proposal can’t be accepted any more.' : 'That didn’t go through. Nothing was saved, so you can try again.' }
    const names = p.jobs.map(jobName).filter(Boolean).join(', ') || 'The works'
    await tellLaith(`${p.biz} accepted ${p.ref}`, [`<strong>${esc(p.biz)}</strong> accepted ${esc(p.ref)}.`, `${esc(names)} booked for ${esc(dLong(wd))}. Assign a cleaner in the timetable. Their service agreement covers it.`],
      { title: `${p.biz} accepted ${p.ref}`, body: `${names} booked for ${dLong(wd)}. Assign a cleaner.`, url: '/hub/commercial/requests' })
    refresh()
    return { ok: true, message: `Thank you. ${names} ${names === 'The works' ? 'are' : 'is'} booked for ${dLong(wd)}. It shows in your client portal, and we’ll confirm the time.` }
  }
  const snap = { prop: propSnap(p, today), clauses: p.ptype === 'spec' ? SPEC_CLAUSES : COMM_CLAUSES }
  const { data: made, error } = await o.db.rpc('hub_accept_proposal', { p_code: code, p_snap: snap, p_book: null })
  if (error) {
    const m = String(error.message || '')
    if (m.includes('not_open')) return { ok: false, error: 'This proposal can’t be accepted any more.' }
    if (m.includes('expired')) return { ok: false, error: 'This proposal has expired. Contact Core Cleaning on 0407 026 360 for an updated one.' }
    return { ok: false, error: 'That didn’t go through. Nothing was saved, so you can try again.' }
  }
  await tellLaith(`${p.biz} accepted ${p.ref}`, [`<strong>${esc(p.biz)}</strong> accepted proposal ${esc(p.ref)}.`, `Their ${p.ptype === 'spec' ? 'works agreement' : 'service agreement'} ${esc(made?.ref || '')} is on its way to be signed. You get another email when they sign.`],
    { title: `${p.biz} accepted ${p.ref}`, body: `They’re signing the ${p.ptype === 'spec' ? 'works' : 'service'} agreement now.`, url: '/hub/commercial/documents' })
  refresh()
  return { ok: true, message: 'Thank you, the proposal is accepted.', next: made?.code ? `/agreement/${made.code}?from=proposal` : undefined }
}

export async function clientReviseProposal(code: string, note: string): Promise<Pub> {
  const n = tidy(note).slice(0, 2000)
  if (n.length < 3) return { ok: false, error: 'Tell us what you’d like changed.' }
  const o = await byCode(code)
  if (!o) return { ok: false, error: DEAD }
  if (o.p.status !== 'sent') return { ok: false, error: 'This proposal can’t be changed any more.' }
  const { error } = await o.db.from('proposals').update({ status: 'revision', revision_at: brisbaneToday(), revision_note: n }).eq('id', o.p.id).eq('status', 'sent')
  if (error) return { ok: false, error: 'That didn’t go through. Try again in a minute.' }
  await tellLaith(`${o.p.biz} asked for a revised quote`, [`<strong>${esc(o.p.biz)}</strong> asked for a revised quote on ${esc(o.p.ref)}:`, `“${esc(n)}”`, 'Press Revise on the proposal in Documents to change it and send it again.'],
    { title: `${o.p.biz} asked for a revised quote`, body: `${o.p.ref}: “${n.slice(0, 120)}”`, url: '/hub/commercial/documents?f=revision' })
  refresh()
  return { ok: true, message: 'Thanks. We’ll revise the proposal and email you the new one.' }
}

export async function clientDeclineProposal(code: string, reason: string, note: string): Promise<Pub> {
  if (!(DECLINE_WHY as readonly string[]).includes(reason)) return { ok: false, error: 'Choose the main reason.' }
  const o = await byCode(code)
  if (!o) return { ok: false, error: DEAD }
  if (o.p.status !== 'sent') return { ok: false, error: 'This proposal can’t be changed any more.' }
  const n = tidy(note).slice(0, 2000)
  const { error } = await o.db.from('proposals').update({ status: 'declined', declined_at: brisbaneToday(), decline_reason: reason, decline_note: n || null }).eq('id', o.p.id).eq('status', 'sent')
  if (error) return { ok: false, error: 'That didn’t go through. Try again in a minute.' }
  await tellLaith(`${o.p.biz} declined ${o.p.ref}`, [`<strong>${esc(o.p.biz)}</strong> declined proposal ${esc(o.p.ref)}.`, `Main reason: ${esc(reason)}.`, n ? `Their note: “${esc(n)}”` : ''].filter(Boolean),
    { title: `${o.p.biz} declined ${o.p.ref}`, body: reason + (n ? `: “${n.slice(0, 100)}”` : ''), url: '/hub/commercial/documents?f=declined' })
  refresh()
  return { ok: true, message: 'Thanks for letting us know. This proposal was declined.' }
}

