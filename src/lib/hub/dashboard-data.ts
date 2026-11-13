import 'server-only'
import { createClient } from '@/lib/supabase/server'
import {
  brisbaneToday, brisbaneHour, commercialTotals, homeTotals, surveyCard, teamCard,
  type CommercialClient, type Home, type SurveyClient, type Survey,
} from './figures'
import { COMPLIANCE_PACK } from './compliance-pack'

/** Everything the dashboard shows, read live (no cache) as the signed-in admin. */
export async function loadDashboard(now: Date = new Date()) {
  const supabase = createClient() as any
  const today = brisbaneToday(now)

  const [clientsQ, servicesQ, addonsQ, homesQ, cleanersQ, issuesQ, surveysQ, reqQ] = await Promise.all([
    supabase.from('clients').select('id, status, resume_on, surveys_off, survey_snooze_until'),
    supabase.from('client_services').select('id, client_id, days, every, price, cost, first_clean'),
    supabase.from('client_addons').select('service_id, freq, price, cost'),
    supabase.from('homes').select('division, kind, every, days, first_clean, price, cost, status, resume_on, cancelled'),
    supabase.from('profiles').select('region').eq('role', 'cleaner'),
    supabase.from('issues').select('id', { count: 'exact', head: true }).is('resolved_at', null),
    supabase.from('client_surveys').select('client_id, sent_at, answered_at, followed_at, comm, qual, rel, value, rec'),
    // before test-db update 068 there's no requests table: shows 0
    supabase.from('client_requests').select('id', { count: 'exact', head: true }).eq('status', 'new'),
  ])
  const failed = [clientsQ, servicesQ, addonsQ, homesQ, cleanersQ, issuesQ, surveysQ].find(q => q.error)
  if (failed) throw new Error(failed.error.message)

  const addonsBy = new Map<string, any[]>()
  for (const a of addonsQ.data) addonsBy.set(a.service_id, [...(addonsBy.get(a.service_id) ?? []), a])
  const servicesBy = new Map<string, any[]>()
  for (const s of servicesQ.data) servicesBy.set(s.client_id, [...(servicesBy.get(s.client_id) ?? []), s])

  const commercial: CommercialClient[] = clientsQ.data.map((c: any) => ({
    status: c.status,
    resume_on: c.resume_on,
    services: (servicesBy.get(c.id) ?? []).map(s => ({
      days: s.days ?? [], every: s.every, price: Number(s.price), cost: Number(s.cost),
      addons: (addonsBy.get(s.id) ?? []).map(a => ({ freq: a.freq, price: Number(a.price), cost: Number(a.cost) })),
    })),
  }))
  const homes = homesQ.data.map((h: any) => ({ ...h, days: h.days ?? [], price: Number(h.price), cost: Number(h.cost) }))

  // Survey list covers commercial clients that haven't ended.
  const surveyClients: SurveyClient[] = clientsQ.data.map((c: any) => ({
    id: c.id, status: c.status, resume_on: c.resume_on, surveys_off: c.surveys_off, survey_snooze_until: c.survey_snooze_until,
    first_clean: (servicesBy.get(c.id) ?? []).map(s => s.first_clean).filter(Boolean).sort()[0] ?? null,
  }))
  const surveys: Survey[] = surveysQ.data.map((s: any) => ({
    client_id: s.client_id, sent_at: s.sent_at, answered_at: s.answered_at, followed_at: s.followed_at,
    scores: s.answered_at ? [s.comm, s.qual, s.rel, s.value, s.rec] : null,
  }))

  return {
    today,
    hour: brisbaneHour(now),
    commercial: commercialTotals(commercial, today),
    residential: homeTotals(homes.filter((h: Home & { division: string }) => h.division === 'res'), today),
    eol: homeTotals(homes.filter((h: Home & { division: string }) => h.division === 'eol'), today),
    team: teamCard(cleanersQ.data),
    compliance: COMPLIANCE_PACK.length,
    problemsOpen: issuesQ.count ?? 0,
    requestsNew: reqQ.error ? 0 : reqQ.count ?? 0,
    surveys: surveyCard(surveyClients, surveys, today),
  }
}
