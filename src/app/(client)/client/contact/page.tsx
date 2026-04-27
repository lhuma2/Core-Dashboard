export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientShell } from '@/components/portal/ClientShell'
import { ContactForms } from '@/components/portal/client/ContactForms'
import { MessageCircle } from 'lucide-react'

export default async function ClientContactPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const clientId = profile.linked_client_id

  if (!clientId) {
    return (
      <ClientShell userName={profile?.full_name} activePath="/client/contact">
        <div className="text-center py-20">
          <p className="text-gray-500 text-sm">Your account is not linked to a client. Contact Delta Cleaning.</p>
        </div>
      </ClientShell>
    )
  }

  const { data: client } = await (supabase as any)
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()

  // Fetch last 7 completed job submissions for this client (for the service date dropdown)
  const { data: recentJobsRaw } = await (supabase as any)
    .from('job_assignments')
    .select('id, scheduled_date, job_submissions(completed_at)')
    .eq('client_id', clientId)
    .eq('status', 'completed')
    .order('scheduled_date', { ascending: false })
    .limit(7)

  // Flatten into a simple array the form can use
  const recentJobs = (recentJobsRaw ?? []).map((job: any) => {
    const sub = Array.isArray(job.job_submissions)
      ? job.job_submissions[0]
      : job.job_submissions
    return {
      id:             job.id,
      scheduled_date: job.scheduled_date,
      completed_at:   sub?.completed_at ?? null,
    }
  })

  return (
    <ClientShell
      clientName={client?.business_name}
      userName={profile.full_name}
      activePath="/client/contact"
    >
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <MessageCircle className="w-6 h-6 text-black" />
          <h1 className="text-3xl font-bold text-black tracking-tight">Contact & Support</h1>
        </div>
        <p className="text-gray-500 text-sm">Report an issue or share feedback with the Delta Cleaning team.</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-2xl p-8 border border-gray-100">
          <ContactForms clientId={clientId} recentJobs={recentJobs} />
        </div>
      </div>
    </ClientShell>
  )
}
