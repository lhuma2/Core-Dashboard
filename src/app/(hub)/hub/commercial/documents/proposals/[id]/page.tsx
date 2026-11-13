import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Back } from '@/components/hub/icons'
import { ProposalDoc } from '@/components/hub/ProposalDoc'
import { PrintButton } from '@/components/hub/PrintButton'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadProp, reqClientOf } from '@/lib/hub/documents-data'
import { createClient } from '@/lib/supabase/server'
import { dLong, propDoc, type Prop } from '@/lib/hub/proposals'

export const dynamic = 'force-dynamic'

function status(p: Prop): [string, string] {
  switch (p.status) {
    case 'draft': return ['Draft. Check it, then send it from the Proposals list.', 'agstatus']
    case 'sent': return [`Sent to ${p.sentTo} on ${dLong(p.sentAt)}. Waiting for their reply.`, 'agstatus wait']
    case 'accepted': return [(p.acceptedBy ? `Accepted by ${p.acceptedBy}` : 'Accepted') + ` on ${dLong(p.acceptedAt)}.` + (p.booked && p.worksDate ? ` Works booked for ${dLong(p.worksDate)}.` : p.agr && p.agr.status !== 'signed' ? ' Waiting for them to sign the agreement.' : ''), 'agstatus ok']
    case 'revision': return [`They asked for a revised quote on ${dLong(p.revisionAt)}: “${p.revisionNote}”. Press Revise on the list to change it and send it again.`, 'agstatus warn']
    default: return [`Declined on ${dLong(p.declinedAt)}.` + (p.reason ? ` Reason: ${p.reason}.` : ''), 'agstatus warn']
  }
}

export default async function ProposalPreviewPage({ params, searchParams }: { params: { id: string }; searchParams: { from?: string } }) {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) notFound()
  const db = createClient() as any
  const p = await loadProp(params.id, db)
  if (!p) notFound()
  const today = brisbaneToday()
  const rc = await reqClientOf(db, p, today)
  const fromReq = searchParams.from === 'requests'
  const [msg, cls] = status(p)
  return (
    <>
      <Link className="back" href={fromReq ? '/hub/commercial/requests' : '/hub/commercial/documents'}><Back /> {fromReq ? 'Requests' : 'Documents'}</Link>
      <div className="pdbar">
        <p className={cls}>{msg}</p>
        <div className="sheetbtns">
          {p.status === 'draft' && <Link className="btn log" href={`/hub/commercial/documents/proposals/${p.id}/edit${fromReq ? '?from=requests' : ''}`}>Edit</Link>}
          <PrintButton />
        </div>
      </div>
      <ProposalDoc d={propDoc(p, today, !!rc)} />
    </>
  )
}
