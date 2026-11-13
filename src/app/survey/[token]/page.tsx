import { PubShell, BadLink } from '@/components/hub/PubShell'
import { SurveyForm } from '@/components/hub/SurveyForm'
import { createAdminClient } from '@/lib/supabase/admin'
import { svFirstName } from '@/lib/hub/surveys'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'How are we going? Core Cleaning', robots: { index: false, follow: false } }

// The survey a commercial client opens from the email. The private link is the key and works once.
export default async function SurveyPage({ params }: { params: { token: string } }) {
  const token = String(params.token || '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(token)) return <PubShell><BadLink what="survey" /></PubShell>
  const db = createAdminClient() as any
  const { data: s, error } = await db.from('client_surveys').select('id, answered_at, clients(business_name, contact_name)').eq('token', token).maybeSingle()
  if (error) return <PubShell><div className="addcard pubdone"><h1 className="nch">This page didn’t load</h1><p className="nchint">Check your connection and refresh the page. If it keeps happening, call Laith on 0407 026 360.</p></div></PubShell>
  if (!s) return <PubShell><BadLink what="survey" /></PubShell>
  const first = svFirstName(s.clients?.contact_name || '')
  if (s.answered_at) return (
    <PubShell>
      <div className="addcard pubdone"><h1 className="nch">Thanks, already received</h1><p className="nchint">We’ve already got your answers to this survey. If anything needs sorting, call Laith on 0407 026 360.</p></div>
    </PubShell>
  )
  return <PubShell><SurveyForm client={s.clients?.business_name || 'Your business'} first={first} token={token} /></PubShell>
}
