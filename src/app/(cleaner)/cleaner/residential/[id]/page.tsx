export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalShell } from '@/components/portal/PortalShell'
import { JobStartFlow } from '@/components/portal/cleaner/JobStartFlow'
import { StartResidentialOccurrenceButton } from '@/components/portal/cleaner/StartResidentialOccurrenceButton'
import { MapPin, Phone, Clock, CalendarDays, MessageSquare, BedDouble, Droplets, Repeat } from 'lucide-react'
import { actionableDates, brisbaneTodayStr, getUpcomingDates } from '@/lib/schedule'

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
}
const FREQUENCY_LABEL: Record<string, string> = {
  weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
}

export default async function CleanerResidentialJobPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const { data: row } = await (supabase as any)
    .from('residential_jobs')
    .select('*')
    .eq('id', params.id)
    .eq('cleaner_id', profile.id)
    .single()

  if (!row) notFound()

  const isTemplate = !!row.frequency && !row.parent_id
  let job = row // the concrete, trackable job — the row itself, or a resolved instance below

  if (isTemplate) {
    const today = brisbaneTodayStr()
    const dates = actionableDates(today)
    const { data: instances } = await (supabase as any)
      .from('residential_jobs')
      .select('*')
      .eq('parent_id', row.id)
      .in('clean_date', dates)
      .order('clean_date', { ascending: false })
    job = (instances ?? []).find((j: any) => j.status !== 'completed') ?? (instances ?? [])[0] ?? null
  }

  const upcoming = isTemplate
    ? getUpcomingDates({
        id: row.id, business_name: row.client_name, address: row.address, suburb: null,
        frequency: row.frequency, service_days: row.service_days ?? [], start_date: row.clean_date,
      }, 60).slice(0, 5)
    : []

  return (
    <PortalShell userName={profile.full_name} subtitle="Cleaner Portal" backHref="/cleaner/dashboard" backLabel="Home">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
            Residential Clean
          </span>
          {isTemplate ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-500">
              <Repeat className="w-3 h-3" /> {FREQUENCY_LABEL[row.frequency] ?? row.frequency}
            </span>
          ) : (
            <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-500">
              {STATUS_LABEL[job?.status] ?? job?.status}
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-black tracking-tight">{row.client_name}</h1>
      </div>

      <div className="space-y-3 mb-4">
        {isTemplate ? (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <CalendarDays className="w-4 h-4 text-brand-navy mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-black">
                {FREQUENCY_LABEL[row.frequency] ?? row.frequency} · {(row.service_days ?? []).join(', ')}
              </p>
              {formatTime(row.clean_time) && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatTime(row.clean_time)}
                </p>
              )}
              {upcoming.length > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">Next: {formatDate(upcoming[0].toISOString().split('T')[0])}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <CalendarDays className="w-4 h-4 text-brand-navy mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-black">{formatDate(job.clean_date)}</p>
              {formatTime(job.clean_time) && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatTime(job.clean_time)}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
          <MapPin className="w-4 h-4 text-brand-navy mt-0.5 flex-shrink-0" />
          <p className="text-sm text-black">{row.address}</p>
        </div>

        {row.contact_phone && (
          <a href={`tel:${row.contact_phone}`} className="block">
            <div className="bg-white rounded-2xl px-5 py-4 flex items-center gap-3 active:bg-gray-50 transition-colors">
              <Phone className="w-4 h-4 text-brand-navy flex-shrink-0" />
              <p className="text-sm font-medium text-black">{row.contact_phone}</p>
            </div>
          </a>
        )}

        {(row.bedrooms != null || row.bathrooms != null) && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <BedDouble className="w-4 h-4 text-brand-navy mt-0.5 flex-shrink-0" />
            <p className="text-sm text-black">
              {row.bedrooms != null && `${row.bedrooms} bed${row.bedrooms === 1 ? '' : 's'}`}
              {row.bedrooms != null && row.bathrooms != null && ' · '}
              {row.bathrooms != null && `${row.bathrooms} bath${row.bathrooms === 1 ? '' : 's'}`}
            </p>
          </div>
        )}

        {(row.carpet_steam_rooms > 0 || row.carpet_steam_hallways > 0) && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <Droplets className="w-4 h-4 text-brand-navy mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-black">Carpet Steam Cleaning</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {row.carpet_steam_rooms > 0 && `${row.carpet_steam_rooms} room${row.carpet_steam_rooms === 1 ? '' : 's'}`}
                {row.carpet_steam_rooms > 0 && row.carpet_steam_hallways > 0 && ' · '}
                {row.carpet_steam_hallways > 0 && `${row.carpet_steam_hallways} hallway${row.carpet_steam_hallways === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
        )}

        {row.comments && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <MessageSquare className="w-4 h-4 text-brand-navy mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{row.comments}</p>
          </div>
        )}
      </div>

      {/* No instance yet for a recurring template — one is created the moment
          the cleaner taps Start, exactly like a commercial client's first clean. */}
      {isTemplate && !job ? (
        <StartResidentialOccurrenceButton templateId={row.id} />
      ) : (
        // Always mounted — JobStartFlow owns its own "completed" state internally
        // (including the after-photo prompt), so a server refresh that flips
        // job.status to 'completed' must not unmount it mid-prompt.
        <JobStartFlow
          jobId={job.id}
          status={job.status}
          startedAt={job.started_at}
          kind="residential_job"
          finishedAt={job.finished_at}
        />
      )}
    </PortalShell>
  )
}
