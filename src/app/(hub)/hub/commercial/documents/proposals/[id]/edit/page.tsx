import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProposalForm } from '@/components/hub/ProposalForm'
import { Back } from '@/components/hub/icons'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadFillFrom, loadOpenQuoteReqs, loadPresets, loadProp } from '@/lib/hub/documents-data'

export const dynamic = 'force-dynamic'

export default async function EditProposalPage({ params, searchParams }: { params: { id: string }; searchParams: { from?: string } }) {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound()
  const today = brisbaneToday()
  const [p, presets, fill, requests] = await Promise.all([loadProp(params.id), loadPresets(), loadFillFrom(), loadOpenQuoteReqs()])
  if (!p) notFound()
  const fromReq = searchParams.from === 'requests'
  const back = fromReq ? '/hub/commercial/requests' : '/hub/commercial/documents'
  if (p.status === 'accepted' || p.status === 'sent') {
    return (
      <>
        <Link className="back" href={back}><Back /> {fromReq ? 'Requests' : 'Documents'}</Link>
        <p className="err" role="alert">{p.status === 'accepted' ? `${p.ref} was accepted, so it can’t be changed.` : `${p.ref} is with the client. Wait for their reply, or Revise it if they ask for changes.`}</p>
      </>
    )
  }
  return (
    <ProposalForm initial={p} presets={presets} leads={fill.leads} clients={fill.clients} requests={requests} today={today}
      backHref={back} backLabel={fromReq ? 'Requests' : 'Documents'} heading={p.status === 'draft' ? 'Edit proposal' : `Revise ${p.ref}`} />
  )
}
