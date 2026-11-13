import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { Back } from '@/components/hub/icons'
import { SurveyForm } from '@/components/hub/SurveyForm'
import { loadSurveys } from '@/lib/hub/surveys-data'
import { svFirstName } from '@/lib/hub/surveys'

export const dynamic = 'force-dynamic'

/** The client's survey page, read-only in the hub (Preview survey, Open their survey). Nothing is saved from here. */
export default async function SurveyPreviewPage({ params, searchParams }: { params: { client: string }; searchParams: { from?: string; s?: string } }) {
  if (!z.string().uuid().safeParse(params.client).success) notFound()
  const all = await loadSurveys()
  if (!all) return <p className="err" role="alert">The survey couldn’t load just now. Refresh the page to try again.</p>
  const c = all.clients.find(x => x.id === params.client)
  if (!c) notFound()
  const from = ['due', 'answers', 'waiting', 'schedule'].includes(searchParams.from || '') ? searchParams.from! : 'schedule'
  const back = `/hub/commercial/surveys?f=${from}`
  return (
    <>
      <Link className="back" href={back}><Back /> Surveys</Link>
      <p className="rqline svbanner">Preview of what {c.name} sees from the email link. Nothing is saved from a preview.</p>
      <SurveyForm client={c.name} first={svFirstName(c.contact)} previewBack={back + '&note=preview'} />
    </>
  )
}
