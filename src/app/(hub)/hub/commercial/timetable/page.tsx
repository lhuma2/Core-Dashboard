import { CommercialHead } from '@/components/hub/CommercialHead'
import { Timetable } from '@/components/hub/Timetable'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadCommercial } from '@/lib/hub/commercial-data'

export const dynamic = 'force-dynamic'

export default async function TimetablePage() {
  const today = brisbaneToday()
  const data = await loadCommercial(today)
  return (
    <>
      <CommercialHead tab="timetable" />
      {data
        ? <Timetable services={data.services} today={today} />
        : <p className="err" role="alert">The timetable couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
