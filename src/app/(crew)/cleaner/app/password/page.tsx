import { redirect } from 'next/navigation'
import { crewMe } from '@/lib/crew/data'
import { CrewPassword } from '@/components/crew/CrewPassword'

export default async function CrewPasswordPage() {
  const me = await crewMe()
  if (!me) redirect('/cleaner/login')
  if (me.pwSet) redirect('/cleaner/app')
  return <CrewPassword first={me.first} />
}
