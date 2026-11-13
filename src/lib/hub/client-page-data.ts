import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { scopeBoxes } from '@/lib/crew/jobs'
import { shortName } from './figures'
import type { CpClient, CpCleaner, CpHistory, CpProblem, CpService } from './client-page'

const d10 = (v: any) => (v ? String(v).slice(0, 10) : null)
const t5 = (v: any) => (v ? String(v).slice(0, 5) : '')
const when = (iso: string) =>
  new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

/** One commercial client with everything the client page shows, read as the signed-in admin (RLS on).
 *  Null if the hub can't be reached, 'missing' if there's no such client. */
export async function loadClientPage(id: string): Promise<{ c: CpClient; cleaners: CpCleaner[]; problems: CpProblem[]; history: CpHistory[] } | null | 'missing'> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return 'missing'
  const db = createClient() as any
  const issues = async () => {
    const q = await db.from('issues').select('id, body, created_at, resolved_at, cleaner_id, site_id, from_client').eq('client_id', id).order('created_at', { ascending: false }).limit(20)
    // before test-db update 068 there's no from_client column
    return q.error ? db.from('issues').select('id, body, created_at, resolved_at, cleaner_id, site_id').eq('client_id', id).order('created_at', { ascending: false }).limit(20) : q
  }
  const [cQ, sitesQ, svcQ, teamQ, issQ, histQ] = await Promise.all([
    db.from('clients').select('id, business_name, contact_name, contact_phone, contact_email, address, suburb, state, postcode, status, paused_from, resume_on, ended_on, status_reason, is_multi_site, scope, scope_of_work, access_details').eq('id', id).maybeSingle(),
    db.from('client_sites').select('id, site_name, address, suburb, postcode, scope, scope_of_work, access_details, sort_order').eq('client_id', id).order('sort_order'),
    db.from('client_services').select('id, site_id, sort_order, days, every, anchor, first_clean, start_time, finish_time, price, cost, access').eq('client_id', id).order('sort_order'),
    db.from('profiles').select('id, full_name, region, is_team_leader, pack_signed_at').eq('role', 'cleaner').order('full_name'),
    issues(),
    db.from('client_history').select('date, text, created_at').eq('client_id', id).order('date', { ascending: false }).order('created_at', { ascending: false }),
  ])
  if (cQ.error || sitesQ.error || svcQ.error || teamQ.error) return null
  if (!cQ.data) return 'missing'
  const svcIds: string[] = (svcQ.data || []).map((s: any) => s.id)
  const addons = async () => {
    const q = await db.from('client_addons').select('id, service_id, name, freq, price, cost, next_date, items, created_at').in('service_id', svcIds).order('created_at')
    // before test-db update 067 there's no items column: show the standard lists
    return q.error ? db.from('client_addons').select('id, service_id, name, freq, price, cost, next_date, created_at').in('service_id', svcIds).order('created_at') : q
  }
  const [addQ, crewQ] = await Promise.all([
    svcIds.length ? addons() : { data: [] },
    svcIds.length ? db.from('client_service_cleaners').select('service_id, cleaner_id').in('service_id', svcIds) : { data: [] },
  ])
  if (addQ.error || crewQ.error) return null

  const r = cQ.data
  const sites: any[] = sitesQ.data || []
  const siteBy = new Map<string, any>(sites.map(s => [s.id, s]))
  const multi = !!r.is_multi_site || sites.length > 1
  const clientSow = scopeBoxes(r.scope, r.scope_of_work)
  const services: CpService[] = (svcQ.data || []).map((s: any) => {
    const site = s.site_id ? siteBy.get(s.site_id) : null
    const sow = scopeBoxes(site?.scope, site?.scope_of_work)
    return {
      id: s.id, siteId: s.site_id || null, siteName: site?.site_name || '', siteStreet: site?.address || '', siteSuburb: site?.suburb || '', sitePostcode: site?.postcode || '',
      days: s.days || [], every: s.every || 'weekly', anchor: d10(s.anchor), first: d10(s.first_clean), start: t5(s.start_time), finish: t5(s.finish_time),
      price: Number(s.price) || 0, cost: Number(s.cost) || 0,
      // the service's own access details; before they're first saved here, the old ones on the site or client
      access: s.access != null ? String(s.access) : String(site?.access_details || r.access_details || ''),
      cleaners: ((crewQ.data || []) as any[]).filter(x => x.service_id === s.id).map(x => x.cleaner_id),
      addons: ((addQ.data || []) as any[]).filter(a => a.service_id === s.id).map(a => ({
        id: a.id, name: a.name || 'Additional service', freq: a.freq || 'once', price: Number(a.price) || 0, cost: Number(a.cost) || 0, next: d10(a.next_date), items: a.items || [],
      })),
      sow: sow.length ? sow : clientSow,
    }
  })
  const team: CpCleaner[] = ((teamQ.data || []) as any[]).map(p => ({ id: p.id, name: p.full_name || 'Cleaner', region: p.region || null, leader: !!p.is_team_leader, signed: !!p.pack_signed_at }))
  const nameOf = (cid: string | null) => { const t = team.find(x => x.id === cid); return t ? shortName(t.name) : 'A cleaner' }
  const problems: CpProblem[] = issQ.error ? [] : ((issQ.data || []) as any[]).map(p => ({
    id: p.id, body: p.body || '', when: when(p.created_at), cleaner: p.from_client ? 'The client' : nameOf(p.cleaner_id), site: multi && p.site_id ? siteBy.get(p.site_id)?.site_name || '' : '', fixed: !!p.resolved_at,
  }))
  const history: CpHistory[] = histQ.error ? [] : ((histQ.data || []) as any[]).map(h => ({ date: d10(h.date) || '', text: h.text || '' }))
  return {
    c: {
      id: r.id, name: r.business_name || 'Unnamed client', contact: r.contact_name || '', phone: r.contact_phone || '', email: r.contact_email || '',
      street: r.address || '', suburb: r.suburb || '', postcode: r.postcode || '', state: r.state || 'QLD',
      status: r.status || 'active', paused_from: d10(r.paused_from), resume_on: d10(r.resume_on), ended_on: d10(r.ended_on), reason: r.status_reason || '',
      multi, services,
    },
    cleaners: team, problems, history,
  }
}
