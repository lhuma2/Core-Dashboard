import { redirect } from 'next/navigation'
import { crewMe, loadCrewJobs } from '@/lib/crew/data'
import { brisbaneHour, brisbaneToday } from '@/lib/hub/figures'
import { CrewHome } from '@/components/crew/CrewHome'

export default async function CrewHomePage() {
  const me = await crewMe()
  if (!me) redirect('/cleaner/login')
  if (!me.pwSet) redirect('/cleaner/app/password')
  const today = brisbaneToday()
  const jobs = await loadCrewJobs(me, today, 7)
  const hour = brisbaneHour()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  if (!jobs) return (
    <>
      <h1 className="greet">{greeting}, {me.first}</h1>
      <p className="ferr loaderr" role="alert">Your jobs couldn’t load just now. Check your signal and pull down to refresh.</p>
    </>
  )
  return <CrewHome me={me.name} first={me.first} today={today} greeting={greeting} jobs={jobs} />
}
