import { CommercialHead } from '@/components/hub/CommercialHead'
import { SurveyList, type SvF } from '@/components/hub/SurveyList'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadSurveys, surveysNeedingYouOf } from '@/lib/hub/surveys-data'
import { svDue } from '@/lib/hub/surveys'

export const dynamic = 'force-dynamic'

const FS: SvF[] = ['due', 'answers', 'waiting', 'schedule']

/** Commercial → Surveys. Opens on To send when anything is due, otherwise Answers (mock-up openSurveys). */
export default async function SurveysPage({ searchParams }: { searchParams: { f?: string; q?: string; note?: string } }) {
  const all = await loadSurveys()
  const today = brisbaneToday()
  const anyDue = !!all && all.clients.some(c => svDue(c, all.surveys, today))
  const f = FS.includes(searchParams.f as SvF) ? (searchParams.f as SvF) : anyDue ? 'due' : 'answers'
  return (
    <>
      <CommercialHead tab="surveys" surveys={all ? surveysNeedingYouOf(all, today) : 0} />
      {all
        ? <SurveyList clients={all.clients} surveys={all.surveys} today={today} initial={f} initialQuery={searchParams.q ?? ''} note={searchParams.note === 'preview' ? 'preview' : ''} />
        : <p className="err" role="alert">The surveys couldn’t load just now. Refresh the page to try again.</p>}
    </>
  )
}
