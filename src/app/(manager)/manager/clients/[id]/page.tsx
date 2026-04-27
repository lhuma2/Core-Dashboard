import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { AssignCleanerDropdown } from '@/components/portal/manager/AssignCleanerDropdown'
import { ChevronRight, User, MapPin, Calendar, Key, ClipboardList } from 'lucide-react'

const FREQUENCY_LABELS: Record<string, string> = {
  weekly:       'Weekly',
  fortnightly:  'Fortnightly',
  monthly:      'Monthly',
  twice_weekly: 'Twice weekly',
  three_weekly: '3x per week',
  four_weekly:  'Every 4 weeks',
  adhoc:        'Ad hoc',
}

const DAY_LABELS: Record<string, string> = {
  monday:    'Monday',
  tuesday:   'Tuesday',
  wednesday: 'Wednesday',
  thursday:  'Thursday',
  friday:    'Friday',
  saturday:  'Saturday',
  sunday:    'Sunday',
}

function formatBrisbaneDatetime(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatBrisbaneTime(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Brisbane',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isWithin30Days(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 30
}

export default async function ManagerClientDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: client }, { data: jobs }, { data: cleanerProfiles }] = await Promise.all([
    (supabase as any)
      .from('profiles').select('full_name').eq('user_id', user.id).single(),
    (supabase as any)
      .from('clients')
      .select('*, profiles!clients_assigned_cleaner_id_fkey(full_name)')
      .eq('id', params.id)
      .single(),
    (supabase as any)
      .from('job_assignments')
      .select('*, profiles(full_name), job_submissions(started_at, submitted_at, completed_at, notes, photo_urls)')
      .eq('client_id', params.id)
      .order('scheduled_date', { ascending: false })
      .limit(20),
    (supabase as any)
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'cleaner')
      .order('full_name'),
  ])

  if (!client) notFound()

  const days: string[] = client.service_days ?? []
  const freqLabel = FREQUENCY_LABELS[client.frequency] ?? client.frequency ?? '—'
  const additionalServices: any[] = client.additional_services ?? []
  const allJobs: any[] = jobs ?? []
  const cleaners: { id: string; full_name: string | null }[] = cleanerProfiles ?? []

  return (
    <>
      {/* Back + title */}
      <div className="flex items-center gap-2 mb-4">
        <Link href="/manager/clients" className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-black transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Clients
        </Link>
      </div>
      <h1 className="text-lg font-bold text-black mb-4">{client.business_name}</h1>

      {/* Overview */}
      <section className="mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Overview</p>
        <div className="bg-white rounded-2xl px-5 py-4 space-y-3">
          {/* Address */}
          {(client.address || client.suburb) && (
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">
                {[client.address, client.suburb].filter(Boolean).join(', ')}
              </p>
            </div>
          )}


          {/* Frequency + days */}
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-700">{freqLabel}</p>
              {days.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {days.map((d) => DAY_LABELS[d.toLowerCase()] ?? d).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Assigned cleaner */}
          {client.profiles?.full_name && (
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400">Assigned Cleaner</p>
                <p className="text-sm text-gray-700">{client.profiles.full_name}</p>
              </div>
            </div>
          )}

          {/* Scope of work */}
          <div className="flex items-start gap-3">
            <ClipboardList className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Scope of Work</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {client.scope_of_work || 'Not set'}
              </p>
            </div>
          </div>

          {/* Access details */}
          {client.access_details && (
            <div className="flex items-start gap-3">
              <Key className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Access Details</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.access_details}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Additional Services */}
      {additionalServices.length > 0 && (
        <section className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Additional Services
          </p>
          <div className="space-y-2">
            {additionalServices.map((svc: any, i: number) => {
              const dueSoon = isWithin30Days(svc.nextDue)
              return (
                <div key={i} className="bg-white rounded-2xl px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black">{svc.name}</p>
                      {svc.frequency && (
                        <p className="text-xs text-gray-400 mt-0.5">{svc.frequency}</p>
                      )}
                      {svc.lastCompleted && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Last done: {new Date(svc.lastCompleted).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                    {svc.nextDue && (
                      <div className={`flex-shrink-0 text-right px-3 py-1.5 rounded-xl ${
                        dueSoon ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        <p className="text-[10px] font-medium">Next due</p>
                        <p className="text-xs font-bold">
                          {new Date(svc.nextDue).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short',
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Assign Cleaner */}
      <AssignCleanerDropdown
        clientId={client.id}
        currentCleanerId={client.assigned_cleaner_id ?? null}
        cleaners={cleaners}
      />

      {/* Job History */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Job History · {allJobs.length} jobs
        </p>
        {allJobs.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">No jobs recorded</div>
        )}
        <div className="space-y-2">
          {allJobs.map((job: any) => {
            const sub = Array.isArray(job.job_submissions)
              ? job.job_submissions[0]
              : job.job_submissions
            const photoCount: number = (sub?.photo_urls ?? []).length

            return (
              <Link key={job.id} href={`/manager/jobs/${job.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">
                      {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                    {job.profiles?.full_name && (
                      <p className="text-xs text-gray-500 mt-0.5">{job.profiles.full_name}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {sub?.started_at && (
                        <span className="text-[11px] text-gray-400">
                          Started {formatBrisbaneTime(sub.started_at)}
                        </span>
                      )}
                      {sub?.completed_at && (
                        <span className="text-[11px] text-gray-400">
                          · Done {formatBrisbaneTime(sub.completed_at)}
                        </span>
                      )}
                      {sub?.started_at && sub?.completed_at && (() => {
                        const mins = Math.round((new Date(sub.completed_at).getTime() - new Date(sub.started_at).getTime()) / 60000)
                        return mins > 0 ? <span className="text-[11px] text-gray-400">· {mins}m</span> : null
                      })()}
                      {photoCount > 0 && (
                        <span className="text-[11px] text-gray-400">· {photoCount} photo{photoCount !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                    {sub?.notes && (
                      <p className="text-xs text-gray-400 mt-1 italic truncate">"{sub.notes}"</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                      job.status === 'completed'   ? 'bg-black text-white' :
                      job.status === 'in_progress' ? 'border border-black text-black' :
                      job.status === 'flagged'     ? 'bg-gray-800 text-white' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {job.status === 'not_started' ? 'Pending' :
                       job.status === 'in_progress' ? 'Active' :
                       job.status === 'completed'   ? 'Done' :
                       job.status === 'flagged'     ? 'Flagged' : job.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </>
  )
}
