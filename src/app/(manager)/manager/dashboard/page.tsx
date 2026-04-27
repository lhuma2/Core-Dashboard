import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ManagerJobRow } from '@/components/portal/manager/ManagerJobRow'
import { AlertTriangle } from 'lucide-react'

const STATUS_ORDER = ['flagged', 'in_progress', 'not_started', 'completed']

export default async function ManagerDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const from = new Date(Date.now() - 30 * 86_400_000).toISOString().split('T')[0]
  const to   = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0]

  const today = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Brisbane',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).split('/').reverse().join('-') // yyyy-mm-dd in Brisbane time

  // Fetch profile and jobs in parallel
  const [{ data: profile }, { data: jobs }] = await Promise.all([
    (supabase as any)
      .from('profiles').select('full_name').eq('user_id', user.id).single(),
    (supabase as any)
      .from('job_assignments')
      .select('*, clients(business_name, suburb), profiles(full_name), job_submissions(started_at, submitted_at, completed_at, photo_urls)')
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date', { ascending: false }),
  ])

  const firstName = (profile?.full_name ?? user.email ?? '').split(' ')[0]
  const hour = parseInt(
    new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', hour: 'numeric', hour12: false }), 10
  )
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const allJobs: any[] = (jobs ?? []).sort((a: any, b: any) => {
    const ai = STATUS_ORDER.indexOf(a.status)
    const bi = STATUS_ORDER.indexOf(b.status)
    if (ai !== bi) return ai - bi
    return a.scheduled_date > b.scheduled_date ? -1 : 1
  })

  // Needs Attention logic
  function getSub(job: any) {
    const sub = job.job_submissions
    if (Array.isArray(sub)) return sub[0] ?? null
    return sub ?? null
  }

  // 1. No submission + scheduled today = not started today
  const notStartedToday = allJobs.filter((j) => {
    const sub = getSub(j)
    return j.scheduled_date === today && !sub
  })

  // 2. Submission exists but no completed_at = started but unfinished
  const startedNotDone = allJobs.filter((j) => {
    const sub = getSub(j)
    return sub && sub.started_at && !sub.completed_at
  })

  // 3. Job before today with empty photo_urls
  const missingPhotos = allJobs.filter((j) => {
    const sub = getSub(j)
    if (!sub) return false
    const photoUrls: string[] = sub.photo_urls ?? []
    return j.scheduled_date < today && photoUrls.length === 0 && j.status === 'completed'
  })

  const hasAttention = notStartedToday.length > 0 || startedNotDone.length > 0 || missingPhotos.length > 0

  return (
    <>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black tracking-tight">
          {greeting}, {firstName}.
        </h1>
      </div>

      {/* Needs Attention */}
      {hasAttention && (
        <section className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Needs Attention
          </p>
          <div className="space-y-2">
            {notStartedToday.map((job: any) => (
              <Link key={`ns-${job.id}`} href={`/manager/jobs/${job.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3 active:bg-gray-50 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">Not started today</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {job.clients?.business_name ?? 'Unknown'}{job.profiles?.full_name ? ` · ${job.profiles.full_name}` : ''}
                    </p>
                  </div>
                </div>
              </Link>
            ))}

            {startedNotDone.map((job: any) => (
              <Link key={`sd-${job.id}`} href={`/manager/jobs/${job.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3 active:bg-gray-50 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">Started but not completed</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {job.clients?.business_name ?? 'Unknown'}{job.profiles?.full_name ? ` · ${job.profiles.full_name}` : ''}
                      {' · '}
                      {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
                        day: 'numeric', month: 'short',
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}

            {missingPhotos.map((job: any) => (
              <Link key={`mp-${job.id}`} href={`/manager/jobs/${job.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3 active:bg-gray-50 transition-colors">
                  <AlertTriangle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">Missing photos</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {job.clients?.business_name ?? 'Unknown'}{job.profiles?.full_name ? ` · ${job.profiles.full_name}` : ''}
                      {' · '}
                      {new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
                        day: 'numeric', month: 'short',
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Job list */}
      <div className="space-y-2">
        {allJobs.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">No jobs in this period</div>
        )}
        {allJobs.map((job: any) => (
          <ManagerJobRow key={job.id} job={job} />
        ))}
      </div>

    </>
  )
}
