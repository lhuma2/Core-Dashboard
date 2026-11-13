import { redirect } from 'next/navigation'
import { clientMe } from '@/lib/clientapp/data'
import { ClientChangePw } from '@/components/clientapp/ClientChangePw'

export default async function ClientPasswordPage() {
  const me = await clientMe()
  if (!me) redirect('/client/login')
  return <ClientChangePw first={me.first} />
}
