import { redirect } from 'next/navigation'
import { clientMe } from '@/lib/clientapp/data'
import { ClientWelcome } from '@/components/clientapp/ClientWelcome'

export default async function ClientWelcomePage() {
  const me = await clientMe()
  if (!me) redirect('/client/login')
  if (me.welcomed) redirect('/client/app')
  return <ClientWelcome first={me.first} biz={me.biz} email={me.email} />
}
