import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalShell } from '@/components/portal/PortalShell'
import { SubmitJobForm } from '@/components/portal/cleaner/SubmitJobForm'

export default async function SubmitJobPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const { data: job } = await (supabase as any)
    .from('job_assignments')
    .select('*, clients(id, business_name)')
    .eq('id', params.id)
    .eq('cleaner_id', profile.id)
    .single()

  if (!job) notFound()

  // Already submitted
  if (job.status === 'completed') {
    redirect(`/cleaner/jobs/${params.id}`)
  }

  const checklist: { id: string; label: string; required?: boolean }[] = job.checklist ?? []

  return (
    <PortalShell
      backHref={`/cleaner/jobs/${params.id}`}
      backLabel={job.clients?.business_name ?? 'Job'}
      userName={profile.full_name}
    >
      <div className="mb-6">
        <h1 className="text-xl font-bold text-black tracking-tight">Complete Job</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload photos, tick the checklist, then submit.
        </p>
      </div>

      <SubmitJobForm
        jobId={params.id}
        checklist={checklist}
      />
    </PortalShell>
  )
}
