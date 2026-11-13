'use server'

// The public survey page (/survey/<link>). The client isn't logged in: the private link is the key, and it works once.
// A score of 6 or under tells Laith straight away (email and push).

import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { sendPushToRole } from '@/lib/push'
import { brisbaneToday } from '@/lib/hub/figures'
import { SV_Q, svAvg, svFmt, svLow, svMissing, type SvScores } from '@/lib/hub/surveys'

const TOKEN = /^[0-9a-f]{64}$/
const OFFLINE = 'That didn’t go through. Check your connection and try again.'
const GONE = 'This survey link isn’t valid any more. Call Laith on 0407 026 360.'
const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export async function answerSurvey(token: string, answers: Record<string, number>, notes: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!TOKEN.test(token || '')) return { ok: false, error: GONE }
  const a = answers && typeof answers === 'object' ? answers : {}
  const miss = svMissing(a)
  if (miss.length) return { ok: false, error: 'Rate all 5 before sending. Still to do: ' + miss.join(', ') + '.' }
  const n = String(notes ?? '').trim().replace(/[ \t]+/g, ' ').slice(0, 1000)
  const db = createAdminClient() as any
  const { data: s, error } = await db.from('client_surveys').select('id, client_id, answered_at, clients(business_name)').eq('token', token).maybeSingle()
  if (error) return { ok: false, error: OFFLINE }
  if (!s) return { ok: false, error: GONE }
  if (s.answered_at) return { ok: true }
  const scores = Object.fromEntries(SV_Q.map(q => [q.k, Number(a[q.k])])) as SvScores
  const { data: up, error: uErr } = await db.from('client_surveys').update({ ...scores, notes: n || null, answered_at: brisbaneToday() }).eq('id', s.id).is('answered_at', null).select('id')
  if (uErr) return { ok: false, error: OFFLINE }
  if (!(up || []).length) return { ok: true }

  const name = s.clients?.business_name || 'A client'
  const rec = { scores }
  if (svLow(rec)) {
    const lows = SV_Q.filter(q => scores[q.k] <= 6).map(q => `${q.label} ${scores[q.k]}`)
    const body = `<p><strong>${esc(name)}</strong> answered their survey, average ${svFmt(svAvg(rec))} out of 10.</p><p>Scored 6 or under: ${esc(lows.join(', '))}.</p>${n ? `<p>Their notes: “${esc(n)}”</p>` : ''}<p>It’s on your follow up list under Commercial → Surveys in the hub.</p>`
    if (process.env.RESEND_API_KEY) await sendEmail('admin@corecleaning.services', `${name} scored 6 or under on their survey`, body).catch(() => {})
    await sendPushToRole('admin', { title: `${name}: survey needs a follow up`, body: `Scored 6 or under for ${lows.map(l => l.replace(/ \d+$/, '').toLowerCase()).join(' and ')}`, url: '/hub/commercial/surveys?f=answers' }).catch(() => {})
  }
  // no revalidatePath here: it would re-render this page as "already received" over the thank you (hub pages are dynamic anyway)
  return { ok: true }
}
