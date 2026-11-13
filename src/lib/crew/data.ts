import 'server-only'
import { crewServer } from './server-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { brisbaneToday } from '@/lib/hub/figures'
import { isoAdd } from '@/lib/hub/timetable'
import { eolScope, residentialScope } from '@/lib/hub/home-quotes'
import { crewJobs, firstName, parseKey, scopeBoxes, type CrewJob, type HomeSrc, type JobRow, type SowBox, type SvcSrc } from './jobs'

export interface Me { userId: string; profileId: string; name: string; first: string; email: string; pwSet: boolean }

/** The signed-in cleaner (cleaner cookie namespace). Null if signed out or not a cleaner. The role comes from the
 *  profile row, which only staff can change, never from the user's own metadata. */
export async function crewMe(): Promise<Me | null> {
  const sb = crewServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const db = createAdminClient() as any
  const { data: p } = await db.from('profiles').select('id, role, full_name, email, password_set_at').eq('user_id', user.id).maybeSingle()
  if (!p || p.role !== 'cleaner') return null
  const name = (p.full_name || '').trim() || 'Cleaner'
  return { userId: user.id, profileId: p.id, name, first: firstName(name) || 'there', email: p.email || user.email || '', pwSet: !!p.password_set_at }
}

const HOME_SRC = 'id, division, name, street, suburb, state, postcode, kind, every, days, anchor, first_clean, start_time, finish_time, beds, baths, notes, status, paused_from, resume_on, ended_on, done, cancelled, windows_freq'
const d10 = (v: any) => (v ? String(v).slice(0, 10) : null)
const RANK: Record<string, number> = { signed: 3, sent: 2, draft: 1 }

/** Add-ons with their own task lists. Falls back to the standard lists if the test database hasn't had update 067 yet. */
async function addonsFor(db: any, ids: string[]) {
  const q = await db.from('client_addons').select('id, service_id, name, freq, next_date, items').in('service_id', ids)
  return q.error ? db.from('client_addons').select('id, service_id, name, freq, next_date').in('service_id', ids) : q
}

function homeSrc(r: any, scope: HomeSrc['scope']): HomeSrc {
  return {
    ...r, days: r.days || [], anchor: d10(r.anchor), first_clean: d10(r.first_clean), paused_from: d10(r.paused_from), resume_on: d10(r.resume_on), ended_on: d10(r.ended_on),
    beds: r.beds ?? 0, baths: r.baths ?? 0, done: !!r.done, cancelled: !!r.cancelled, scope,
  }
}
export function fallbackSow(h: HomeSrc): SowBox[] {
  const boxes = h.division === 'eol' ? eolScope() : residentialScope(h.kind === 'oneoff' ? 'deep' : 'general')
  return boxes.map(b => ({ heading: b.heading, items: b.items.map(i => ({ text: i.text, freq: '' })) }))
}

interface Filter { home?: string; svc?: string }

