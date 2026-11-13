import { asDiv, divBase, divFromSlug, DIVN } from '@/lib/hub/div'
import Link from 'next/link'
import { Back } from '@/components/hub/icons'
import { HomeView } from '@/components/hub/HomeView'
import { loadCleaners, loadHome } from '@/lib/hub/homes-data'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadPhotos } from '@/lib/hub/photos-data'
import { keepDays } from '@/lib/crew/jobs'
import { PhotoSection } from '@/components/hub/PhotoSection'

export const dynamic = 'force-dynamic'

export default async function HomePage({ params, searchParams }: { params: { id: string; div: string }; searchParams: { from?: string } }) {
  const div = asDiv(divFromSlug(params.div)), base = divBase(div)
  const [r, cleaners] = await Promise.all([loadHome(params.id, div), loadCleaners()])
  const back = <Link className="back" href={base + '/clients'}><Back /> {DIVN[div]}</Link>
  if (r === null) return <>{back}<p className="err" role="alert">This client couldn’t load just now. Refresh the page to try again.</p></>
  if (r === 'missing') return <>{back}<p className="err" role="alert">That client was deleted.</p></>
  const keep = keepDays(r.h.division === 'eol' ? 'eol' : 'res')
  const photos = await loadPhotos({ homeId: r.h.id, keep, fileName: r.h.name.replace(/[^A-Za-z0-9 -]/g, '').trim().replace(/\s+/g, '-') || 'clean' })
  const today = brisbaneToday()
  return (
    <HomeView h={r.h} history={r.history} docs={r.docs} cleaners={cleaners} today={today} from={searchParams.from}
      photos={<PhotoSection days={photos || []} failed={!photos} keep={keep} today={today} title={r.h.division === 'eol' ? 'Exit photos' : 'Completion photos'} />} />
  )
}
