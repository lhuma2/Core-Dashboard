import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { cleansPerMonth, currentStatus, ADDON_PER_YEAR, type AddonFreq } from './figures'
import { scopeBoxes } from '@/lib/crew/jobs'
import { AGR_COLS, PROP_COLS, agrOf, propOf, t12s, type Agr, type ClientSnap, type PresetScope, type Prop } from './proposals'
import { PRESETS } from './comm-text'

const DAYW: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const d10 = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)

/** Every proposal that isn't deleted, with its agreement (if accepted) and whether works were booked. Null if offline. */
export async function loadProps(db: any = createClient()): Promise<Prop[] | null> {
  const [pQ, aQ] = await Promise.all([
    db.from('proposals').select(PROP_COLS).is('deleted_at', null).order('created_at', { ascending: false }),
    db.from('agreements').select('id, ref, code, status, signed_by, proposal_id, client_id').not('proposal_id', 'is', null),
  ])
  if (pQ.error || aQ.error) return null
  const agr = new Map<string, any>(((aQ.data || []) as any[]).map(a => [a.proposal_id, a]))
  return ((pQ.data || []) as any[]).map(r => {
    const a = agr.get(r.id)
    // accepted with no agreement: a current client's specialist quote, booked straight in
    return propOf(r, a ? { id: a.id, ref: a.ref, code: a.code, status: a.status, signedBy: a.signed_by || '', clientId: a.client_id || null } : null, r.status === 'accepted' && !a && !!r.works_date)
  })
}

export async function loadProp(id: string, db: any = createClient()): Promise<Prop | null> {
  const all = await loadProps(db)
  return all ? all.find(p => p.id === id) || null : null
}

/** The preset scopes (the table, or the built-in ones if the table isn't there yet). */
export async function loadPresets(db: any = createClient()): Promise<PresetScope[]> {
  const { data, error } = await db.from('scope_presets').select('id, name, note, sow, sort').order('sort')
  if (error || !data?.length) return PRESETS
  return (data as any[]).map(r => ({ id: r.id, name: r.name, note: r.note || '', sow: Array.isArray(r.sow) ? r.sow : [] }))
}

export interface PickClient { id: string; name: string; contact: string; email: string; address: string; status: string }
export interface PickLead { id: string; company: string; name: string; email: string; address: string }

/** "Fill in from a lead or client": walk-through and follow-up leads from Prospecting, then every current client. */
export async function loadFillFrom(db: any = createClient()): Promise<{ leads: PickLead[]; clients: PickClient[] }> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient() as any // cold_leads has no RLS policies: staff checked by the page
  const [lQ, cQ] = await Promise.all([
    admin.from('cold_leads').select('id, business_name, contact_name, email, address, suburb, status').in('status', ['walkthrough', 'follow_up']).order('business_name'),
    db.from('clients').select('id, business_name, contact_name, contact_email, address, suburb, state, postcode, status').order('business_name'),
  ])
  const leads = ((lQ.error ? [] : lQ.data) || []).map((l: any) => ({
    id: l.id, company: l.business_name || '', name: l.contact_name || '', email: l.email || '',
    address: [l.address, l.suburb].filter(Boolean).join(', '),
  }))
  const clients = ((cQ.error ? [] : cQ.data) || []).map((c: any) => ({
    id: c.id, name: c.business_name || '', contact: c.contact_name || '', email: c.contact_email || '', status: c.status || 'active',
    address: [c.address || '', [c.suburb || '', c.address ? c.state || '' : '', c.address ? c.postcode || '' : ''].filter(Boolean).join(' ')].filter(Boolean).join(', '),
  }))
  return { leads, clients }
}

