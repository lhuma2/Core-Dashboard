import { redirect } from 'next/navigation'
import { clientMe } from '@/lib/clientapp/data'
import { ClientLogin } from '@/components/clientapp/ClientLogin'

export default async function ClientLoginPage() {
  if (await clientMe()) redirect('/client/app')
  return <ClientLogin />
}
