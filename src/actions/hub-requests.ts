'use server'

// Commercial → Requests: reply, mark done, reopen and book an extra clean. Same checks and words as the mock-up.

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/require-staff'
import { brisbaneToday } from '@/lib/hub/figures'
import { offOn, onCadence, isoDow, CAL_DOW, t12 } from '@/lib/hub/timetable'
import { tidy } from '@/lib/hub/client-page'
import { rqDay, rqTitle, names } from '@/lib/hub/requests'
import { sendEmail } from '@/lib/email'

type R = { ok: true; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const GONE = 'That request was removed. Refresh the page.'
const ISO = /^\d{4}-\d{2}-\d{2}$/
const HM = /^\d{2}:\d{2}$/
const uuid = (v: unknown) => z.string().uuid().safeParse(v).success
const fail = (error: string): R => ({ ok: false, error })
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const d10 = (v: any) => (v ? String(v).slice(0, 10) : null)
const t5 = (v: any) => (v ? String(v).slice(0, 5) : '')
const PORTAL = 'https://portal.corecleaning.services/client/app?tab=requests'

function refresh() { revalidatePath('/hub', 'layout'); revalidatePath('/client/app', 'layout') }

/** The request with its client, and the email address to answer: whoever sent it, otherwise the client's contact. */
async function load(id: string) {
  const denied = await requireStaff()
  if (denied) return { error: denied }
  if (!uuid(id)) return { error: GONE }
  const db = createClient() as any
  const { data: r, error } = await db.from('client_requests').select('id, client_id, sent_by, kind, site_id, service, want_date, status, reply, created_at').eq('id', id).maybeSingle()
  if (error) return { error: NO_DB }
  if (!r) return { error: GONE }
  const [cQ, pQ] = await Promise.all([
    db.from('clients').select('id, business_name, contact_name, contact_email, status, paused_from, resume_on, ended_on').eq('id', r.client_id).maybeSingle(),
    r.sent_by ? db.from('profiles').select('full_name, email').eq('id', r.sent_by).maybeSingle() : { data: null },
  ])
  if (cQ.error) return { error: NO_DB }
  if (!cQ.data) return { error: 'That client isn’t in your client list any more.' }
  const c = cQ.data as any
  const to = String(pQ.data?.email || c.contact_email || '').trim()
  const who = String(pQ.data?.full_name || c.contact_name || '').trim().split(/\s+/).filter((w: string) => !/^(dr|mr|mrs|ms|miss|prof)\.?$/i.test(w))[0] || 'there'
  return { db, r: r as any, c, to, who }
}

function mail(to: string, subject: string, body: string) {
  if (!to) return Promise.resolve()
  return sendEmail(to, subject, body + `<p><a href="${PORTAL}">See it in your portal</a></p><p>Laith<br>Core Cleaning</p>`).catch(() => {})
}

// ── Reply ──
export async function replyRequest(id: string, text: string): Promise<R> {
  const t = tidy(text)
  if (t.length < 2) return fail('Write your reply first.')
  if (t.length > 2000) return fail('That’s a bit long. Keep it under 2,000 characters.')
  const o = await load(id); if ('error' in o) return fail(o.error!)
  const { error } = await o.db.from('client_requests').update({ reply: t, replied_at: new Date().toISOString(), status: o.r.status === 'new' ? 'replied' : o.r.status }).eq('id', id)
  if (error) return fail(NO_DB)
  await mail(o.to, `Re: ${rqTitle({ kind: o.r.kind, service: o.r.service || '' })}`,
    `<p>Hi ${esc(o.who)},</p><p style="white-space:pre-line">${esc(t)}</p>`)
  refresh()
  return { ok: true, toast: `Reply emailed to ${o.to || 'the client'} and shown on their Requests tab.` }
}

// ── Done / reopen ──
export async function markRequestDone(id: string): Promise<R> {
  const o = await load(id); if ('error' in o) return fail(o.error!)
  const { error } = await o.db.from('client_requests').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id)
  if (error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: `Marked done. ${o.c.business_name} sees it as Done in their portal.` }
}
export async function reopenRequest(id: string): Promise<R> {
  const o = await load(id); if ('error' in o) return fail(o.error!)
  const { data: one } = await o.db.from('one_offs').select('id').eq('request_id', id).limit(1)
  const { error } = await o.db.from('client_requests').update({ status: o.r.reply || (one || []).length ? 'replied' : 'new', done_at: null }).eq('id', id)
  if (error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: 'Reopened.' }
}

