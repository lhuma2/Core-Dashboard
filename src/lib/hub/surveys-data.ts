import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { type SvClient, type SvRec, svDue, svFlag } from './surveys'

const d10 = (v: any) => (v ? String(v).slice(0, 10) : null)
export const SV_COLS = 'id, client_id, sent_at, sent_to, reminded_at, answered_at, comm, qual, rel, value, rec, notes, followed_at, follow_note'

export function svClient(c: any, firstClean: string | null): SvClient {
  return {
    id: c.id, name: c.business_name || 'Client', email: String(c.contact_email || '').trim(), contact: String(c.contact_name || '').trim(),
    status: c.status || 'active', resumeOn: d10(c.resume_on), off: !!c.surveys_off, snooze: d10(c.survey_snooze_until), firstClean,
  }
}
export function svRec(s: any, name: string): SvRec {
  return {
    id: s.id, clientId: s.client_id, client: name, sentAt: d10(s.sent_at)!, sentTo: s.sent_to || '', remindedAt: d10(s.reminded_at),
    answeredAt: d10(s.answered_at), scores: s.answered_at ? { comm: s.comm, qual: s.qual, rel: s.rel, value: s.value, rec: s.rec } : null,
    notes: s.notes || '', followedAt: d10(s.followed_at), followNote: s.follow_note || '',
  }
}

/** Every commercial client (ended ones too, for their old answers) and every survey, read as the signed-in admin.
 *  Null if the hub can't be reached. `db` lets the actions reuse it with their own client. */
export async function loadSurveys(db: any = createClient()): Promise<{ clients: SvClient[]; surveys: SvRec[] } | null> {
  const [cQ, sQ, vQ] = await Promise.all([
    db.from('clients').select('id, business_name, contact_name, contact_email, status, resume_on, surveys_off, survey_snooze_until').order('business_name'),
    db.from('client_services').select('client_id, first_clean'),
    db.from('client_surveys').select(SV_COLS).order('sent_at', { ascending: false }),
  ])
  if (cQ.error || sQ.error || vQ.error) return null
  const first = new Map<string, string>()
  for (const s of (sQ.data || []) as any[]) {
    const f = d10(s.first_clean)
    if (f && (!first.has(s.client_id) || f < first.get(s.client_id)!)) first.set(s.client_id, f)
  }
  const clients = ((cQ.data || []) as any[]).map(c => svClient(c, first.get(c.id) || null))
  const name = new Map(clients.map(c => [c.id, c.name]))
  const surveys = ((vQ.data || []) as any[]).map(s => svRec(s, name.get(s.client_id) || 'Client'))
  return { clients, surveys }
}

/** The Surveys tab count: clients to send to, plus answers to follow up. */
export function surveysNeedingYouOf(all: { clients: SvClient[]; surveys: SvRec[] }, today: string): number {
  return all.clients.filter(c => svDue(c, all.surveys, today)).length + all.surveys.filter(svFlag).length
}
export async function surveysNeedingYou(today: string): Promise<number> {
  const all = await loadSurveys()
  return all ? surveysNeedingYouOf(all, today) : 0
}
