import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { clientRow, shortName, type ClientRow } from './figures'
import type { TtService } from './timetable'

/** Commercial clients with their sites, services, add-ons and cleaners, read live as the signed-in admin (RLS on). */
export async function loadCommercial(today: string): Promise<{ rows: ClientRow[]; services: TtService[] } | null> {
  const supabase = createClient() as any
  const [clientsQ, sitesQ, servicesQ, addonsQ, crewQ] = await Promise.all([
    supabase.from('clients').select('id, business_name, suburb, status, paused_from, resume_on, ended_on, created_at').order('business_name'),
    supabase.from('client_sites').select('id, client_id, site_name, sort_order').order('sort_order'),
    supabase.from('client_services').select('id, client_id, site_id, sort_order, days, every, anchor, first_clean, start_time, finish_time, price, cost').order('sort_order'),
    supabase.from('client_addons').select('service_id, freq, price, cost'),
    supabase.from('client_service_cleaners').select('service_id, cleaner:profiles(id, full_name)'),
  ])
  const oneQ = await supabase.from('one_offs').select('service_id, clean_date, start_time, finish_time')
  const ones: any[] = oneQ.error ? [] : oneQ.data || []
  if ([clientsQ, sitesQ, servicesQ, addonsQ, crewQ].some(q => q.error)) return null

  const group = <T,>(list: T[], key: (x: T) => string) => {
    const m = new Map<string, T[]>()
    for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x])
    return m
  }
  const sitesBy = group<any>(sitesQ.data, s => s.client_id)
  const siteName = new Map<string, string>(sitesQ.data.map((s: any) => [s.id, s.site_name ?? '']))
  const servicesBy = group<any>(servicesQ.data, s => s.client_id)
  const addonsBy = group<any>(addonsQ.data, a => a.service_id)
  const crewBy = group<any>(crewQ.data.filter((x: any) => x.cleaner), x => x.service_id)
  const crew = (sid: string) => (crewBy.get(sid) ?? []).map((x: any) => ({ id: x.cleaner.id as string, name: (x.cleaner.full_name ?? '') as string }))

  const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)
  const rows: ClientRow[] = []
  const services: TtService[] = []
  // Colours follow the order clients were added, so a client keeps its colour when others are added.
  const colourOrder = [...clientsQ.data].sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id)))
  const colour = new Map<string, number>(colourOrder.map((c: any, i: number) => [c.id, i % 6]))

  for (const c of clientsQ.data) {
    const svcs = servicesBy.get(c.id) ?? []
    const nSites = sitesBy.get(c.id)?.length ?? 0
    rows.push(clientRow({
      id: c.id, name: c.business_name ?? 'Unnamed client', suburb: c.suburb ?? '',
      status: c.status, paused_from: day(c.paused_from), resume_on: day(c.resume_on), ended_on: day(c.ended_on),
      sites: Math.max(1, nSites),
      services: svcs.map((s: any) => ({
        days: s.days ?? [], every: s.every, price: Number(s.price), cost: Number(s.cost), cleaners: crew(s.id),
        addons: (addonsBy.get(s.id) ?? []).map((a: any) => ({ freq: a.freq, price: Number(a.price), cost: Number(a.cost) })),
      })),
    }, today))
    for (const s of svcs) {
      const names = crew(s.id).map(k => shortName(k.name)).filter(Boolean)
      services.push({
        key: s.id, clientId: c.id, client: c.business_name ?? 'Unnamed client', colour: colour.get(c.id) ?? 0,
        site: nSites > 1 && s.site_id ? siteName.get(s.site_id) ?? '' : '',
        days: s.days ?? [], every: s.every, anchor: day(s.anchor), first: day(s.first_clean),
        start: (s.start_time ?? '').slice(0, 5), finish: (s.finish_time ?? '').slice(0, 5),
        cleaners: names.length ? names.join(', ') : 'Unassigned',
        status: c.status, paused_from: day(c.paused_from), resume_on: day(c.resume_on), ended_on: day(c.ended_on),
        extras: ones.filter(o => o.service_id === s.id).map(o => ({ iso: day(o.clean_date) || '', start: (o.start_time ?? '').slice(0, 5), finish: (o.finish_time ?? '').slice(0, 5) })),
      })
    }
  }
  return { rows, services }
}