// ── Book an extra clean ──
const addMin = (hm: string, n: number) => { const m = ((+hm.slice(0, 2) * 60 + +hm.slice(3, 5) + n) % 1440 + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') }
const mins = (hm: string) => +hm.slice(0, 2) * 60 + +hm.slice(3, 5)

export async function bookExtraClean(id: string, date: string, start: string): Promise<R> {
  const o = await load(id); if ('error' in o) return fail(o.error!)
  if (o.r.kind !== 'extra') return fail('Only extra clean requests can be booked from here.')
  const { data: had, error: hErr } = await o.db.from('one_offs').select('id').eq('request_id', id).limit(1)
  if (hErr) return fail(NO_DB)
  if ((had || []).length) return fail('That extra clean is already booked. Refresh the page.')
  const bd = String(date || ''), bt = String(start || '').slice(0, 5)
  const today = brisbaneToday()
  if (!ISO.test(bd)) return fail('Choose the day for the extra clean.')
  if (bd < today) return fail('That day has already passed. Choose another day.')
  if (!HM.test(bt)) return fail('Choose the start time.')
  const c = o.c
  if (offOn({ status: c.status, paused_from: d10(c.paused_from), resume_on: d10(c.resume_on), ended_on: d10(c.ended_on) }, bd)) return fail(`${c.business_name} is paused or ended on that day. Choose another day.`)
  const { data: svcs, error: sErr } = await o.db.from('client_services').select('id, site_id, sort_order, days, every, anchor, first_clean, start_time, finish_time, price, cost').eq('client_id', c.id).order('sort_order')
  if (sErr) return fail(NO_DB)
  const sv = ((o.r.site_id && (svcs || []).find((s: any) => s.site_id === o.r.site_id)) || (svcs || [])[0]) as any
  if (!sv) return fail(`${c.business_name} has no service set up yet. Add one on their client page first.`)
  const regular = (sv.days || []).includes(CAL_DOW[isoDow(bd)]) && !(sv.first_clean && bd < d10(sv.first_clean)!) && onCadence({ every: sv.every, anchor: d10(sv.anchor), first: d10(sv.first_clean) }, bd)
  if (regular) return fail(`They already have their regular clean on ${rqDay(bd)}. Choose another day.`)
  const s0 = t5(sv.start_time), f0 = t5(sv.finish_time)
  const finish = s0 && f0 ? addMin(bt, ((mins(f0) - mins(s0)) % 1440 + 1440) % 1440) : null
  const { error } = await o.db.from('one_offs').insert({ client_id: c.id, service_id: sv.id, request_id: id, clean_date: bd, start_time: bt, finish_time: finish, price: Number(sv.price) || 0, cost: Number(sv.cost) || 0, note: 'Extra clean, booked from their request' })
  if (error) return fail(/duplicate|unique/i.test(String(error.message)) ? `There’s already an extra clean on ${rqDay(bd)} for that site. Choose another day.` : NO_DB)
  await o.db.from('client_requests').update({ status: 'replied' }).eq('id', id).eq('status', 'new')
  const asked = d10(o.r.want_date)
  const moved = !!asked && bd !== asked
  const { data: crew } = await o.db.from('client_service_cleaners').select('cleaner:profiles(full_name)').eq('service_id', sv.id)
  const who = names(((crew || []) as any[]).map(x => String(x.cleaner?.full_name || '').split(/\s+/)[0]).filter(Boolean))
  await mail(o.to, `Extra clean booked for ${rqDay(bd)}`,
    `<p>Hi ${esc(o.who)},</p>` +
    (moved ? `<p>${esc(rqDay(asked!))} wasn’t available, so we’ve booked you in for ${esc(rqDay(bd))}.</p>` : '') +
    `<p>Your extra clean is booked for <strong>${esc(rqDay(bd))} at ${esc(t12(bt))}</strong>${who ? ` with ${esc(who)}` : ''}. It’s on your Cleans tab too.</p>`)
  refresh()
  return { ok: true, toast: `Extra clean booked for ${rqDay(bd)} at ${t12(bt)}${moved ? ` instead of ${rqDay(asked!)}` : ''}. It’s on the calendar and the cleaners’ jobs, and ${c.business_name} gets an email${moved ? ' with the new day' : ''}.` }
}
