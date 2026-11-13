import { redirect } from 'next/navigation'
import { crewMe } from '@/lib/crew/data'
import { CrewLogin } from '@/components/crew/CrewLogin'

export default async function CleanerLoginPage() {
  if (await crewMe()) redirect('/cleaner/app')
  return <CrewLogin />
}