/** The cleaner's jobs from `from` for `days` days. Read with the service key, always filtered to this cleaner. */
export async function loadCrewJobs(me: Me, from: string, days: number, only: Filter = {}): Promise<CrewJob[] | null> {
  const db = createAdminClient() as any
  const today = brisbaneToday()
  const to = isoAdd(from, days - 1)
  const lo = from < today ? from : today, hi = to > today ? to : today

  // homes (Residential and End of Lease) where this cleaner is the cleaner
  let hq = db.from('homes').select(HOME_SRC).eq('cleaner_id', me.profileId)
  if (only.home) hq = hq.eq('id', only.home)
  // commercial services this cleaner is on
  let sq = db.from('client_service_cleaners').select('service_id').eq('cleaner_id', me.profileId)
  if (only.svc) sq = sq.eq('service_id', only.svc)
  const [homesQ, onQ] = await Promise.all([only.svc ? { data: [] } : hq, only.home ? { data: [] } : sq])
  if (homesQ.error || onQ.error) return null
  const homeRows: any[] = homesQ.data || []
  const svcIds: string[] = Array.from(new Set(((onQ.data || []) as any[]).map(x => x.service_id)))
  const homeIds = homeRows.map(h => h.id)

  const [docsQ, svcQ, crewQ, addQ, oneQ, hRuns, sRuns] = await Promise.all([
    homeIds.length ? db.from('home_docs').select('home_id, status, snap, created_on').in('home_id', homeIds) : { data: [] },
    svcIds.length ? db.from('client_services').select('id, client_id, site_id, days, every, anchor, first_clean, start_time, finish_time, access').in('id', svcIds) : { data: [] },
    svcIds.length ? db.from('client_service_cleaners').select('service_id, cleaner:profiles(full_name)').in('service_id', svcIds) : { data: [] },
    svcIds.length ? addonsFor(db, svcIds) : { data: [] },
    svcIds.length ? db.from('one_offs').select('service_id, clean_date, start_time, finish_time').in('service_id', svcIds).gte('clean_date', isoAdd(from, -1)).lte('clean_date', isoAdd(from, days + 1)) : { data: [] },
    homeIds.length ? db.from('jobs').select('id, home_id, service_id, clean_date, status, started_at, finished_at, ticks, photo_count, note').in('home_id', homeIds).gte('clean_date', lo).lte('clean_date', hi) : { data: [] },
    svcIds.length ? db.from('jobs').select('id, home_id, service_id, clean_date, status, started_at, finished_at, ticks, photo_count, note').in('service_id', svcIds).gte('clean_date', lo).lte('clean_date', hi) : { data: [] },
  ])
  if ([docsQ, svcQ, crewQ, addQ, hRuns, sRuns].some((q: any) => q.error)) return null

  // scope for each home: the agreement's locked scope (signed first), else the standard one
  const bestDoc = new Map<string, any>()
  for (const d of (docsQ.data || []) as any[]) {
    if (!d.snap || !Array.isArray(d.snap.scope) || !d.snap.scope.length) continue
    const cur = bestDoc.get(d.home_id)
    if (!cur || (RANK[d.status] || 0) > (RANK[cur.status] || 0) || ((RANK[d.status] || 0) === (RANK[cur.status] || 0) && String(d.created_on) > String(cur.created_on))) bestDoc.set(d.home_id, d)
  }
  const homes: HomeSrc[] = homeRows.map(r => {
    const snap = bestDoc.get(r.id)?.snap
    const scope = snap ? (snap.scope as any[]).map(b => ({ heading: String(b.heading || ''), items: (b.items || []).map((x: any) => String(x)).filter(Boolean) })) : null
    return homeSrc(r, scope)
  })

  // commercial: clients and sites
  const svcRows: any[] = svcQ.data || []
  const clientIds = Array.from(new Set(svcRows.map(s => s.client_id)))
  const siteIds = Array.from(new Set(svcRows.map(s => s.site_id).filter(Boolean)))
  const [cQ, siteQ] = await Promise.all([
    clientIds.length ? db.from('clients').select('id, business_name, address, suburb, state, postcode, status, paused_from, resume_on, ended_on, scope, scope_of_work, access_details').in('id', clientIds) : { data: [] },
    siteIds.length ? db.from('client_sites').select('id, site_name, address, suburb, state, postcode, scope, scope_of_work, access_details').in('id', siteIds) : { data: [] },
  ])
  if (cQ.error || siteQ.error) return null
  const clientBy = new Map<string, any>(((cQ.data || []) as any[]).map(c => [c.id, c]))
  const siteBy = new Map<string, any>(((siteQ.data || []) as any[]).map(s => [s.id, s]))
  const teamBy = new Map<string, string[]>()
  for (const x of (crewQ.data || []) as any[]) if (x.cleaner?.full_name) teamBy.set(x.service_id, [...(teamBy.get(x.service_id) || []), x.cleaner.full_name])
  const addBy = new Map<string, any[]>()
  for (const a of (addQ.data || []) as any[]) addBy.set(a.service_id, [...(addBy.get(a.service_id) || []), a])
  const place = (o: any) => [o?.address, [o?.suburb, o?.state || 'QLD', o?.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  const svcs: SvcSrc[] = []
  for (const s of svcRows) {
    const c = clientBy.get(s.client_id)
    if (!c) continue
    const site = s.site_id ? siteBy.get(s.site_id) : null
    const sow = scopeBoxes(site?.scope, site?.scope_of_work)
    svcs.push({
      id: s.id, clientId: c.id, name: (c.business_name || 'Client') + (site?.site_name ? ', ' + site.site_name : ''),
      address: place(site?.address ? site : c), suburb: (site?.address ? site.suburb : c.suburb) || '',
      days: s.days || [], every: s.every || 'weekly', anchor: d10(s.anchor), first: d10(s.first_clean),
      start: (s.start_time || '').slice(0, 5), finish: (s.finish_time || '').slice(0, 5),
      access: s.access != null ? String(s.access) : site?.access_details || c.access_details || '', team: (teamBy.get(s.id) || [me.name]).sort((a, b) => (a === me.name ? -1 : b === me.name ? 1 : a.localeCompare(b))),
      scope: sow.length ? sow : scopeBoxes(c.scope, c.scope_of_work),
      status: c.status, paused_from: d10(c.paused_from), resume_on: d10(c.resume_on), ended_on: d10(c.ended_on),
      addons: (addBy.get(s.id) || []).map(a => ({ id: a.id, name: a.name, freq: a.freq, next_date: d10(a.next_date), items: a.items || null })),
      extras: ((oneQ.error ? [] : oneQ.data || []) as any[]).filter(o => o.service_id === s.id).map(o => ({ iso: d10(o.clean_date)!, start: (o.start_time || '').slice(0, 5), finish: (o.finish_time || '').slice(0, 5) })),
    })
  }
  const runs: JobRow[] = [...(hRuns.data || []), ...(sRuns.data || [])].map((r: any) => ({ ...r, clean_date: d10(r.clean_date) }))
  return crewJobs(homes, svcs, runs, me.name, today, from, days, fallbackSow)
}

/** One job by its key, only if it's on this cleaner's list that day. */
export async function loadCrewJob(me: Me, key: string): Promise<CrewJob | null | 'missing'> {
  const k = parseKey(key)
  if (!k) return 'missing'
  const list = await loadCrewJobs(me, k.iso, 1, k.t === 'h' ? { home: k.id } : { svc: k.id })
  if (!list) return null
  return list.find(j => j.key === key) || 'missing'
}

/** Photo ids already received for a job. */
export async function loadJobPhotoIds(jobId: string | null): Promise<string[]> {
  if (!jobId) return []
  const db = createAdminClient() as any
  const { data } = await db.from('clean_photos').select('id').eq('job_id', jobId)
  return ((data as any[]) || []).map(r => r.id)
}
