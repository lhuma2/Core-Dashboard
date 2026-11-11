import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Back, Building } from '@/components/hub/icons'
import { ClientList } from '@/components/hub/ClientList'
import { brisbaneToday, clientRow, type ListClient } from '@/lib/hub/figures'

export const dynamic = 'force-dynamic'

export default async function CommercialPage({ searchParams }: { searchParams: { show?: string; q?: string } }) {
  const supabase = createClient() as any
  const today = brisbaneToday()
  const [clientsQ, sitesQ, servicesQ, addonsQ, crewQ] = await Promise.all([
    supabase.from('clients').select('id, business_name, suburb, status, paused_from, resume_on, ended_on').order('business_name'),
    supabase.from('client_sites').select('id, client_id'),
    supabase.from('client_services').select('id, client_id, sort_order, days, every, price, cost').order('sort_order'),
    supabase.from('client_addons').select('service_id, freq, price, cost'),
    supabase.from('client_service_cleaners').select('service_id, cleaner:profiles(id, full_name)'),
  ])
  const failed = [clientsQ, sitesQ, servicesQ, addonsQ, crewQ].find(q => q.error)

  let rows: ReturnType<typeof clientRow>[] = []
  if (!failed) {
    const group = <T,>(list: T[], key: (x: T) => string) => {
      const m = new Map<string, T[]>()
      for (const x of list) m.set(key(x), [...(m.get(key(x)) ?? []), x])
      return m
    }
    const sitesBy = group<any>(sitesQ.data, s => s.client_id)
    const servicesBy = group<any>(servicesQ.data, s => s.client_id)
    const addonsBy = group<any>(addonsQ.data, a => a.service_id)
    const crewBy = group<any>(crewQ.data.filter((x: any) => x.cleaner), x => x.service_id)
    rows = clientsQ.data.map((c: any) => clientRow({
      id: c.id,
      name: c.business_name ?? 'Unnamed client',
      suburb: c.suburb ?? '',
      status: c.status, paused_from: c.paused_from, resume_on: c.resume_on, ended_on: c.ended_on,
      sites: Math.max(1, sitesBy.get(c.id)?.length ?? 0),
      services: (servicesBy.get(c.id) ?? []).map((s: any) => ({
        days: s.days ?? [], every: s.every, price: Number(s.price), cost: Number(s.cost),
        cleaners: (crewBy.get(s.id) ?? []).map((x: any) => ({ id: x.cleaner.id, name: x.cleaner.full_name ?? '' })),
        addons: (addonsBy.get(s.id) ?? []).map((a: any) => ({ freq: a.freq, price: Number(a.price), cost: Number(a.cost) })),
      })),
    } satisfies ListClient, today))
  }

  const show = searchParams.show === 'paused' || searchParams.show === 'ended' ? searchParams.show : 'active'
  return (
    <>
      <Link className="back" href="/hub"><Back /> Dashboard</Link>
      <div className="phead">
        <span className="icon" style={{ background: '#e3f3ec', color: '#0f6e50' }}><Building /></span>
        <h1 className="greet">Commercial</h1>
      </div>
      <nav className="tabs" aria-label="Commercial sections">
        <Link className="tab on" aria-current="page" href="/hub/commercial">Clients</Link>
      </nav>
      {failed
        ? <p className="err" role="alert">The clients couldn’t load just now. Refresh the page to try again.</p>
        : <ClientList rows={rows} initial={show} initialQuery={searchParams.q ?? ''} />}
    </>
  )
}
