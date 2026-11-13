import { createAdminClient } from '@/lib/supabase/admin'
import { PackForm } from '@/components/hub/PackForm'
import { brisbaneToday } from '@/lib/hub/figures'
import '../../(hub)/hub/hub.css'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your Core Cleaning subcontractor pack', robots: { index: false, follow: false } }

// The subcontractor pack a new cleaner opens from their email. Matched by the private link; no login.
export default async function PackPage({ params, searchParams }: { params: { token: string }; searchParams: { preview?: string } }) {
  const shell = (body: React.ReactNode) => (
    <div className="hub">
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/hub-logo-white.png" alt="Core Cleaning" />
      </header>
      <main className="wrap pubwrap">{body}</main>
    </div>
  )
  const bad = shell(<div className="addcard pubdone"><h1 className="nch">This link isn’t valid</h1><p className="nchint">The link may be mistyped, or it was replaced by a newer one. Please call Laith on 0407 026 360 or email admin@corecleaning.services for a fresh link.</p></div>)
  if (!/^[0-9a-f]{64}$/.test(params.token || '')) return bad
  const db = createAdminClient() as any
  const { data: k } = await db.from('cleaner_packs').select('first_name, last_name, phone, signed_at, signed_name, company').eq('token', params.token).maybeSingle()
  if (!k) return bad
  const signedOn = k.signed_at ? new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(k.signed_at)) : ''
  return shell(
    <PackForm token={params.token} first={k.first_name} name={`${k.first_name} ${k.last_name}`.trim()} phone={k.phone || ''} today={brisbaneToday()} preview={searchParams.preview === '1'}
      signed={k.signed_at ? { by: k.signed_name || '', on: signedOn, company: k.company || '' } : null} />
  )
}
