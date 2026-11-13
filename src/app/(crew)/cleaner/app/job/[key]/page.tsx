import Link from 'next/link'
import { redirect } from 'next/navigation'
import { crewMe, loadCrewJob, loadJobPhotoIds } from '@/lib/crew/data'
import { brisbaneToday } from '@/lib/hub/figures'
import { CrewJobView } from '@/components/crew/CrewJobView'

export default async function CrewJobPage({ params }: { params: { key: string } }) {
  const me = await crewMe()
  if (!me) redirect('/cleaner/login')
  if (!me.pwSet) redirect('/cleaner/app/password')
  const job = await loadCrewJob(me, decodeURIComponent(params.key))
  if (!job || job === 'missing') return (
    <>
      <Link className="back" href="/cleaner/app">My jobs</Link>
      <p className="ferr loaderr" role="alert">{job === 'missing' ? 'This clean isn’t on your list any more. Go back to My jobs.' : 'This job couldn’t load just now. Check your signal and try again.'}</p>
    </>
  )
  const photos = await loadJobPhotoIds(job.jobId)
  return <CrewJobView job={job} today={brisbaneToday()} me={me.name} serverPhotos={photos} />
}
