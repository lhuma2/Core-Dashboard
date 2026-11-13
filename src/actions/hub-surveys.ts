'use server'

// Commercial → Surveys: send (one or all due), remind, snooze 2 weeks, turn off/on, mark followed up. Nothing is sent
// on its own: Laith presses Send. Checks and words from the mock-up (v76, v78).

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/require-staff'
import { sendEmail } from '@/lib/email'
import { addMonths, brisbaneToday } from '@/lib/hub/figures'
import { dLong, dShort, isoAdd } from '@/lib/hub/home-quotes'
import { tidy } from '@/lib/hub/client-page'
import { loadSurveys } from '@/lib/hub/surveys-data'
import { type SvClient, svBase, svDue, svFirstName, svFlag, svNext, svPoss, svStatus, svWaitOf } from '@/lib/hub/surveys'

type R = { ok: true; toast: string } | { ok: false; error: string }
const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const GONE = 'That survey was removed. Refresh the page.'
const uuid = (v: unknown) => z.string().uuid().safeParse(v).success
const fail = (error: string): R => ({ ok: false, error })
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const live = () => !!process.env.RESEND_API_KEY

function siteUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${h.get('x-forwarded-proto') || 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.corecleaning.services').replace(/\/$/, '')
}
function refresh() { revalidatePath('/hub', 'layout') }

