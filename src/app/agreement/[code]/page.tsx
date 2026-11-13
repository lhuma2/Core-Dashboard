import { createAdminClient } from '@/lib/supabase/admin'
import { AgreementDoc, DetailsBlock, SignedBlock } from '@/components/hub/AgreementDoc'
import { AgreementSignForm } from '@/components/hub/AgreementSignForm'
import { PrintButton } from '@/components/hub/PrintButton'
import { brisbaneToday } from '@/lib/hub/figures'
import { AGR_COLS, agView, agrOf, detailsList, dLong, signPrefill } from '@/lib/hub/proposals'
import '../../(hub)/hub/hub.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your agreement with Core Cleaning', robots: { index: false, follow: false } }

// The client's signing page, opened from the link in their email (or straight after accepting a proposal). Matched by
// the agreement's private code. Once signed, the same link shows the signed copy to view or download.
export default async function ClientAgreementPage({ params, searchParams }: { params: { code: string }; searchParams: { from?: string; print?: string } }) {
  const shell = (body: React.ReactNode) => (
    <div className="hub">
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/hub-logo-white.png" alt="Core Cleaning" />
      </header>
      <main className="wrap pubwrap">{body}</main>
    </div>
  )
  const bad = shell(<div className="addcard pubdone"><h1 className="nch">This agreement link isn’t valid</h1><p className="nchint">The link may be mistyped, or a newer link was sent. Please contact Core Cleaning on 0407 026 360 or admin@corecleaning.services for a fresh one.</p></div>)
  if (!/^[0-9a-f]{64}$/.test(params.code || '')) return bad
  const { data } = await (createAdminClient() as any).from('agreements').select(AGR_COLS).eq('code', params.code).maybeSingle()
  if (!data) return bad
  const d = agrOf(data)
  if (d.status === 'draft') return bad
  const today = brisbaneToday()
  if (d.status === 'sent') return shell(<AgreementSignForm d={d} today={today} initial={signPrefill(d, today)} justAccepted={searchParams.from === 'proposal'} />)
  const det = d.details
  const v = agView(d, today, det)
  return shell(
    <>
      <div className="pdbar"><p className="agstatus ok">Signed by {d.signedBy} on {dLong(d.signedAt)}.</p><div className="sheetbtns"><PrintButton auto={searchParams.print === '1'} /></div></div>
      <AgreementDoc v={{ ...v, coverSub: v.coverSub.replace(' Add your details, read the terms and sign at the end.', '') }} detailsTitle="Client details"
        details={<DetailsBlock list={detailsList(det)} />}
        signatures={<SignedBlock biz={d.client} date={v.date} signedBy={d.signedBy} role={[det?.name, det?.position].filter(Boolean).join(', ')} signedOn={dLong(d.signedAt)} />} />
    </>
  )
}
