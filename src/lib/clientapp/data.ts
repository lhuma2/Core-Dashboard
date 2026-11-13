import 'server-only'
import { clientServer } from './server-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { brisbaneToday } from '@/lib/hub/figures'
import { isoAdd } from '@/lib/hub/timetable'
import { scopeBoxes, svcOnDay, type SvcSrc } from '@/lib/crew/jobs'
import { clientFirst, p12, pDay, pLong, pShort, rqDef, type PortalClean, type PortalData, type PortalDoc, type PortalRequest, type PortalSite } from './portal'

export interface ClientMe { userId: string; profileId: string; name: string; first: string; email: string; clientId: string; biz: string; pwSet: boolean; welcomed: boolean }

/** The signed-in client (client cookie namespace), with their business. Null if signed out, not a client, or not linked
 *  to a business. The role and the business come from the profile row, which only staff can change. */
export async function clientMe(): Promise<ClientMe | null> {
  const sb = clientServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const db = createAdminClient() as any
  let q = await db.from('profiles').select('id, role, full_name, email, password_set_at, first_login_at, linked_client_id').eq('user_id', user.id).maybeSingle()
  if (q.error) q = await db.from('profiles').select('id, role, full_name, email, password_set_at, linked_client_id').eq('user_id', user.id).maybeSingle()
  const p = q.data
  if (!p || p.role !== 'client' || !p.linked_client_id) return null
  const { data: c } = await db.from('clients').select('id, business_name').eq('id', p.linked_client_id).maybeSingle()
  if (!c) return null
  const name = (p.full_name || '').trim() || 'there'
  return {
    userId: user.id, profileId: p.id, name, first: clientFirst(name) || 'there', email: p.email || user.email || '', clientId: c.id, biz: c.business_name || '',
    pwSet: !!p.password_set_at, welcomed: !!p.first_login_at || !!p.password_set_at || !('first_login_at' in p),
  }
}

const d10 = (v: any) => (v ? String(v).slice(0, 10) : null)
const t5 = (v: any) => (v ? String(v).slice(0, 5) : '')
const DN: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const EVERY_WORD: Record<string, string> = { once: '(one-off)', weekly: 'weekly', fortnightly: 'fortnightly', monthly: 'monthly', quarterly: 'every 3 months', six_monthly: 'every 6 months', yearly: 'yearly' }
const clock = (ts: string) => new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Australia/Brisbane' }).format(new Date(ts)).replace(/\s/g, '').replace(':00', '').toLowerCase()
const nowHm = () => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Australia/Brisbane' }).format(new Date())
const first = (n?: string | null) => String(n || '').trim().split(/\s+/)[0] || ''

