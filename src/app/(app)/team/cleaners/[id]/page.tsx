export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { ArrowLeft, CheckCircle2, Clock, Flag, Users, Timer } from 'lucide-react'

function fmtDuration(mins: number | null): string {
  if (mins == null) return '—'
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function monthKey(d: Date) {
  return d.toLocaleString('en-AU', { timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit' })
}

export default async function CleanerProfilePage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('id, full_name, email, role, created_at')
    .eq('id', params.id)
    .single()

  if (!profile) notFound()

  const [{ data: jobs }, { data: clients }] = await Promise.all([
    (supabase as any)
      .from('job_assignments')
      .select('id, scheduled_date, status, clients(business_name), job_submissions(started_at, completed_at, completed_by_role)')
      .eq('cleaner_id', params.id)
      .order('scheduled_date', { ascending: false })
      .limit(200),
    (supabase as any)
      .from('clients')
      .select('id, business_name, suburb, frequency')
      .eq('assigned_cleaner_id', params.id)
      .eq('active', true)
      .order('business_name'),
  ])

  const allJobs = (jobs ?? []) as any[]
  const sub = (j: any) => (Array.isArray(j.job_submissions) ? j.job_submissions[0] : j.job_submissions) ?? null

  const completed = allJobs.filter((j) => j.status === 'completed')
  const flagged   = allJobs.filter((j) => j.status === 'flagged')
  const thisMonth = monthKey(new Date())
  const completedThisMonth = completed.filter((j) => {
    const s = sub(j)
    const at = s?.completed_at ?? (j.scheduled_date ? j.scheduled_date + 'T00:00:00' : null)
    return at && monthKey(new Date(at)) === thisMonth
  }).length

  // Durations from started_at → completed_at (cleaner submissions only)
  const durations: number[] = []
  const jobsWithDuration = allJobs.map((j) => {
    const s = sub(j)
    let mins: number | null = null
    if (s?.started_at && s?.completed_at) {
      mins = (new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000
      if (mins >= 0 && mins < 24 * 60) durations.push(mins)
      else mins = null
    }
    return { ...j, durationMins: mins, completedBy: s?.completed_by_role ?? null, completedAt: s?.completed_at ?? null }
  })
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null

  const stats = [
    { label: 'Jobs completed', value: String(completed.length), sub: 'all time', icon: CheckCircle2, color: 'text-emerald-600' },
    { label: 'This month', value: String(completedThisMonth), sub: 'completed', icon: Clock, color: 'text-[#1e3a5f]' },
    { label: 'Avg time on site', value: fmtDuration(avgDuration), sub: durations.length > 0 ? `from ${durations.length} timed jobs` : 'no timed jobs yet', icon: Timer, color: 'text-[#1e3a5f]' },
    { label: 'Flags raised', value: String(flagged.length), sub: 'issues reported', icon: Flag, color: flagged.length > 0 ? 'text-amber-600' : 'text-gray-400' },
  ]

  const recent = jobsWithDuration.slice(0, 15)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Team
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#1e3a5f] flex items-center justify-center text-white font-display text-xl font-bold flex-shrink-0">
            {(profile.full_name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-gray-900">{profile.full_name ?? 'Cleaner'}</h1>
            <p className="text-sm text-gray-400">{profile.email} · Cleaner</p>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] p-5">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.12em]">{s.label}</p>
            </div>
            <p className="font-display text-2xl font-extrabold text-gray-900 tabular-nums">{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Assigned clients */}
        <div className="lg:col-span-1">
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900">Assigned clients</h2>
              <span className="text-xs text-gray-400 tabular-nums">· {(clients ?? []).length}</span>
            </div>
            {(clients ?? []).length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No clients assigned</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {(clients as any[]).map((c) => (
                  <Link key={c.id} href={`/clients/${c.id}`} className="block px-5 py-3 hover:bg-gray-50 transition-colors">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.business_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 capitalize">{[c.suburb, c.frequency?.replace('_', ' ')].filter(Boolean).join(' · ') || '—'}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Recent jobs with durations */}
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Recent jobs</h2>
            </div>
            {recent.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No jobs yet</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {recent.map((j) => {
                  const d = new Date(j.scheduled_date + 'T00:00:00')
                  const dateLabel = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
                  const statusColor = j.status === 'completed' ? 'text-emerald-600' : j.status === 'flagged' ? 'text-amber-600' : 'text-gray-400'
                  return (
                    <div key={j.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{j.clients?.business_name ?? '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{dateLabel}</p>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        {j.durationMins != null && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 tabular-nums">
                            <Timer className="w-3.5 h-3.5 text-gray-400" /> {fmtDuration(j.durationMins)}
                          </span>
                        )}
                        <span className={`text-xs font-semibold capitalize ${statusColor}`}>
                          {j.status === 'completed' && j.completedBy && j.completedBy !== 'cleaner' ? `${j.completedBy} marked` : j.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