/** A client's details as an agreement made from their record shows them. */
export async function clientSnapFor(id: string, db: any = createClient()): Promise<ClientSnap | null> {
  const [cQ, sQ, vQ] = await Promise.all([
    db.from('clients').select('id, business_name, contact_name, contact_email, contact_phone, address, suburb, state, postcode, scope, scope_of_work').eq('id', id).maybeSingle(),
    db.from('client_sites').select('id, site_name, address, suburb, postcode, scope, scope_of_work, sort_order').eq('client_id', id).order('sort_order'),
    db.from('client_services').select('id, site_id, days, every, start_time, finish_time, price, access, sort_order').eq('client_id', id).order('sort_order'),
  ])
  if (cQ.error || !cQ.data) return null
  const c = cQ.data, sites = (sQ.data || []) as any[], svcs = (vQ.data || []) as any[]
  const ids = svcs.map(s => s.id)
  const aQ = ids.length ? await db.from('client_addons').select('service_id, freq, price').in('service_id', ids) : { data: [] }
  let monthly = 0
  for (const s of svcs) {
    monthly += (Number(s.price) || 0) * cleansPerMonth(s)
    for (const a of ((aQ.data || []) as any[]).filter(x => x.service_id === s.id)) monthly += ((Number(a.price) || 0) * (ADDON_PER_YEAR[a.freq as AddonFreq] ?? 0)) / 12
  }
  const siteName = new Map(sites.map(s => [s.id, s.site_name || '']))
  const multi = sites.length > 1
  const sched = svcs.map(s => (multi && s.site_id ? siteName.get(s.site_id) + ': ' : '') + (s.days || []).map((d: string) => DAYW[d] || d).join(', ')
    + (s.start_time ? ', ' + t12s(String(s.start_time).slice(0, 5)) + (s.finish_time ? ' to ' + t12s(String(s.finish_time).slice(0, 5)) : '') : '')).filter(Boolean).join('; ')
  const addr = [c.address, [c.suburb, c.state, c.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const premises = multi ? sites.map(s => s.site_name).filter(Boolean).join(', ') + (c.suburb ? ' (' + c.suburb + ')' : '') : addr || c.suburb || ''
  // Schedule 1: the first site's checklist (or the client's), each line with how often if it isn't every visit
  const boxes = (multi && sites[0] ? scopeBoxes(sites[0].scope, sites[0].scope_of_work) : []).length ? scopeBoxes(sites[0].scope, sites[0].scope_of_work) : scopeBoxes(c.scope, c.scope_of_work)
  const s0 = svcs[0] || {}
  return {
    name: c.business_name || '', contact: c.contact_name || '', email: c.contact_email || '', phone: c.contact_phone || '', address: addr, premises,
    days: s0.days || [], time: s0.start_time ? String(s0.start_time).slice(0, 5) : '', sched, monthlyEx: Math.round(monthly * 100) / 100, access: s0.access || '',
    scope: boxes.map(b => ({ heading: b.heading, items: b.items.map(it => it.text + (it.freq && it.freq !== 'Every visit' ? ' (' + it.freq.toLowerCase() + ')' : '')) })),
  }
}

export interface CFile { id: string; clientId: string; client: string; kind: string; fileName: string; created: string; mime: string }
export interface DocsData { agrs: Agr[]; files: CFile[]; clients: { id: string; name: string; email: string; firstClean: string | null }[] }

/** Agreements and files, and the clients to choose from. Null if the hub can't be reached. */
export async function loadDocs(db: any = createClient()): Promise<DocsData | null> {
  const [aQ, fQ, cQ, sQ] = await Promise.all([
    db.from('agreements').select(AGR_COLS).order('created_at', { ascending: false }),
    db.from('client_files').select('id, client_id, kind, file_name, created_on, mime').is('deleted_at', null).order('created_at', { ascending: false }),
    db.from('clients').select('id, business_name, contact_email, status').order('business_name'),
    db.from('client_services').select('client_id, first_clean'),
  ])
  if (aQ.error || fQ.error || cQ.error) return null
  const name = new Map<string, string>(((cQ.data || []) as any[]).map(c => [c.id, c.business_name || 'Client']))
  const first = new Map<string, string>()
  for (const s of ((sQ.error ? [] : sQ.data) || []) as any[]) { const f = d10(s.first_clean); if (f && (!first.has(s.client_id) || f < first.get(s.client_id)!)) first.set(s.client_id, f) }
  return {
    agrs: ((aQ.data || []) as any[]).map(agrOf),
    files: ((fQ.data || []) as any[]).map(f => ({ id: f.id, clientId: f.client_id, client: name.get(f.client_id) || 'Client', kind: f.kind, fileName: f.file_name, created: d10(f.created_on) || '', mime: f.mime })),
    clients: ((cQ.data || []) as any[]).filter(c => c.status !== 'ended').map(c => ({ id: c.id, name: c.business_name || 'Client', email: c.contact_email || '', firstClean: first.get(c.id) || null })),
  }
}

/** A specialist quote made from a current client's request: accepting books the works, nothing new to sign. */
export async function reqClientOf(db: any, p: Pick<Prop, 'ptype' | 'requestId' | 'clientId'>, today: string): Promise<any | null> {
  if (p.ptype !== 'spec' || !p.requestId || !p.clientId) return null
  const [rQ, cQ] = await Promise.all([
    db.from('client_requests').select('id').eq('id', p.requestId).maybeSingle(),
    db.from('clients').select('id, business_name, contact_name, status, paused_from, resume_on, ended_on').eq('id', p.clientId).maybeSingle(),
  ])
  if (!rQ.data || !cQ.data) return null
  return currentStatus(cQ.data, today) === 'ended' ? null : cQ.data
}


/** Open quote requests from clients' portals (for "Link to a client request" on a specialist proposal). */
export async function loadOpenQuoteReqs(db: any = createClient()): Promise<{ id: string; clientId: string; client: string; service: string; created: string }[]> {
  const { data, error } = await db.from('client_requests').select('id, client_id, service, created_at, clients(business_name)').eq('kind', 'quote').neq('status', 'done').order('created_at', { ascending: false }).limit(100)
  if (error) return []
  const bris = (ts: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(new Date(ts))
  return ((data || []) as any[]).map(r => ({ id: r.id, clientId: r.client_id, client: r.clients?.business_name || 'A client', service: r.service || 'another service', created: bris(r.created_at) }))
}

/** The ref the next new proposal will get (shown on the form; the real one is taken when it's saved). */
export async function peekQuoteRef(year: string): Promise<string> {
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const { data } = await (createAdminClient() as any).from('hub_counters').select('n').eq('key', 'comm_' + year).maybeSingle()
  return `CC-${year}-CCQ${String((Number(data?.n) || 0) + 1).padStart(3, '0')}`
}