/** Everything the portal home shows, only ever for the signed-in client's own business. No prices, no access codes. */
export async function loadPortal(me: ClientMe): Promise<PortalData | null> {
  const db = createAdminClient() as any
  const today = brisbaneToday()
  const [cQ, sitesQ, svcQ, jobsQ, reqQ, docQ, insQ] = await Promise.all([
    db.from('clients').select('id, business_name, address, suburb, state, postcode, status, paused_from, resume_on, ended_on, scope, scope_of_work, is_multi_site').eq('id', me.clientId).maybeSingle(),
    db.from('client_sites').select('id, site_name, address, suburb, state, postcode, scope, scope_of_work').eq('client_id', me.clientId),
    db.from('client_services').select('id, site_id, sort_order, days, every, anchor, first_clean, start_time, finish_time').eq('client_id', me.clientId).order('sort_order'),
    db.from('jobs').select('id, service_id, clean_date, status, finished_at, finished_by, site_name').eq('client_id', me.clientId).eq('status', 'done').gte('clean_date', isoAdd(today, -60)).order('clean_date', { ascending: false }).limit(12),
    db.from('client_requests').select('id, kind, site_id, all_sites, service, clean_label, want_date, details, status, reply, created_at').eq('client_id', me.clientId).order('created_at', { ascending: false }).limit(30),
    db.from('proposal_documents').select('id, ref_number, kind, sign_code, signed_at, signed_name').eq('client_id', me.clientId).eq('status', 'signed').not('signed_at', 'is', null).order('signed_at', { ascending: false }),
    db.from('compliance_documents').select('id, name, type, file_url, expiry_date, client_id').eq('type', 'insurance').is('client_id', null).order('created_at', { ascending: false }).limit(1),
  ])
  if (cQ.error || sitesQ.error || svcQ.error || !cQ.data) return null
  const c = cQ.data
  const sites: any[] = sitesQ.data || []
  const siteBy = new Map<string, any>(sites.map(s => [s.id, s]))
  const svcs: any[] = svcQ.data || []
  const svcIds = svcs.map(s => s.id)
  const [crewQ, addQ, oneQ, whoQ] = await Promise.all([
    svcIds.length ? db.from('client_service_cleaners').select('service_id, cleaner:profiles(full_name)').in('service_id', svcIds) : { data: [] },
    svcIds.length ? db.from('client_addons').select('service_id, name, freq, next_date').in('service_id', svcIds) : { data: [] },
    db.from('one_offs').select('id, service_id, request_id, clean_date, start_time, finish_time').eq('client_id', me.clientId).gte('clean_date', isoAdd(today, -60)),
    (jobsQ.data || []).some((j: any) => j.finished_by) ? db.from('profiles').select('id, full_name').in('id', Array.from(new Set((jobsQ.data || []).map((j: any) => j.finished_by).filter(Boolean)))) : { data: [] },
  ])
  const multi = !!c.is_multi_site || sites.length > 1
  const place = (o: any) => [o?.address, [o?.suburb, o?.state || 'QLD', o?.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const nameOf = (s: any) => { const site = s.site_id ? siteBy.get(s.site_id) : null; return multi && site?.site_name ? site.site_name : c.business_name || 'Your site' }
  const team = (sid: string) => ((crewQ.data || []) as any[]).filter(x => x.service_id === sid && x.cleaner?.full_name).map(x => first(x.cleaner.full_name))

  const portalSites: PortalSite[] = svcs.map(s => {
    const site = s.site_id ? siteBy.get(s.site_id) : null
    const sow = scopeBoxes(site?.scope, site?.scope_of_work)
    const boxes = sow.length ? sow : scopeBoxes(c.scope, c.scope_of_work)
    const ex = ((addQ.data || []) as any[]).filter(a => a.service_id === s.id && !(a.freq === 'once' && !a.next_date))
    const names = team(s.id)
    const start = t5(s.start_time), fin = t5(s.finish_time)
    return {
      id: s.site_id || s.id, name: nameOf(s), address: place(site?.address ? site : c),
      days: (s.days || []).map((d: string) => DN[d]).join(', ') + (s.every === 'fortnightly' ? ', fortnightly' : s.every === 'monthly' ? ', monthly' : ''),
      time: start ? p12(start) + (fin ? ' to ' + p12(fin) : '') : 'Time to be confirmed',
      team: names.length ? 'Cleaner: ' + names.join(', ') : 'Cleaner: to be confirmed',
      extras: ex.map(a => a.name + ' ' + (EVERY_WORD[a.freq] || '')).join(', ').replace(/\s+,/g, ','),
      sow: boxes.map(b => ({ heading: b.heading, items: b.items.map(i => i.text) })),
    }
  })

  // Coming up: regular cleans and booked extra cleans, the next 6. Today's stays here until its finish time or it's done.
  const doneToday = new Set(((jobsQ.data || []) as any[]).filter(j => d10(j.clean_date) === today).map(j => j.service_id))
  const hm = nowHm()
  const upcoming: PortalClean[] = []
  const srcOf = (s: any): SvcSrc => ({
    id: s.id, clientId: c.id, name: '', address: '', suburb: '', days: s.days || [], every: s.every || 'weekly', anchor: d10(s.anchor), first: d10(s.first_clean),
    start: t5(s.start_time), finish: t5(s.finish_time), access: '', team: [], scope: [], status: c.status, paused_from: d10(c.paused_from), resume_on: d10(c.resume_on), ended_on: d10(c.ended_on), addons: [],
  })
  const row = (s: any, iso: string, start: string, fin: string, key: string): PortalClean => ({
    key, iso, start, day: iso === today ? 'Today' : iso === isoAdd(today, 1) ? 'Tmrw' : pDay(iso), date: pShort(iso), site: nameOf(s), siteId: s.site_id || null,
    time: start ? p12(start) + (fin ? ' to ' + p12(fin) : '') : 'Time to be confirmed', sub: '',
  })
  for (let n = 0; n < 70 && upcoming.length < 40; n++) {
    const iso = isoAdd(today, n)
    for (const s of svcs) {
      const src = srcOf(s)
      if (!svcOnDay(src, iso)) continue
      if (iso === today && (doneToday.has(s.id) || (src.finish ? src.finish <= hm : false))) continue
      upcoming.push(row(s, iso, src.start, src.finish, 's.' + s.id + '.' + iso))
    }
  }
  for (const o of ((oneQ.error ? [] : oneQ.data) || []) as any[]) {
    const s = svcs.find(x => x.id === o.service_id); if (!s) continue
    const iso = d10(o.clean_date)!
    if (iso < today) continue
    if (iso === today && (doneToday.has(s.id) || (o.finish_time && t5(o.finish_time) <= hm))) continue
    if (upcoming.some(u => u.key === 's.' + s.id + '.' + iso)) continue
    const r = row(s, iso, t5(o.start_time), t5(o.finish_time), 's.' + s.id + '.' + iso)
    r.sub = 'Extra clean'
    upcoming.push(r)
  }
  upcoming.sort((a, b) => (a.iso + a.start).localeCompare(b.iso + b.start))

  const who = new Map<string, string>(((whoQ.data || []) as any[]).map(p => [p.id, first(p.full_name)]))
  const recent: PortalClean[] = ((jobsQ.data || []) as any[]).slice(0, 6).map(j => {
    const s = svcs.find(x => x.id === j.service_id) || { site_id: null }
    const iso = d10(j.clean_date)!
    const r = row(s, iso, '', '', 'j.' + j.id)
    r.day = iso === today ? 'Today' : iso === isoAdd(today, -1) ? 'Ystdy' : pDay(iso)
    r.sub = [j.finished_at ? 'Finished ' + clock(j.finished_at) : 'Finished', j.finished_by && who.get(j.finished_by)].filter(Boolean).join(' · ')
    r.jobId = j.id
    return r
  })

  // an extra clean Laith booked from the request, when he hasn't written a reply
  const booked = (id: string) => {
    const o = ((oneQ.error ? [] : oneQ.data) || [] as any[]).find((x: any) => x.request_id === id)
    return o ? 'Booked for ' + pLong(d10(o.clean_date)!) + (p12(t5(o.start_time)) ? ' at ' + p12(t5(o.start_time)) : '') + '.' : ''
  }
  const requests: PortalRequest[] = (reqQ.error ? [] : (reqQ.data || []) as any[]).map(r => {
    const def = rqDef(r.kind)
    const where = r.clean_label || (r.all_sites ? 'All sites' : r.site_id ? (multi ? siteBy.get(r.site_id)?.site_name || '' : '') : '')
    const txt = String(r.details || '')
    const bits = [r.service || '', where, r.want_date ? 'for ' + pShort(d10(r.want_date)!) : '', 'sent ' + pShort(new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(new Date(r.created_at)))].filter(Boolean).join(' · ')
    return { id: r.id, title: def?.label || 'Request', sub: bits + (txt ? ': ' + (txt.length > 70 ? txt.slice(0, 67) + '…' : txt) : ''), reply: r.reply ? 'Laith: ' + r.reply : booked(r.id), status: r.status }
  })

  const docs: PortalDoc[] = []
  for (const d of ((docQ.error ? [] : docQ.data) || []) as any[]) {
    if (!d.sign_code) continue
    docs.push({ title: d.kind === 'specialist_agreement' ? 'Specialist works agreement' : 'Service agreement', sub: [d.ref_number, d.signed_at ? 'signed' + (d.signed_name ? ' by ' + d.signed_name : '') + ' on ' + pShort(d10(d.signed_at)!) + ' ' + String(d.signed_at).slice(0, 4) : ''].filter(Boolean).join(' · '), href: `/sign/${d.sign_code}/pdf` })
  }
  const coc = ((insQ.error ? [] : insQ.data) || [])[0]
  if (coc?.file_url) docs.push({ title: 'Certificate of Currency', sub: 'Public liability' + (coc.expiry_date ? ' · current to ' + pShort(d10(coc.expiry_date)!) + ' ' + String(coc.expiry_date).slice(0, 4) : ''), href: `/api/file?url=${Buffer.from(coc.file_url).toString('base64url')}` })
  docs.push({ title: 'Compliance pack', sub: 'Safe Work Method Statements, policies and insurances', href: '/client/app/compliance' })
  docs.push({ title: 'Capability statement', sub: 'Who we are and what we do', href: '/client/app/doc/capability' })

  return { sites: portalSites, upcoming: upcoming.slice(0, 6), recent, requests, docs }
}
