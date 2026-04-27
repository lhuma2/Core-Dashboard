export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalShell } from '@/components/portal/PortalShell'
import { StartCleanButton } from '@/components/portal/cleaner/StartCleanButton'
import { SubmitJobForm } from '@/components/portal/cleaner/SubmitJobForm'
import { FlagModal } from '@/components/portal/cleaner/FlagModal'
import { MapPin, Calendar, Key, ClipboardList, CheckCircle2 } from 'lucide-react'
import { getUpcomingDates } from '@/lib/schedule'

const FREQ_LABELS: Record<string, string> = {
  weekly:       'Weekly',
  fortnightly:  'Fortnightly',
  monthly:      'Monthly',
  twice_weekly: 'Twice weekly',
  three_weekly: '3x per week',
  four_weekly:  'Every 4 weeks',
  adhoc:        'Ad hoc',
}

const DAY_LABELS: Record<string, string> = {
  monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
  thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Australia/Brisbane',
  })
}

export default async function CleanerClientPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const { data: client } = await (supabase as any)
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .eq('assigned_cleaner_id', profile.id)
    .eq('assignment_accepted', true)
    .single()

  if (!client) notFound()

  // Check for an active job today
  const today = new Date().toISOString().split('T')[0]
  const { data: todayJob } = await (supabase as any)
    .from('job_assignments')
    .select('*, job_submissions(*)')
    .eq('client_id', params.id)
    .eq('cleaner_id', profile.id)
    .eq('scheduled_date', today)
    .single()

  const serviceDays: string[] = client.service_days ?? []
  const checklist = todayJob?.checklist ?? []

  // Get upcoming dates using the same schedule engine as the dashboard
  const upcomingDates = getUpcomingDates({
    id:            client.id,
    business_name: client.business_name,
    address:       client.address ?? null,
    suburb:        client.suburb ?? null,
    frequency:     client.frequency ?? null,
    service_days:  serviceDays,
    start_date:    client.start_date ?? null,
  }, 60).slice(0, 5)

  const isInProgress = todayJob?.status === 'in_progress' || todayJob?.status === 'flagged'
  const isCompleted  = todayJob?.status === 'completed'

  return (
    <PortalShell
      userName={profile.full_name}
      subtitle="Cleaner Portal"
      backHref="/cleaner/dashboard"
      backLabel="Dashboard"
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black tracking-tight">{client.business_name}</h1>
      </div>

      {/* Client details */}
      <div className="space-y-3 mb-6">
        {/* Upcoming cleans */}
        {upcomingDates.length > 0 && (
          <div className="bg-white rounded-2xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Upcoming Cleans</p>
            <div className="space-y-2">
              {upcomingDates.map((d, i) => (
                <div key={d.toISOString()} className="flex items-center gap-2">
                  {i === 0 && (
                    <span className="text-[10px] font-semibold bg-black text-white rounded-full px-2 py-0.5 flex-shrink-0">Next</span>
                  )}
                  <p className={`text-sm ${i === 0 ? 'font-semibold text-black' : 'text-gray-500'}`}>
                    {formatDate(d)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Address */}
        {(client.address || client.suburb) && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Address</p>
              <p className="text-sm font-semibold text-black">
                {[client.address, client.suburb].filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Frequency + cleaning days */}
        <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Schedule</p>
            <p className="text-sm font-semibold text-black">
              {FREQ_LABELS[client.frequency] ?? client.frequency ?? '—'}
            </p>
            {serviceDays.length > 0 && (
              <p className="text-sm text-gray-600 mt-0.5">
                {serviceDays.map((d) => DAY_LABELS[d.toLowerCase()] ?? d).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Access details */}
        {client.access_details && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <Key className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Access Details</p>
              <p className="text-sm text-black whitespace-pre-wrap">{client.access_details}</p>
            </div>
          </div>
        )}

        {/* Scope of work */}
        {client.scope_of_work && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <ClipboardList className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Scope of Work</p>
              <p className="text-sm text-black whitespace-pre-wrap">{client.scope_of_work}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Job section ── */}
      <div className="border-t border-gray-100 pt-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Today's Clean</p>

        {/* Completed — show summary + option to restart */}
        {isCompleted && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl px-5 py-5 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-black flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-black">Clean completed</p>
                <p className="text-xs text-gray-400 mt-0.5">Great work today.</p>
              </div>
            </div>
            <p className="text-xs text-gray-400">Need to go back on site?</p>
            <StartCleanButton
              clientId={params.id}
              address={client.address ?? null}
              suburb={client.suburb ?? null}
              label="Start Again"
            />
          </div>
        )}

        {/* In progress — show submit form */}
        {isInProgress && todayJob && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl px-5 py-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
              <p className="text-sm font-semibold text-black">Clean in progress</p>
            </div>
            <SubmitJobForm jobId={todayJob.id} checklist={checklist} />
            <FlagModal jobId={todayJob.id} clientId={params.id} />
          </div>
        )}

        {/* Not started */}
        {!todayJob && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">Tap below when you arrive on site.</p>
            <StartCleanButton
              clientId={params.id}
              address={client.address ?? null}
              suburb={client.suburb ?? null}
            />
          </div>
        )}
      </div>
    </PortalShell>
  )
}
