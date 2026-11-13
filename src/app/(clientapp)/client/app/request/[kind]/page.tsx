import { redirect } from 'next/navigation'
import { clientMe, loadPortal } from '@/lib/clientapp/data'
import { rqDef } from '@/lib/clientapp/portal'
import { brisbaneToday } from '@/lib/hub/figures'
import { ClientRequestForm } from '@/components/clientapp/ClientRequestForm'

export default async function ClientRequestPage({ params }: { params: { kind: string } }) {
  const me = await clientMe()
  if (!me) redirect('/client/login')
  const t = rqDef(params.kind)
  if (!t) redirect('/client/app?tab=requests')
  const data = await loadPortal(me)
  if (!data) return <p className="ferr loaderr" role="alert">This page couldn’t load just now. Check your connection and refresh the page.</p>
  return <ClientRequestForm t={t} sites={data.sites} recent={data.recent} today={brisbaneToday()} />
}
