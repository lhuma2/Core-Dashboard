'use server'

// Commercial → Documents → Agreements and files: new service agreement from a client record, send for signature,
// resend, delete a draft, renew, send the Certificate of Currency / compliance pack the client asked for, and other
// files uploaded against a client. Words from the mock-up.

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireStaff } from '@/lib/require-staff'
import { sendEmail } from '@/lib/email'
import { brisbaneToday, currentStatus } from '@/lib/hub/figures'
import { emailSignature } from '@/lib/hub/email-signature'
import { shareLink } from '@/actions/hub-compliance'
import { QUICK_SETS } from '@/lib/hub/compliance-docs'
import { clientSnapFor } from '@/lib/hub/documents-data'
import { sendPushToRole } from '@/lib/push'
import { makeClientLogin, resendClientWelcome } from '@/lib/hub/client-login'
import {
  AS_REQ_SHORT, COMM_CLAUSES, EMAIL_OK, dLong, jobName, signCheck, type SignForm, UPLOAD_KINDS, agrOf, agrState, agreeRefNew, dShort, isoAdd, renewRef, tidy, AGR_COLS, type Agr, type AgrSnap,
} from '@/lib/hub/proposals'

type Done = { ok: true; id: string; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const GONE = 'That agreement was deleted.'
const esc = (v: string) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const uuidOk = (v: unknown) => z.string().uuid().safeParse(v).success
const ISO = /^\d{4}-\d{2}-\d{2}$/
const newCode = () => (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')

function siteUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${h.get('x-forwarded-proto') || 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.corecleaning.services').replace(/\/$/, '')
}
function refresh() { revalidatePath('/hub', 'layout') }
async function staff(): Promise<{ db: any } | { error: string }> {
  const denied = await requireStaff()
  return denied ? { error: denied } : { db: createClient() as any }
}
async function loadAgr(db: any, id: string): Promise<Agr | null | 'offline'> {
  if (!uuidOk(id)) return null
  const { data, error } = await db.from('agreements').select(AGR_COLS).eq('id', id).maybeSingle()
  if (error) return 'offline'
  return data ? agrOf(data) : null
}
/** Is there already a service agreement for this client that isn't signed yet? */
async function openFor(db: any, clientId: string, not = ''): Promise<boolean | 'offline'> {
  let q = db.from('agreements').select('id').eq('client_id', clientId).eq('atype', 'service').in('status', ['draft', 'sent'])
  if (not) q = q.neq('id', not)
  const { data, error } = await q
  if (error) return 'offline'
  return !!(data || []).length
}

function signMail(contact: string, biz: string, ref: string, spec: boolean, link: string, site: string, again: boolean): string {
  const first = esc(tidy(contact).split(' ')[0] || 'there')
  const what = spec ? 'specialist works agreement' : 'service agreement'
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#13201a;font-size:15px;line-height:1.5">
  <p>Hi ${first},</p>
  <p>${again ? 'Here is the link again for' : 'Here is'} the ${what} for ${esc(biz)} (${esc(ref)}). Please check your details, choose your start date and sign it online. It takes about five minutes.</p>
  <p><a href="${link}" style="background:#0f7a5a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">Review and sign</a></p>
  <p>If anything needs changing, just reply here or call me on 0407 026 360.</p>
  <p>Kind regards,</p>
  ${emailSignature(site)}
</div>`
}
async function emailSign(d: Agr, to: string, again: boolean): Promise<{ ok: true; tested: boolean } | { ok: false }> {
  if (!process.env.RESEND_API_KEY) return { ok: true, tested: true }
  const site = siteUrl(), spec = d.atype === 'spec'
  const contact = d.snap?.client?.contact || d.snap?.prop?.contact || ''
  const r = await sendEmail(to, `Your ${spec ? 'works' : 'service'} agreement from Core Cleaning (${d.ref})`, signMail(contact, d.client, d.ref, spec, `${site}/agreement/${d.code}`, site, again))
  return r.success ? { ok: true, tested: false } : { ok: false }
}

/** New agreement: a draft from the client's record (sites, days, price and scope are filled in when it's sent). */
export async function createCommAgreement(clientId: string, start: string, term: number): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  if (!uuidOk(clientId)) return { ok: false, error: 'Choose the client.' }
  if (!ISO.test(start || '')) return { ok: false, error: 'Add the start date.' }
  if (![6, 12, 24].includes(Number(term))) return { ok: false, error: 'Choose the initial term.' }
  const { db } = st
  const today = brisbaneToday()
  const { data: c, error } = await db.from('clients').select('id, business_name, status, paused_from, resume_on, ended_on').eq('id', clientId).maybeSingle()
  if (error) return { ok: false, error: NO_DB }
  if (!c) return { ok: false, error: 'Choose the client.' }
  if (currentStatus(c, today) === 'ended') return { ok: false, error: `${c.business_name} has ended, so there’s nothing to sign.` }
  const open = await openFor(db, clientId)
  if (open === 'offline') return { ok: false, error: NO_DB }
  if (open) return { ok: false, error: `${c.business_name} already has an agreement that isn’t signed yet. Finish or delete that one first.` }
  const year = today.slice(0, 4)
  const { data: n, error: nErr } = await db.rpc('hub_next_number', { p_key: 'comm_' + year })
  if (nErr || !n) return { ok: false, error: NO_DB }
  const { data, error: iErr } = await db.from('agreements').insert({
    atype: 'service', ref: agreeRefNew(year, n), code: newCode(), status: 'draft', client_id: clientId, client_name: c.business_name,
    start_on: start, term_months: Number(term), created_on: today,
  }).select('id').single()
  if (iErr || !data) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, id: data.id, toast: `Draft agreement created for ${c.business_name}. Open it to check, then send it.` }
}

/** Send for signature. A client's details are copied onto the agreement now, so what they sign can't shift later. */
export async function sendCommAgreement(id: string, to: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  const d = await loadAgr(st.db, id)
  if (d === 'offline') return { ok: false, error: NO_DB }
  if (!d) return { ok: false, error: GONE }
  if (d.status !== 'draft') return { ok: false, error: `${d.ref} has already been sent.` }
  const email = String(to || '').trim()
  if (!EMAIL_OK(email) || email.length > 320) return { ok: false, error: 'Enter a valid email address.' }
  let snap: AgrSnap = { ...(d.snap || {}), clauses: d.snap?.clauses?.length ? d.snap.clauses : COMM_CLAUSES }
  if (d.clientId) {
    const cs = await clientSnapFor(d.clientId, st.db)
    if (!cs) return { ok: false, error: NO_DB }
    if (!(cs.monthlyEx > 0)) return { ok: false, error: `${d.client} has no cleaning price yet. Add their service and price on their client page first.` }
    snap = { ...snap, client: cs }
  } else if (!snap.prop) return { ok: false, error: 'This agreement has no client details. Delete it and make a new one.' }
  const r = await emailSign({ ...d, snap }, email, false)
  if (!r.ok) return { ok: false, error: 'The email didn’t send, so the agreement is still a draft. Check the address and try again.' }
  const { error } = await st.db.from('agreements').update({ status: 'sent', sent_to: email, sent_at: brisbaneToday(), snap }).eq('id', id).eq('status', 'draft')
  if (error) return { ok: false, error: NO_DB }
  refresh()
  return {
    ok: true, id, toast: r.tested
      ? `${d.ref} marked as sent to ${email}. This is the test site, so no email went out. Use Copy signing link to open the client’s page.`
      : `Signing link emailed to ${email} from admin@corecleaning.services.`,
  }
}

/** Resend: a new link (the old one stops working). */
export async function resendCommAgreement(id: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  const d = await loadAgr(st.db, id)
  if (d === 'offline') return { ok: false, error: NO_DB }
  if (!d) return { ok: false, error: GONE }
  if (d.status !== 'sent' || !d.sentTo) return { ok: false, error: `${d.ref} isn’t waiting on a signature.` }
  const code = newCode()
  const r = await emailSign({ ...d, code }, d.sentTo, true)
  if (!r.ok) return { ok: false, error: 'The email didn’t send. Try again in a minute.' }
  const { error } = await st.db.from('agreements').update({ code, sent_at: brisbaneToday() }).eq('id', id).eq('status', 'sent')
  if (error) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, id, toast: r.tested ? `${d.ref} has a new signing link. This is the test site, so no email went out.` : `Signing link sent again to ${d.sentTo}.` }
}

export async function deleteCommAgreement(id: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  const d = await loadAgr(st.db, id)
  if (d === 'offline') return { ok: false, error: NO_DB }
  if (!d) return { ok: true, id, toast: 'That draft was already deleted.' }
  if (d.status !== 'draft') return { ok: false, error: d.status === 'signed' ? `${d.ref} is signed, so it stays on record.` : `${d.ref} is with the client to sign.` }
  const { error } = await st.db.from('agreements').delete().eq('id', id).eq('status', 'draft')
  if (error) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, id, toast: 'Draft deleted.' }
}

/** Renew: a new draft (same terms, ref with -R1, -R2…) starting the day after the term ends, or today if already rolling. */
export async function renewCommAgreement(id: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  const d = await loadAgr(st.db, id)
  if (d === 'offline') return { ok: false, error: NO_DB }
  if (!d) return { ok: false, error: GONE }
  const today = brisbaneToday()
  const ds = agrState(d, today)
  if (d.atype !== 'service' || (ds.key !== 'expiring' && ds.key !== 'rolling')) return { ok: false, error: `${d.ref} isn’t due for renewal yet.` }
  if (d.clientId) {
    const open = await openFor(st.db, d.clientId)
    if (open === 'offline') return { ok: false, error: NO_DB }
    if (open) return { ok: false, error: `${d.client} already has a new agreement in progress.` }
  }
  const start = ds.left < 0 ? today : isoAdd(ds.end, 1)
  const { data, error } = await st.db.from('agreements').insert({
    atype: 'service', ref: renewRef(d.ref), code: newCode(), status: 'draft', client_id: d.clientId, client_name: d.client, renew_of: d.id,
    proposal_id: null, start_on: start, term_months: d.termMonths || 12, created_on: today,
    snap: d.clientId ? null : d.snap ? { prop: d.snap.prop, clauses: COMM_CLAUSES } : null,
  }).select('id').single()
  if (error || !data) return { ok: false, error: /duplicate|unique/i.test(String(error?.message)) ? `${d.client} already has a renewal. Find it under Drafts.` : NO_DB }
  refresh()
  return { ok: true, id: data.id, toast: `Renewal drafted for ${d.client}, starting ${dShort(start)}. Check it, then send.` }
}

/** The client ticked "Certificate of Currency" / "compliance pack" when signing: email them as a share link. */
export async function sendRequestedDocs(id: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  const d = await loadAgr(st.db, id)
  if (d === 'offline') return { ok: false, error: NO_DB }
  if (!d) return { ok: false, error: GONE }
  const reqs = (d.details?.reqs || []).filter(q => q === 'coc' || q === 'pack')
  if (d.status !== 'signed' || !reqs.length) return { ok: false, error: 'They didn’t ask for any documents.' }
  if (d.reqSentAt) return { ok: false, error: `Already sent on ${dShort(d.reqSentAt)}.` }
  const to = d.details?.email || d.sentTo
  if (!EMAIL_OK(to || '')) return { ok: false, error: 'There’s no email address on the agreement.' }
  const ids = reqs.includes('pack') ? QUICK_SETS[0].ids : ['COC']
  const link = await shareLink(ids)
  if (!link.ok) return { ok: false, error: link.error }
  const what = reqs.length === 2 ? 'Certificate of Currency and compliance pack' : reqs[0] === 'coc' ? 'Certificate of Currency' : 'compliance pack'
  const tested = !process.env.RESEND_API_KEY
  if (!tested) {
    const site = siteUrl()
    const first = esc(tidy(d.details?.name || d.signedBy).split(' ')[0] || 'there')
    const r = await sendEmail(to, `Our ${what} (Core Cleaning)`, `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#13201a;font-size:15px;line-height:1.5">
  <p>Hi ${first},</p><p>As requested when you signed ${esc(d.ref)}, here is our ${esc(what)}. You can view and download everything here:</p>
  <p><a href="${link.url}" style="background:#0f7a5a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">View the documents</a></p>
  <p>Kind regards,</p>${emailSignature(site)}</div>`)
    if (!r.success) return { ok: false, error: 'The email didn’t send. Try again in a minute.' }
  }
  const { error } = await st.db.from('agreements').update({ req_sent_at: brisbaneToday() }).eq('id', id)
  if (error) return { ok: false, error: NO_DB }
  refresh()
  const cap = what.charAt(0).toUpperCase() + what.slice(1)
  return { ok: true, id, toast: tested ? `${cap} marked as sent. This is the test site, so no email went out. The share link is ${link.url}` : `${cap} emailed to ${to} from admin@corecleaning.services as a share link.` }
}

// ── other files, filed under a client ──
const FILE_KINDS: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heic', 'image/gif': 'gif' }
const FILE_PATH = /^clients\/[0-9a-f-]{36}\/[0-9a-f]{16}\.(pdf|jpg|png|webp|heic|gif)$/

export async function fileUploadUrl(clientId: string, type: string, size: number): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  if (!uuidOk(clientId)) return { ok: false, error: 'Choose the client.' }
  const ext = FILE_KINDS[String(type || '').toLowerCase()]
  if (!ext) return { ok: false, error: 'Upload a PDF or a photo.' }
  if (!(size > 0) || size > 20 * 1024 * 1024) return { ok: false, error: 'That file is over 20 MB.' }
  const path = `clients/${clientId}/${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}.${ext}`
  const s = await createAdminClient().storage.from('client-files').createSignedUploadUrl(path, { upsert: true })
  if (s.error || !s.data?.signedUrl) return { ok: false, error: NO_DB }
  return { ok: true, url: s.data.signedUrl, path }
}

export async function saveClientFile(clientId: string, kind: string, fileName: string, path: string, type: string, size: number): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  if (!uuidOk(clientId)) return { ok: false, error: 'Choose the client.' }
  if (!(UPLOAD_KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'Choose what kind of document it is.' }
  if (!FILE_PATH.test(path || '') || !path.startsWith(`clients/${clientId}/`)) return { ok: false, error: 'Choose the file to upload.' }
  const name = tidy(fileName).slice(0, 200) || 'document'
  const { data: c, error: cErr } = await st.db.from('clients').select('id, business_name').eq('id', clientId).maybeSingle()
  if (cErr) return { ok: false, error: NO_DB }
  if (!c) return { ok: false, error: 'Choose the client.' }
  const { data, error } = await st.db.from('client_files').insert({
    client_id: clientId, kind, file_name: name, path, mime: FILE_KINDS[String(type).toLowerCase()] ? String(type).toLowerCase() : 'application/pdf', size: Math.max(1, Math.round(size) || 1), created_on: brisbaneToday(),
  }).select('id').single()
  if (error || !data) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, id: data.id, toast: `Saved ${name} to ${c.business_name}.` }
}

export async function removeClientFile(id: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  if (!uuidOk(id)) return { ok: true, id, toast: 'File removed.' }
  const { error } = await st.db.from('client_files').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null)
  if (error) return { ok: false, error: NO_DB }
  refresh()
  return { ok: true, id, toast: 'File removed.' }
}

// ── the client's signing page (no login: matched by the private code in the link) ──
const DEAD = 'This agreement link isn’t valid any more. Contact Core Cleaning on 0407 026 360 for a new one.'

export async function clientSignAgreement(code: string, f: SignForm): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (!/^[0-9a-f]{64}$/.test(code || '')) return { ok: false, error: DEAD }
  const db = createAdminClient() as any
  const { data, error } = await db.from('agreements').select(AGR_COLS).eq('code', code).maybeSingle()
  if (error) return { ok: false, error: 'That didn’t go through. Check your connection and try again.' }
  if (!data) return { ok: false, error: DEAD }
  const d = agrOf(data)
  if (d.status === 'signed') return { ok: false, error: 'This agreement is already signed. Refresh the page to see the signed copy.' }
  if (d.status !== 'sent') return { ok: false, error: 'This agreement can’t be signed any more. Contact Core Cleaning for a new link.' }
  const today = brisbaneToday(), spec = d.atype === 'spec'
  const chk = signCheck(f || ({} as SignForm), today, spec)
  if ('error' in chk) return { ok: false, error: chk.error }
  const det = chk.details
  const h = headers()
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || ''
  const { error: sErr } = await db.rpc('hub_sign_agreement', { p_code: code, p_name: det.name, p_details: det, p_ip: ip })
  if (sErr) {
    const m = String(sErr.message || '')
    if (m.includes('not_open') || m.includes('not_found')) return { ok: false, error: 'This agreement can’t be signed any more. Contact Core Cleaning for a new link.' }
    if (m.includes('bad_start')) return { ok: false, error: 'That date is in the past. Choose a date from today.' }
    return { ok: false, error: 'That didn’t go through. Nothing was saved, so you can try again.' }
  }
  const site = siteUrl()
  const asked = det.reqs.length ? ` They asked for: ${det.reqs.map(k => AS_REQ_SHORT[k]).join(', ')}.` : ''
  // the client's portal login, once there's a client record to link it to (otherwise it's made at Set up as client)
  let login = ''
  if (!spec && d.clientId) {
    const lg = await makeClientLogin(d.clientId, det.name, det.email, site, +today.slice(0, 4))
    if (lg.ok && lg.made) {
      await db.from('agreements').update({ portal: { email: lg.email, first: lg.first, sentAt: today } }).eq('id', d.id)
      login = ` ${lg.first} gets a welcome email with their client portal login at ${lg.email}.`
    }
  }
  const view = `${site}/agreement/${code}`
  const what = spec ? 'works agreement' : 'service agreement'
  const works = spec ? (d.snap?.prop?.jobs || []).map(jobName).filter(Boolean).join(', ') || 'The works' : ''
  if (process.env.RESEND_API_KEY) {
    const first = esc(det.name.split(' ')[0])
    await sendEmail(det.email, `Your signed ${what} (${d.ref})`, `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#13201a;font-size:15px;line-height:1.5">
  <p>Hi ${first},</p><p>Thank you for signing the ${what} for ${esc(d.client)} (${esc(d.ref)}). ${spec ? `The works are booked for ${esc(dLong(det.start))}.` : `Your first clean is planned for ${esc(dLong(det.start))}. We’ll confirm the details with you before then.`}</p>
  <p>You can view or download your signed copy any time here:</p>
  <p><a href="${view}" style="background:#0f7a5a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">View your signed agreement</a></p>
  <p>Kind regards,</p>${emailSignature(site)}</div>`).catch(() => {})
    await sendEmail('admin@corecleaning.services', `${d.client} signed ${d.ref}`, `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5">
  <p><strong>${esc(det.name)}</strong> (${esc(det.position)}) signed the ${esc(d.client)} ${what} ${esc(d.ref)}.</p>
  <p>${spec ? `${esc(works)} booked for ${esc(dLong(det.start))}. Assign a cleaner in the timetable.` : `Preferred first clean ${esc(dLong(det.start))}.`}${esc(asked)}</p>
  ${!spec && !d.clientId ? '<p>Next: press Set up as client on the proposal in Documents.</p>' : ''}
  <p><a href="${view}">Signed copy</a></p></div>`).catch(() => {})
  }
  await sendPushToRole('admin', {
    title: `${d.client} signed ${d.ref}`,
    body: spec ? `${works} booked for ${dLong(det.start)}. Assign a cleaner.` : `Starting ${dLong(det.start)}.` + (d.clientId ? '' : ' Set them up as a client.') + asked,
    url: '/hub/commercial/documents?sec=agreements',
  }).catch(() => {})
  refresh()
  return {
    ok: true, message: spec
      ? `Thank you, ${det.name.split(' ')[0]}. The agreement is signed and the works are booked for ${dLong(det.start)}. A copy is on its way to ${det.email}.`
      : `Thank you, ${det.name.split(' ')[0]}. Your agreement is signed. A copy is on its way to ${det.email}${login ? ', with your client portal login' : ''}. We’ll be in touch before your first clean.`,
  }
}

/** The client portal welcome email again (only while they haven't chosen their own password). */
export async function resendPortalWelcome(id: string): Promise<Done> {
  const st = await staff(); if ('error' in st) return { ok: false, error: st.error }
  const d = await loadAgr(st.db, id)
  if (d === 'offline') return { ok: false, error: NO_DB }
  if (!d || !d.clientId) return { ok: false, error: 'This agreement isn’t linked to a client yet.' }
  const today = brisbaneToday()
  const r = await resendClientWelcome(d.clientId, siteUrl(), +today.slice(0, 4))
  if (!r.ok) return { ok: false, error: r.error === 'chosen' ? 'They’ve already chosen their own password. If they’ve forgotten it, they can use Forgot password on the login page.' : r.error === 'none' ? 'They don’t have a client portal login yet.' : NO_DB }
  await st.db.from('agreements').update({ portal: { ...(d.portal || { email: r.email, first: '', sentAt: today }), resentAt: today } }).eq('id', id)
  refresh()
  return { ok: true, id, toast: r.tested ? `Welcome email ready for ${r.email}. This is the test site, so no email went out. Starter password: ${r.pw}` : `Welcome email sent again to ${r.email}.` }
}
