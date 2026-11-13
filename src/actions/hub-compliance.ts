'use server'

// Compliance pack: save a quick set, make a share link, and email documents with the PDFs attached. Words from the
// mock-up.

import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/require-staff'
import { sendEmail } from '@/lib/email'
import { COMPLIANCE_DOCS, docById, docFileName } from '@/lib/hub/compliance-docs'
import { compliancePdf } from '@/lib/hub/compliance-pdf'
import { emailSignature } from '@/lib/hub/email-signature'

type R = { ok: true; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const NEED_070 = 'The hub needs test-db update 070 for this. Ask Claude for the file.'
const fail = (error: string): R => ({ ok: false, error })
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const CODE = '23456789abcdefghjkmnpqrstuvwxyz'
/** Known document ids only, in the pack's own order, no repeats. */
const clean = (ids: unknown): string[] => { const set = new Set(Array.isArray(ids) ? ids.map(String) : []); return COMPLIANCE_DOCS.filter(d => set.has(d.id)).map(d => d.id) }
const plural = (n: number) => (n === 1 ? '1 document' : `${n} documents`)

function siteUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${h.get('x-forwarded-proto') || 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.corecleaning.services').replace(/\/$/, '')
}

export async function saveSet(name: string, ids: string[]): Promise<R> {
  const denied = await requireStaff(); if (denied) return fail(denied)
  const n = String(name || '').trim().replace(/\s+/g, ' ')
  if (!n) return fail('Give the set a name first.')
  if (n.length > 60) return fail('Keep the name under 60 characters.')
  const list = clean(ids)
  if (!list.length) return fail('Tick the documents to share')
  const db = createClient() as any
  const { error } = await db.from('compliance_sets').insert({ name: n, doc_ids: list })
  if (error) return fail(/compliance_sets/.test(String(error.message)) ? NEED_070 : NO_DB)
  revalidatePath('/hub/compliance')
  return { ok: true, toast: `Saved "${n}" to your quick sets.` }
}

export async function removeSet(id: string): Promise<R> {
  const denied = await requireStaff(); if (denied) return fail(denied)
  const db = createClient() as any
  const { data, error } = await db.from('compliance_sets').delete().eq('id', id).select('name')
  if (error) return fail(NO_DB)
  revalidatePath('/hub/compliance')
  return { ok: true, toast: (data || []).length ? `Removed "${data[0].name}" from your quick sets.` : 'That set was already removed.' }
}

/** The share link for these documents. The same documents always get the same link. */
export async function shareLink(ids: string[]): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const denied = await requireStaff(); if (denied) return { ok: false, error: denied }
  const list = clean(ids)
  if (!list.length) return { ok: false, error: 'Tick the documents to share' }
  const db = createClient() as any
  const { data: have, error } = await db.from('compliance_links').select('code, doc_ids').limit(500)
  if (error) return { ok: false, error: /compliance_links/.test(String(error.message)) ? NEED_070 : NO_DB }
  let code = ((have || []) as any[]).find(l => (l.doc_ids || []).join('|') === list.join('|'))?.code as string | undefined
  if (!code) {
    const b = randomBytes(10)
    code = Array.from(b, x => CODE[x % CODE.length]).join('')
    const ins = await db.from('compliance_links').insert({ code, doc_ids: list })
    if (ins.error) return { ok: false, error: NO_DB }
  }
  return { ok: true, url: `${siteUrl()}/d/${code}` }
}

export async function emailDocs(ids: string[], to: string): Promise<R> {
  const denied = await requireStaff(); if (denied) return fail(denied)
  const addr = String(to || '').trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) return fail('Enter a valid email address.')
  const list = clean(ids)
  if (!list.length) return fail('Tick the documents to share')
  const link = await shareLink(list)
  if (!link.ok) return fail(link.error)
  if (!process.env.RESEND_API_KEY) return { ok: true, toast: `This is the test site, so no email went out. Use Copy link to send ${plural(list.length)} by hand.` }
  const docs = list.map(id => docById(id)!)
  // each document as its own PDF, as in the mock-up
  const attachments: { filename: string; content: Buffer }[] = []
  for (const d of docs) attachments.push({ filename: docFileName(d), content: await compliancePdf([d]) })
  const site = siteUrl()
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;color:#13201a;font-size:15px;line-height:1.5">
  <p>Hi,</p>
  <p>Here ${docs.length === 1 ? 'is the document' : 'are the documents'} you asked for from Core Cleaning, attached as PDF${docs.length === 1 ? '' : 's'}:</p>
  <ul>${docs.map(d => `<li>${esc(d.code)} ${esc(d.title)}</li>`).join('')}</ul>
  <p>You can also read them online: <a href="${link.url}">${esc(link.url.replace(/^https?:\/\//, ''))}</a></p>
  <p>Kind regards,</p>
  ${emailSignature(site)}
</div>`
  const r = await sendEmail(addr, docs.length === 1 ? `${docs[0].title} from Core Cleaning` : 'Compliance documents from Core Cleaning', html, attachments)
  if (!r.success) return fail('The email didn’t send. Check your connection and try again.')
  return { ok: true, toast: `Emailed ${plural(list.length)} to ${addr}.` }
}