/** The survey email: a short hello and one button to the private link. */
function surveyEmail(c: SvClient, link: string, reminder: boolean): { subject: string; html: string } {
  const subject = reminder ? 'A reminder: your 2 minute Core Cleaning survey' : 'How are we going? A 2 minute survey from Core Cleaning'
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;color:#13201a">
  <div style="background:#00250e;color:#fff;padding:18px 20px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">Core Cleaning</div>
  <div style="border:1px solid #d5dfda;border-top:0;border-radius:0 0 10px 10px;padding:22px 20px;font-size:15px;line-height:1.5">
    <p style="margin:0 0 12px">Hi ${esc(svFirstName(c.contact))},</p>
    <p style="margin:0 0 12px">${reminder ? 'Just a quick reminder about our survey. ' : ''}We’d love to know how we’re going at ${esc(c.name)}. It takes about 2 minutes: five quick ratings from 1 to 10, and a box for anything else you’d like us to know.</p>
    <p style="margin:18px 0"><a href="${link}" style="display:inline-block;background:#0f6e50;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Start the survey</a></p>
    <p style="margin:0 0 12px;font-size:13px;color:#5d6b65">Or open this link: ${esc(link)}</p>
    <p style="margin:0">Thank you,<br><strong>Laith Humadi</strong><br>Core Cleaning · 0407 026 360 · admin@corecleaning.services</p>
  </div></div>`
  return { subject, html }
}

/** Make the survey row and email the link. Shared by Send survey and Send all. */
async function sendOne(db: any, c: SvClient, today: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await db.from('client_surveys').insert({ client_id: c.id, sent_at: today, sent_to: c.email }).select('token').single()
  if (error) return { ok: false, error: /duplicate|unique/i.test(String(error.message)) ? 'A survey is already waiting for ' + c.name + '. Send a reminder instead.' : NO_DB }
  if (c.snooze) await db.from('clients').update({ survey_snooze_until: null }).eq('id', c.id)
  if (live()) {
    const m = surveyEmail(c, `${siteUrl()}/survey/${data.token}`, false)
    await sendEmail(c.email, m.subject, m.html).catch(() => {})
  }
  return { ok: true }
}

async function loadFor(clientId: string) {
  const denied = await requireStaff(); if (denied) return { error: denied }
  if (!uuid(clientId)) return { error: 'That client isn’t in your client list any more.' }
  const db = createClient() as any
  const all = await loadSurveys(db)
  if (!all) return { error: NO_DB }
  const c = all.clients.find(x => x.id === clientId)
  if (!c) return { error: 'That client isn’t in your client list any more.' }
  return { db, c, all, today: brisbaneToday() }
}

export async function sendSurvey(clientId: string): Promise<R> {
  const o = await loadFor(clientId); if ('error' in o) return fail(o.error!)
  const { db, c, all, today } = o
  const w = svWaitOf(all.surveys, c.id)
  if (w) return fail('The survey sent ' + dShort(w.sentAt) + ' is still waiting. Send a reminder instead.')
  if (!c.email) return fail('No email on file for ' + c.name + '. Add one on their client page first.')
  const st = svStatus(c, today)
  if (st === 'ended') return fail(c.name + ' has ended, so surveys don’t go out.')
  if (st === 'paused') return fail(c.name + ' is paused. Surveys wait until their cleans start again.')
  if (c.off) return fail('Surveys are turned off for ' + c.name + '. Turn them on first.')
  const r = await sendOne(db, c, today); if (!r.ok) return fail(r.error)
  refresh()
  const next = dLong(addMonths(today, 2))
  return { ok: true, toast: live()
    ? 'Survey emailed to ' + c.email + '. The next one comes up to send on ' + next + '.'
    : 'Survey ready for ' + c.name + '. This is the test site, so no email went out. Use Copy survey link under Waiting to send it by hand.' }
}

export async function sendAllSurveys(): Promise<R> {
  const denied = await requireStaff(); if (denied) return fail(denied)
  const db = createClient() as any
  const all = await loadSurveys(db)
  if (!all) return fail(NO_DB)
  const today = brisbaneToday()
  const due = all.clients.filter(c => svDue(c, all.surveys, today) && !!c.email)
  if (!due.length) return fail('Nothing to send. Each client comes up here every 2 months.')
  const names: string[] = []
  for (const c of due) { const r = await sendOne(db, c, today); if (r.ok) names.push(c.name) }
  refresh()
  if (!names.length) return fail(NO_DB)
  return { ok: true, toast: live()
    ? names.length + ' surveys emailed: ' + names.join(', ') + '.'
    : names.length + ' surveys ready: ' + names.join(', ') + '. This is the test site, so no email went out.' }
}

/** Remind me in 2 weeks: the client leaves To send and comes back in 14 days. */
export async function snoozeSurvey(clientId: string): Promise<R> {
  const o = await loadFor(clientId); if ('error' in o) return fail(o.error!)
  const until = isoAdd(o.today, 14)
  const { error } = await o.db.from('clients').update({ survey_snooze_until: until }).eq('id', o.c.id)
  if (error) return fail(NO_DB)
  refresh()
  return { ok: true, toast: o.c.name + ' comes back to To send on ' + dLong(until) + '.' }
}

export async function setSurveysOff(clientId: string, off: boolean): Promise<R> {
  const o = await loadFor(clientId); if ('error' in o) return fail(o.error!)
  const { db, c, all, today } = o
  const { error } = await db.from('clients').update({ surveys_off: !!off }).eq('id', c.id)
  if (error) return fail(NO_DB)
  refresh()
  if (off) return { ok: true, toast: 'Surveys turned off for ' + c.name + '. They won’t come up to send until you turn them back on.' }
  const c2 = { ...c, off: false }, b = svBase(c2, all.surveys, today)
  return { ok: true, toast: 'Surveys back on for ' + c.name + '. ' + (!b ? 'The first one is due 2 months after their first clean.' : b <= today ? 'One is due now, under To send.' : 'Next one is due ' + dLong(svNext(c2, all.surveys, today)) + '.') }
}

async function loadSurvey(id: string) {
  const denied = await requireStaff(); if (denied) return { error: denied }
  if (!uuid(id)) return { error: GONE }
  const db = createClient() as any
  const all = await loadSurveys(db)
  if (!all) return { error: NO_DB }
  const x = all.surveys.find(s => s.id === id)
  if (!x) return { error: GONE }
  return { db, x, c: all.clients.find(c => c.id === x.clientId) || null, today: brisbaneToday() }
}

/** Send a reminder: once per survey, the same link again. */
export async function remindSurvey(id: string): Promise<R> {
  const o = await loadSurvey(id); if ('error' in o) return fail(o.error!)
  const { db, x, c, today } = o
  if (x.answeredAt) return fail(x.client + ' already answered. It’s under Answers.')
  if (x.remindedAt) return fail('A reminder already went on ' + dShort(x.remindedAt) + '.')
  if (!c || !c.email) return fail('No email on file for ' + x.client + '. Add one on their client page first.')
  const { data, error } = await db.from('client_surveys').update({ reminded_at: today }).eq('id', x.id).is('reminded_at', null).is('answered_at', null).select('token')
  if (error) return fail(NO_DB)
  if (!(data || []).length) return fail(GONE)
  refresh()
  if (!live()) return { ok: true, toast: 'Reminder ready for ' + x.client + '. This is the test site, so no email went out. Use Copy survey link to send it by hand.' }
  const m = surveyEmail(c, `${siteUrl()}/survey/${data[0].token}`, true)
  await sendEmail(c.email, m.subject, m.html).catch(() => {})
  return { ok: true, toast: 'Reminder emailed to ' + c.email + '.' }
}

/** The private link, for Copy survey link. */
export async function surveyLink(id: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const denied = await requireStaff(); if (denied) return { ok: false, error: denied }
  if (!uuid(id)) return { ok: false, error: GONE }
  const db = createClient() as any
  const { data, error } = await db.from('client_surveys').select('token').eq('id', id).maybeSingle()
  if (error) return { ok: false, error: NO_DB }
  if (!data) return { ok: false, error: GONE }
  return { ok: true, url: `${siteUrl()}/survey/${data.token}` }
}

/** Mark followed up: a note for Laith only, also written into the client's history. */
export async function followUpSurvey(id: string, note: string): Promise<R> {
  const t = tidy(note)
  if (t.length < 2) return fail('Write what you did, for example “Called Jodie and fixed the bin run.”')
  if (t.length > 1000) return fail('That’s a bit long. Keep it under 1,000 characters.')
  const o = await loadSurvey(id); if ('error' in o) return fail(o.error!)
  const { db, x, today } = o
  if (!svFlag(x)) return fail(x.followedAt ? 'That one’s already followed up.' : 'That survey doesn’t need a follow up.')
  const { error } = await db.from('client_surveys').update({ followed_at: today, follow_note: t }).eq('id', x.id).is('followed_at', null)
  if (error) return fail(NO_DB)
  await db.from('client_history').insert({ client_id: x.clientId, date: today, text: ('Survey follow up: ' + t).slice(0, 1000) })
  refresh()
  return { ok: true, toast: 'Marked followed up. It’s also in ' + svPoss(x.client) + ' history.' }
}

/** Undo follow up: only on the same day. Takes the line back out of their history too. */
export async function undoFollowUp(id: string): Promise<R> {
  const o = await loadSurvey(id); if ('error' in o) return fail(o.error!)
  const { db, x, today } = o
  if (!x.followedAt) return { ok: true, toast: 'Back on your follow up list.' }
  if (x.followedAt !== today) return fail('A follow up can only be undone on the day you made it.')
  const { error } = await db.from('client_surveys').update({ followed_at: null, follow_note: null }).eq('id', x.id)
  if (error) return fail(NO_DB)
  await db.from('client_history').delete().eq('client_id', x.clientId).eq('date', today).eq('text', ('Survey follow up: ' + x.followNote).slice(0, 1000))
  refresh()
  return { ok: true, toast: 'Back on your follow up list.' }
}
