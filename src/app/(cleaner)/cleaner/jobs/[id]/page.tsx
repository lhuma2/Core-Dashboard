import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalShell } from '@/components/portal/PortalShell'
import { StartJobButton } from '@/components/portal/cleaner/StartJobButton'
import { FlagModal } from '@/components/portal/cleaner/FlagModal'
import { MapPin, Clock, Key, RefreshCw, ChevronRight } from 'lucide-react'
import Link from 'next/link'

function statusLabel(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    not_started: { label: 'Not Started',  cls: 'bg-gray-100 text-gray-500' },
    in_progress: { label: 'In Progress',  cls: 'bg-black text-white' },
    completed:   { label: 'Completed',    cls: 'bg-black text-white' },
    flagged:     { label: 'Flagged',      cls: 'bg-gray-900 text-white' },
  }
  return map[status] ?? map.not_started
}

export default async function CleanerJobPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const { data: job } = await (supabase as any)
    .from('job_assignments')
    .select('*, clients(id, business_name, address, suburb, state, postcode), client_sites(site_name, address, suburb, access_details)')
    .eq('id', params.id)
    .eq('cleaner_id', profile.id)
    .single()

  if (!job) notFound()

  const { data: submission } = await (supabase as any)
    .from('job_submissions')
    .select('*')
    .eq('job_id', params.id)
    .single()

  const client  = job.clients
  const site    = job.client_sites
  const status  = statusLabel(job.status)
  const checklist: { id: string; label: string; required?: boolean }[] = job.checklist ?? []

  // For a site-scoped job (multi-site client), everything the cleaner sees must be the SITE's
  // — its name, address and lockbox — never the parent client's head-office details.
  const displayName  = site?.site_name ? `${client?.business_name} — ${site.site_name}` : client?.business_name
  const addrLine     = site?.address
    ? [site.address, site.suburb].filter(Boolean).join(', ')
    : (client?.address ? [client.address, client.suburb].filter(Boolean).join(', ') : null)
  const accessNotes  = job.access_notes || site?.access_details || null

  const scheduledDate = new Date(job.scheduled_date + 'T00:00:00')
  const dateStr = scheduledDate.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  return (
    <PortalShell
      backHref="/cleaner/dashboard"
      backLabel="Jobs"
      userName={profile.full_name}
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-black tracking-tight">{displayName}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{dateStr}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full whitespace-nowrap ${status.cls}`}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-2xl divide-y divide-gray-100 mb-4">
        {addrLine && (
          <div className="flex items-start gap-3 px-5 py-4">
            <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Address</p>
              <p className="text-sm font-medium text-black">{addrLine}</p>
            </div>
          </div>
        )}
        {job.frequency_label && (
          <div className="flex items-start gap-3 px-5 py-4">
            <RefreshCw className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Frequency</p>
              <p className="text-sm font-medium text-black">{job.frequency_label}</p>
            </div>
          </div>
        )}
        {accessNotes && (
          <div className="flex items-start gap-3 px-5 py-4">
            <Key className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Access & Codes</p>
              <p className="text-sm font-medium text-black whitespace-pre-wrap">{accessNotes}</p>
            </div>
          </div>
        )}
        {submission?.started_at && (
          <div className="flex items-start gap-3 px-5 py-4">
            <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs text-gray-400 font-medium mb-0.5">Started</p>
              <p className="text-sm font-medium text-black">
                {new Date(submission.started_at).toLocaleTimeString('en-AU', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Checklist preview */}
      {checklist.length > 0 && (
        <div className="bg-white rounded-2xl px-5 py-4 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Checklist</p>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-3 text-sm text-gray-700">
                <span className="w-5 h-5 rounded border-2 border-gray-200 flex-shrink-0" />
                {item.label}
                {item.required && <span className="text-xs text-gray-400 ml-auto">Required</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3 mt-6">
        {job.status === 'not_started' && (
          <StartJobButton jobId={job.id} />
        )}

        {(job.status === 'in_progress' || job.status === 'not_started') && (
          <Link
            href={`/cleaner/jobs/${job.id}/submit`}
            className="flex items-center justify-center gap-2 w-full bg-black text-white font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all"
          >
            Complete Job
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}

        {job.status !== 'completed' && (
          <FlagModal jobId={job.id} clientId={client?.id ?? ''} />
        )}

        {job.status === 'completed' && (
          <div className="text-center py-4">
            <p className="text-sm font-medium text-black">✓ Job completed</p>
            {submission?.completed_at && (
              <p className="text-xs text-gray-400 mt-1">
                Submitted at {new Date(submission.completed_at).toLocaleTimeString('en-AU', {
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </div>
        )}
      </div>
    </PortalShell>
  )
}
