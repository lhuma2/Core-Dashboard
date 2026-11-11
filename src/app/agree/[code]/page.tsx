import { createAdminClient } from '@/lib/supabase/admin'
import { AgreementBody } from '@/components/hub/AgreementBody'
import { AgreementClientPanel } from '@/components/hub/AgreementClientPanel'
import { dLong } from '@/lib/hub/home-quotes'
import { docOf, DOC_COLS } from '@/lib/hub/home-agreements'
import '../../(hub)/hub/hub.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your service agreement from Core Cleaning', robots: { index: false, follow: false } }

// The client's own signing page, opened from the email or straight after accepting their quote. Matched by the private code.
export default async function SignAgreementPage({ params, searchParams }: { params: { code: string }; searchParams: { from?: string } }) {
  const shell = (body: React.ReactNode) => (
    <div className="hub">
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/hub-logo-white.png" alt="Core Cleaning" />
      </header>
      <main className="wrap pubwrap">{body}</main>
    </div>
  )
  const bad = shell(<div className="addcard pubdone"><h1 className="nch">This agreement link isn’t valid</h1><p className="nchint">The link may be mistyped or the agreement was withdrawn. Please contact Core Cleaning on 0407 026 360 or admin@corecleaning.services for a fresh link.</p></div>)
  if (!/^[0-9a-f]{64}$/.test(params.code || '')) return bad
  const db = createAdminClient() as any
  const { data } = await db.from('home_docs').select(DOC_COLS).eq('code', params.code).maybeSingle()
  if (!data) return bad
  const d = docOf(data)
  if (d.status === 'draft' || !d.snap) return bad
  const signedOn = d.signedAt ? dLong(d.signedAt) : ''
  return shell(
    <AgreementClientPanel code={params.code} open={d.status === 'sent'} client={d.homeName} parts={d.snap.parts}
      banner={searchParams.from === 'quote' ? 'Thank you, your quote is accepted. The last step is your service agreement: read it and sign at the bottom.' : ''}
      closedText={d.status === 'signed' ? `Signed by ${d.signedBy} on ${signedOn}. Thank you.` : ''}>
      <AgreementBody ref_={d.ref} snap={d.snap} signedBy={d.signedBy} signedOn={signedOn} />
    </AgreementClientPanel>
  )
}
