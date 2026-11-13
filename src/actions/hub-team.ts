'use server'

// Team: add a cleaner (emails the compliance pack), resend it, and set a cleaner's region. Same checks and words as
// the mock-up.

import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/require-staff'
import { sendEmail } from '@/lib/email'
import { REGION_NAME, isRegion, fixedName } from '@/lib/hub/team'

type R = { ok: true; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const fail = (error: string): R => ({ ok: false, error })
const uuid = (v: unknown) => z.string().uuid().safeParse(v).success
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

function siteUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${h.get('x-forwarded-proto') || 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.corecleaning.services').replace(/\/$/, '')
}
function refresh() { revalidatePath('/hub', 'layout') }

function packEmail(first: string, link: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#13201a">
  <div style="background:#00250e;color:#fff;padding:18px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">Core Cleaning</div>
  <div style="border:1px solid #d5dfda;border-top:0;border-radius:0 0 10px 10px;padding:22px 20px">
    <p style="margin:0 0 12px;font-size:16px">Hi ${esc(first)},</p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.5">Welcome to Core Cleaning. Before your first job, please read your subcontractor pack, add your business and insurance details, and sign once. One signature covers every document. It takes about 10 minutes.</p>
    <p style="margin:8px 0 20px"><a href="${link}" style="background:#0f7a5a;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;display:inline-block">Open your pack</a></p>
    <p style="margin:0 0 6px;font-size:13px;color:#5d6b65">Have your ABN, your public liability policy and its certificate of currency ready.</p>
    <p style="margin:0;font-size:13px;color:#5d6b65">When you’ve signed, we’ll email your login for the cleaner app. Questions? Call Laith on 0407 026 360.</p>
  </div></div>`
}

/** Emails the pack. On the test site (no email key) nothing goes out; the toast says so. */
async function deliver(to: string, first: string, token: string): Promise<{ ok: boolean; tested: boolean }> {
  if (!process.env.RESEND_API_KEY) return { ok: true, tested: true }
  const r = await sendEmail(to, 'Your Core Cleaning subcontractor pack', packEmail(first, `${siteUrl()}/pack/${token}`))
  return { ok: r.success, tested: false }
}

export interface AddForm { first: string; last: string; email: string; phone: string; region: string; leader: boolean }

export async function addCleaner(f: AddForm): Promise<R & { id?: string }> {
  const denied = await requireStaff(); if (denied) return fail(denied)
  const first = fixedName(f.first), last = fixedName(f.last)
  const email = String(f.email || '').trim().toLowerCase()
  const phone = String(f.phone || '').trim()
  if (!first) return fail('Enter the cleaner’s first name. It’s used for their login.')
  if (/\s/.test(first)) return fail('Put just one first name in the first name box. Middle names go in the last name box.')
  if (!last) return fail('Enter the cleaner’s last name.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address. The compliance pack is sent there.')
  if (phone && phone.replace(/[^0-9]/g, '').length !== 10) return fail('Mobile numbers have 10 digits, e.g. 0412 345 678.')
  if (!isRegion(f.region)) return fail('Choose a region.')
  if (first.length > 60 || last.length > 80 || email.length > 200) return fail('That name or email is too long.')
  const db = createClient() as any
  const like = email.replace(/[\\%_]/g, c => '\\' + c)
  const [pQ, kQ] = await Promise.all([
    db.from('profiles').select('id').ilike('email', like).limit(1),
    db.from('cleaner_packs').select('id').ilike('email', like).limit(1),
  ])
  if (pQ.error) return fail(NO_DB)
  if (kQ.error) return fail('The hub needs test-db update 069 before cleaners can be added. Ask Claude for the file.')
  if ((pQ.data || []).length || (kQ.data || []).length) return fail('A cleaner with that email is already on your team.')
  const token = randomBytes(32).toString('hex')
  const name = `${first} ${last}`
  const { data: row, error } = await db.from('cleaner_packs').insert({ token, first_name: first, last_name: last, email, phone: phone || null, region: f.region, is_team_leader: !!f.leader }).select('id').single()
  if (error || !row) return fail(/duplicate|unique/i.test(String(error?.message)) ? 'A cleaner with that email is already on your team.' : NO_DB)
  const sent = await deliver(email, first, token)
  refresh()
  if (sent.tested) return { ok: true, id: row.id, toast: `Added ${name}. This is the test site, so no email went out. Use See what they get to open their page.` }
  if (!sent.ok) return { ok: true, id: row.id, toast: `Added ${name}, but the email didn’t send. Use Resend pack to try again.` }
  return { ok: true, id: row.id, toast: `Added ${name}. Compliance pack emailed to ${email}.` }
}

export async function resendPack(packId: string): Promise<R> {
  const denied = await requireStaff(); if (denied) return fail(denied)
  if (!uuid(packId)) return fail('That cleaner was removed. Refresh the page.')
  const db = createClient() as any
  const { data: k, error } = await db.from('cleaner_packs').select('id, token, first_name, email, signed_at').eq('id', packId).maybeSingle()
  if (error) return fail(NO_DB)
  if (!k) return fail('That cleaner was removed. Refresh the page.')
  if (k.signed_at) return { ok: true, toast: `${k.first_name} has already signed the pack.` }
  const sent = await deliver(k.email, k.first_name, k.token)
  if (sent.tested) return { ok: true, toast: 'This is the test site, so no email went out. Use See what they get to open their page.' }
  if (!sent.ok) return fail('The email didn’t send. Check your connection and try again.')
  await db.from('cleaner_packs').update({ sent_at: new Date().toISOString() }).eq('id', packId)
  return { ok: true, toast: `Compliance pack sent again to ${k.email}.` }
}

/** kind 'p' = a cleaner login, 'k' = a pack not signed yet. An empty region puts them back under To sort. */
export async function setRegion(kind: 'p' | 'k', id: string, region: string): Promise<R> {
  const denied = await requireStaff(); if (denied) return fail(denied)
  if (!uuid(id) || (kind !== 'p' && kind !== 'k')) return fail('That cleaner was removed. Refresh the page.')
  if (region && !isRegion(region)) return fail('Choose a region.')
  const db = createClient() as any
  const q = kind === 'p'
    ? db.from('profiles').update({ region: region || null }).eq('id', id).eq('role', 'cleaner').select('full_name')
    : db.from('cleaner_packs').update({ region: region || null }).eq('id', id).select('first_name')
  const { data, error } = await q
  if (error) return fail(NO_DB)
  if (!(data || []).length) return fail('That cleaner was removed. Refresh the page.')
  const who = String(data[0].full_name || data[0].first_name || 'They').trim().split(/\s+/)[0]
  refresh()
  return { ok: true, toast: region ? `${who} is now in ${REGION_NAME[region]}.` : `${who} is back under To sort.` }
}
