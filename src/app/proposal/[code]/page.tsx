import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProposalDoc } from '@/components/hub/ProposalDoc'
import { ProposalClientPanel } from '@/components/hub/ProposalClientPanel'
import { PrintButton } from '@/components/hub/PrintButton'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadProp, reqClientOf } from '@/lib/hub/documents-data'
import { dLong, isoAdd, propDoc } from '@/lib/hub/proposals'
import '../../(hub)/hub/hub.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your proposal from Core Cleaning', robots: { index: false, follow: false } }

// The client's own proposal page, opened from the link in their email. Matched by the proposal's private code.
export default async function ClientProposalPage({ params }: { params: { code: string } }) {
  const shell = (body: React.ReactNode) => (
    <div className="hub">
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/hub-logo-white.png" alt="Core Cleaning" />
      </header>
      <main className="wrap pubwrap">{body}</main>
    </div>
  )
  const bad = shell(<div className="addcard pubdone"><h1 className="nch">This proposal link isn’t valid</h1><p className="nchint">The link may be mistyped, or a newer copy of the proposal was sent. Please contact Core Cleaning on 0407 026 360 or admin@corecleaning.services for a fresh link.</p></div>)
  if (!/^[0-9a-f]{64}$/.test(params.code || '')) return bad
  const db = createAdminClient() as any
  const { data } = await db.from('proposals').select('id').eq('code', params.code).is('deleted_at', null).maybeSingle()
  if (!data) return bad
  const p = await loadProp(data.id, db)
  if (!p || p.status === 'draft') return bad
  const today = brisbaneToday()
  const rc = p.status === 'sent' || p.booked ? await reqClientOf(db, p, today) : null
  const expired = p.status === 'sent' && (!p.sentAt || isoAdd(p.sentAt, 30) < today)
  const dated = p.ptype === 'spec' && p.date2 && p.date2 >= today
  const hint = rc
    ? 'Accepting books the works. Your current agreement with Core Cleaning covers them, so there’s nothing new to sign.' + (dated ? ` Date: ${dLong(p.date2)}.` : '')
    : p.ptype === 'spec' ? 'Accepting takes you straight to a short works agreement, where you add your details and sign.' : 'Accepting takes you straight to your service agreement, where you add your details and sign.'

  let closed: React.ReactNode = null
  if (expired) closed = <p className="agstatus warn">This proposal has expired. Contact Core Cleaning on 0407 026 360 for an updated one.</p>
  else if (p.status === 'accepted') {
    const toSign = p.agr && p.agr.status === 'sent'
    closed = (
      <div className="addcard pacc">
        <h2 className="nch">You accepted this proposal</h2>
        <p className="nchint">{p.booked && p.worksDate ? `Thank you. The works are booked for ${dLong(p.worksDate)}.` : toSign ? 'Thank you. The last step is your agreement: add your details, read the terms and sign at the bottom.' : 'Thank you. Your agreement is signed.'}</p>
        {toSign && <div className="sheetbtns"><Link className="btn call" href={`/agreement/${p.agr!.code}`}>Sign your agreement</Link></div>}
      </div>
    )
  } else if (p.status === 'revision') closed = <p className="agstatus wait">You asked for a revised quote on {dLong(p.revisionAt)}. We’ll email you the new one.</p>
  else if (p.status === 'declined') closed = <p className="agstatus">You declined this proposal on {dLong(p.declinedAt)}. If anything changes, call us on 0407 026 360.</p>

  return shell(
    <>
      <div className="pdbar"><span /><div className="sheetbtns"><PrintButton /></div></div>
      <ProposalDoc d={propDoc(p, today, !!rc)} />
      <ProposalClientPanel code={params.code} hint={hint} needsDate={!!rc && !dated} minDate={today} closed={p.status === 'sent' && !expired ? null : closed || <span />} />
    </>
  )
}
