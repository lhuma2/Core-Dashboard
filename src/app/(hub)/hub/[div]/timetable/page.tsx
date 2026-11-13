import { asDiv, divBase, divFromSlug, DIVN } from '@/lib/hub/div'
import { ResidentialHead } from '@/components/hub/ResidentialHead'
import { HomeTimetable } from '@/components/hub/HomeTimetable'
import { loadCleaners, loadHomes } from '@/lib/hub/homes-data'
import { loadQuotes, toDoCount } from '@/lib/hub/quotes-data'
import { brisbaneToday } from '@/lib/hub/figures'

export const dynamic = 'force-dynamic'

export default async function ResidentialTimetablePage({ params }: { params: { div: string } }) {
  const div = asDiv(divFromSlug(params.div)), base = divBase(div)
  const [homes, cleaners, quotes] = await Promise.all([loadHomes(div), loadCleaners(), loadQuotes(div)])
  return (
    <>
      <ResidentialHead div={div} tab="timetable" quotesToDo={quotes ? toDoCount(quotes) : 0} />
      {homes
        ? <HomeTimetable homes={homes} cleaners={cleaners.map(c => ({ id: c.id, name: c.name }))} today={brisbaneToday()} />
        : <p className="err" role="alert">The timetable couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
