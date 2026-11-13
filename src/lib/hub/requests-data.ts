import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { HubRequest } from './requests'
import { shortName } from './figures'

const d10 = (v: any) => (v ? String(v).slice(0, 10) : null)
const bris = (ts: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Brisbane' }).format(new Date(ts))

/** Client requests, newest first (one client's, or everyone's), read as the signed-in admin. Null if the hub can't
 *  be reached; an empty list before the requests table exists. */
export async function loadRequests(clientId?: string): Promise<HubRequest[] | null> {
  const db = createClient() as any
  let q = db.from('client_requests').select('id, client_id, kind, site_id, all_sites, service, job_id, clean_label, want_date, details, status, reply, replied_at, created_at').order('created_at', { ascending: false }).limit(300)
  if (clientId) q = q.eq('client_id', clientId)
  const rq = await q
  if (rq.error) return /client_requests/.test(String(rq.error.message || '')) ? [] : null
  const rows: any[] = rq.data || []
  if (!rows.length) return []
  const cids = Array.from(new Set(rows.map(r => r.client_id)))
  const [cQ, sQ, svQ, oQ, jQ] = await Promise.all([
    db.from('clients').select('id, business_name, is_multi_site').in('id', cids),
    db.from('client_sites').select('id, client_id, site_name').in('client_id', cids),
    db.from('client_services').select('id, client_id, site_id, sort_order, start_time, price').in('client_id', cids).order('sort_order'),
    db.from('one_offs').select('request_id, clean_date, start_time').in('request_id', rows.map(r => r.id)),
    db.from('jobs').select('id, clean_date').in('id', rows.map(r => r.job_id).filter(Boolean).concat(['00000000-0000-0000-0000-000000000000'])),
  ])
  if (cQ.error || sQ.error || svQ.error) return null
  const svIds = (svQ.data || []).map((s: any) => s.id)
  const crewQ = svIds.length ? await db.from('client_service_cleaners').select('service_id, cleaner:profiles(full_name)').in('service_id', svIds) : { data: [] }
  const client = new Map<string, any>((cQ.data || []).map((c: any) => [c.id, c]))
  const sites: any[] = sQ.data || []
  const multi = (cid: string) => !!client.get(cid)?.is_multi_site || sites.filter(s => s.client_id === cid).length > 1
  return rows.map(r => {
    const svcs = ((svQ.data || []) as any[]).filter(s => s.client_id === r.client_id)
    const sv = (r.site_id && svcs.find(s => s.site_id === r.site_id)) || svcs[0] || null
    const one = ((oQ.error ? [] : oQ.data || []) as any[]).find(o => o.request_id === r.id)
    const siteName = r.all_sites ? 'All sites' : r.site_id && multi(r.client_id) ? sites.find(s => s.id === r.site_id)?.site_name || '' : ''
    return {
      id: r.id, clientId: r.client_id, client: client.get(r.client_id)?.business_name || 'A client', kind: r.kind, service: r.service || '', site: siteName,
      cleanDate: d10(((jQ.data || []) as any[]).find(j => j.id === r.job_id)?.clean_date), wantDate: d10(r.want_date), created: bris(r.created_at), detail: r.details || '',
      reply: r.reply || '', repliedAt: r.replied_at ? bris(r.replied_at) : null, status: r.status,
      booked: one ? { date: d10(one.clean_date)!, start: String(one.start_time || '').slice(0, 5) } : null,
      svc: sv ? { id: sv.id, start: String(sv.start_time || '').slice(0, 5), price: Number(sv.price) || 0, cleaners: ((crewQ.data || []) as any[]).filter(x => x.service_id === sv.id && x.cleaner?.full_name).map(x => shortName(String(x.cleaner.full_name))) } : null,
    }
  })
}

/** How many requests need Laith (New). */
export async function requestsNeedingYou(): Promise<number> {
  const db = createClient() as any
  const { count, error } = await db.from('client_requests').select('id', { count: 'exact', head: true }).eq('status', 'new')
  return error ? 0 : count || 0
}
