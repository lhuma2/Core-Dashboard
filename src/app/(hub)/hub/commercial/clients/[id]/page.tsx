import Link from 'next/link'
import { Back } from '@/components/hub/icons'
import { CommercialClientView } from '@/components/hub/CommercialClientView'
import { PhotoSection } from '@/components/hub/PhotoSection'
import { loadClientPage } from '@/lib/hub/client-page-data'
import { loadPhotos } from '@/lib/hub/photos-data'
import { brisbaneToday, clientRow } from '@/lib/hub/figures'
import { keepDays } from '@/lib/crew/jobs'
import { loadRequests } from '@/lib/hub/requests-data'

export const dynamic = 'force-dynamic'

export default async function CommercialClientPage({ params, searchParams }: { params: { id: string }; searchParams: { from?: string } }) {
  const r = await loadClientPage(params.id)
  const back = <Link className="back" href="/hub/commercial"><Back /> Clients</Link>
  if (r === null) return <>{back}<p className="err" role="alert">This client couldn’t load just now. Refresh the page to try again.</p></>
  if (r === 'missing') return <>{back}<p className="err" role="alert">That client isn’t in the hub any more.</p></>
  const today = brisbaneToday()
  const { c } = r
  const row = clientRow({
    id: c.id, name: c.name, suburb: c.suburb, status: c.status, paused_from: c.paused_from, resume_on: c.resume_on, ended_on: c.ended_on, sites: Math.max(1, c.services.length),
    services: c.services.map(s => ({ days: s.days, every: s.every, price: s.price, cost: s.cost, cleaners: [], addons: s.addons.map(a => ({ freq: a.freq, price: a.price, cost: a.cost })) })),
  }, today)
  const keep = keepDays('commercial')
  const [photos, requests] = await Promise.all([loadPhotos({ clientId: c.id, keep, fileName: c.name.replace(/[^A-Za-z0-9 -]/g, '').trim().replace(/\s+/g, '-') || 'clean' }), loadRequests(c.id)])
  return (
    <CommercialClientView c={c} cleaners={r.cleaners} problems={r.problems} history={r.history} today={today} from={searchParams.from} requests={requests || []}
      stats={{ mrr: row.mrr, margin: row.margin, health: row.health }}
      photos={<PhotoSection days={photos || []} failed={!photos} keep={keep} today={today} title="Completion photos" />} />
  )
}
