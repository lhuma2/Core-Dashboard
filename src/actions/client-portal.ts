'use server'
// The client portal's buttons (mock-up Client.dc.html). Every write is done here with the service key, only ever for
// the signed-in client's own business, so clients need no rights on the tables themselves.
import { revalidatePath } from 'next/cache'
import { clientServer } from '@/lib/clientapp/server-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { brisbaneToday } from '@/lib/hub/figures'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { clientMe, loadPortal } from '@/lib/clientapp/data'
import { pwCheck, rqDef, RQ_SERVICES, pShort } from '@/lib/clientapp/portal'

type R = { ok: true; toast: string } | { ok: false; error: string }
const OFFLINE = 'That didn’t send. Check your connection and try again.'
const OUT = 'You’ve been logged out. Log in again to carry on.'
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Save a new password. From the welcome page (no current password) only while they're still on the starter one;
 *  from Change password the current one is checked first. */
export async function clientSavePassword(current: string | null, p1: string, p2: string): Promise<R> {
  const me = await clientMe()
  if (!me) return { ok: false, error: OUT }
  const sb = clientServer()
  if (current !== null) {
    if (!current) return { ok: false, error: 'Your current password isn’t right.' }
    const { error } = await sb.auth.signInWithPassword({ email: me.email, password: String(current) })
    if (error) return { ok: false, error: /fetch|network/i.test(error.message) ? OFFLINE : 'Your current password isn’t right.' }
  } else if (me.pwSet) {
    return { ok: false, error: 'You’ve already chosen your own password. Use Change password in the menu.' }
  }
  const a = String(p1 || ''), b = String(p2 || '')
  const bad = pwCheck(a, b, me.first)
  if (bad) return { ok: false, error: bad }
  if (current !== null && a === current) return { ok: false, error: 'That’s the same as your current password.' }
  const { error } = await sb.auth.updateUser({ password: a })
  if (error) {
    if (/different from the old/i.test(error.message)) return { ok: false, error: 'That’s the same as your current password.' }
    if (/weak|pwned|leaked/i.test(error.message)) return { ok: false, error: 'That password is too easy to guess. Try a longer one.' }
    return { ok: false, error: OFFLINE }
  }
  const db = createAdminClient() as any
  const now = new Date().toISOString()
  const r = await db.from('profiles').update({ password_set_at: now, first_login_at: now }).eq('id', me.profileId)
  if (r.error) await db.from('profiles').update({ password_set_at: now }).eq('id', me.profileId)
  revalidatePath('/client/app', 'layout')
  return { ok: true, toast: 'Password saved. Use it next time you log in.' }
}

/** After a Forgot password link: they chose their own password, so no starter-password reminder or welcome page. */
export async function clientPasswordReset(): Promise<R> {
  const me = await clientMe()
  if (!me) return { ok: false, error: OUT }
  const db = createAdminClient() as any
  const now = new Date().toISOString()
  const r = await db.from('profiles').update({ password_set_at: now, first_login_at: now }).eq('id', me.profileId)
  if (r.error) await db.from('profiles').update({ password_set_at: now }).eq('id', me.profileId)
  return { ok: true, toast: '' }
}

/** Skip for now: keep the starter password. The home page shows a reminder until they change it. */
export async function clientSkipWelcome(): Promise<R> {
  const me = await clientMe()
  if (!me) return { ok: false, error: OUT }
  const db = createAdminClient() as any
  await db.from('profiles').update({ first_login_at: new Date().toISOString() }).eq('id', me.profileId)
  revalidatePath('/client/app', 'layout')
  return { ok: true, toast: 'No problem. You can change it any time from the menu at the top right.' }
}

export interface RequestForm { kind: string; site: string; service: string; clean: string; date: string; text: string }

/** Send a request to Laith (Requests tab). Same checks and words as the mock-up. */
export async function sendClientRequest(f: RequestForm): Promise<R> {
  const me = await clientMe()
  if (!me) return { ok: false, error: OUT }
  const t = rqDef(f.kind)
  if (!t) return { ok: false, error: 'Choose what you need from the Requests tab.' }
  const data = await loadPortal(me)
  if (!data) return { ok: false, error: OFFLINE }
  const today = brisbaneToday()
  let clean: (typeof data.recent)[number] | undefined
  if (t.clean) { clean = data.recent.find(r => r.key === f.clean); if (!clean) return { ok: false, error: 'Choose which clean.' } }
  if (t.service && !RQ_SERVICES.includes(f.service)) return { ok: false, error: 'Choose which service.' }
  if (t.date === 'req' && !ISO.test(f.date || '')) return { ok: false, error: 'Choose the day.' }
  if (t.date && f.date && (!ISO.test(f.date) || f.date < today)) return { ok: false, error: 'That date is in the past.' }
  const txt = String(f.text || '').trim().replace(/\s+/g, ' ')
  if (t.textReq && txt.length < 5) return { ok: false, error: 'Add a few words so we know what you need.' }
  if (txt.length > 2000) return { ok: false, error: 'That’s a bit long. Keep it under 2,000 characters.' }
  const allSites = t.site && f.site === 'all' && data.sites.length > 1
  const site = t.site && !allSites ? data.sites.find(s => s.id === f.site) || data.sites[0] : null
  const db = createAdminClient() as any
  const siteId = site && (await db.from('client_sites').select('id').eq('id', site.id).eq('client_id', me.clientId).maybeSingle()).data?.id || null
  const label = clean ? clean.site + ', ' + clean.day + ' ' + clean.date : null
  const { data: row, error } = await db.from('client_requests').insert({
    client_id: me.clientId, sent_by: me.profileId, kind: t.id, site_id: clean ? clean.siteId : siteId, all_sites: !!allSites, service: t.service ? f.service : null,
    job_id: clean?.jobId || null, clean_label: label, want_date: t.date && f.date ? f.date : null, details: txt,
  }).select('id').single()
  if (error || !row) return { ok: false, error: OFFLINE }
  if (t.id === 'problem') {
    await db.from('issues').insert({ client_id: me.clientId, site_id: clean?.siteId || null, job_id: clean?.jobId || null, body: txt, from_client: true, request_id: row.id })
  }
  const where = label || (allSites ? 'All sites' : site?.name || '')
  const bits = [t.service ? f.service : '', where, f.date ? 'for ' + pShort(f.date) : ''].filter(Boolean).join(' · ')
  await sendPushToRole('admin', { title: `${me.biz}: ${t.label}`, body: (bits ? bits + (txt ? ': ' : '') : '') + txt.slice(0, 140), url: '/hub/commercial/requests' }).catch(() => {})
  await sendEmail('admin@corecleaning.services', `${t.label} from ${me.biz}`,
    `<p><strong>${esc(me.name)}</strong> from <strong>${esc(me.biz)}</strong> sent a request from their portal: <strong>${esc(t.label)}</strong>.</p>` +
    (bits ? `<p>${esc(bits)}</p>` : '') + (txt ? `<p style="white-space:pre-line">${esc(txt)}</p>` : '') +
    `<p>Reply to them from Commercial → Requests in the hub.</p>`).catch(() => {})
  revalidatePath('/client/app', 'layout')
  revalidatePath('/hub', 'layout')
  return {
    ok: true,
    toast: t.id === 'photos' ? 'Sent. We’ll email you the photos from that clean, usually within a day.' : t.id === 'quote' ? 'Sent. Laith will be in touch with a quote, usually within 2 business days.' : 'Sent to Laith. We’ll reply by email, usually the same business day.',
  }
}
