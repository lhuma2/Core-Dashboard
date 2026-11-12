import Link from 'next/link'
import { Back } from '@/components/hub/icons'
import { HomeFormView } from '@/components/hub/HomeFormView'
import { loadCleaners, loadHome } from '@/lib/hub/homes-data'
import { brisbaneToday } from '@/lib/hub/figures'
import { homeNext } from '@/lib/hub/homes'

export const dynamic = 'force-dynamic'

export default async function EditHomePage({ params, searchParams }: { params: { id: string }; searchParams: { redate?: string } }) {
  const [r, cleaners] = await Promise.all([loadHome(params.id), loadCleaners()])
  const back = <Link className="back" href="/hub/residential/clients"><Back /> Residential</Link>
  if (r === null) return <>{back}<p className="err" role="alert">This client couldn’t load just now. Refresh the page to try again.</p></>
  if (r === 'missing') return <>{back}<p className="err" role="alert">That client was deleted.</p></>
  const { h } = r, today = brisbaneToday()
  const started = h.kind !== 'oneoff' && !!h.first_clean && h.first_clean <= today
  const nx = started ? homeNext({ ...h, status: 'active' }, today, 1)[0] || '' : h.first_clean || ''
  const first = searchParams.redate ? '' : started ? (h.every === 'weekly' ? '' : nx) : h.first_clean || ''
  return (
    <HomeFormView started={started} wasKind={h.kind} today={today} cleaners={cleaners} signed={r.docs.some(d => d.status === 'signed')}
      backHref={`/hub/residential/clients/${h.id}`} backLabel={h.name}
      initial={{
        id: h.id, kind: h.kind, name: h.name, phone: h.phone || '', email: h.email || '', street: h.street || '', suburb: h.suburb || '', postcode: h.postcode || '', state: h.state || 'QLD',
        beds: String(h.beds ?? 0), baths: String(h.baths ?? 0), carpetRooms: String(h.carpet_rooms || 0), hallways: String(h.hallways || 0),
        every: (h.every as any) || 'weekly', days: h.days || [], first, start: h.start_time || '', finish: h.finish_time || '', cleaner: h.cleaner_id || '',
        price: h.price ? String(h.price) : '', cost: h.cost ? String(h.cost) : '', notes: h.notes || '',
      }} />
  )
}
