import { asDiv, divBase, divFromSlug, DIVN } from '@/lib/hub/div'
import Link from 'next/link'
import { Back } from '@/components/hub/icons'
import { HomeView } from '@/components/hub/HomeView'
import { loadCleaners, loadHome } from '@/lib/hub/homes-data'
import { brisbaneToday } from '@/lib/hub/figures'

export const dynamic = 'force-dynamic'

export default async function HomePage({ params, searchParams }: { params: { id: string; div: string }; searchParams: { from?: string } }) {
  const div = asDiv(divFromSlug(params.div)), base = divBase(div)
  const [r, cleaners] = await Promise.all([loadHome(params.id, div), loadCleaners()])
  const back = <Link className="back" href={base + '/clients'}><Back /> {DIVN[div]}</Link>
  if (r === null) return <>{back}<p className="err" role="alert">This client couldn’t load just now. Refresh the page to try again.</p></>
  if (r === 'missing') return <>{back}<p className="err" role="alert">That client was deleted.</p></>
  return <HomeView h={r.h} history={r.history} docs={r.docs} cleaners={cleaners} today={brisbaneToday()} from={searchParams.from} />
}
