import { redirect } from 'next/navigation'
import { clientMe, loadPortal } from '@/lib/clientapp/data'
import { brisbaneHour } from '@/lib/hub/figures'
import { ClientHome } from '@/components/clientapp/ClientHome'

export default async function ClientHomePage({ searchParams }: { searchParams: { tab?: string } }) {
  const me = await clientMe()
  if (!me) redirect('/client/login')
  if (!me.welcomed) redirect('/client/app/welcome')
  const hour = brisbaneHour()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const data = await loadPortal(me)
  if (!data) return (
    <>
      <h1 className="greet">{greeting}, {me.first}</h1>
      <p className="sub">{me.biz}</p>
      <p className="ferr loaderr" role="alert">Your portal couldn’t load just now. Check your connection and refresh the page.</p>
    </>
  )
  return <ClientHome first={me.first} biz={me.biz} greeting={greeting} starterNag={!me.pwSet} data={data} initialTab={searchParams.tab || 'cleans'} />
}
