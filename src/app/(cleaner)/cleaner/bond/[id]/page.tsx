export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PortalShell } from '@/components/portal/PortalShell'
import { MapPin, Phone, Clock, CalendarDays, MessageSquare } from 'lucide-react'

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

export default async function CleanerBondJobPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles').select('*').eq('user_id', user.id).single()
  if (!profile) redirect('/login')

  const { data: job } = await (supabase as any)
    .from('bond_jobs')
    .select('*')
    .eq('id', params.id)
    .eq('cleaner_id', profile.id)
    .single()

  if (!job) notFound()

  return (
    <PortalShell userName={profile.full_name} subtitle="Cleaner Portal" backHref="/cleaner/timetable" backLabel="Timetable">
      <div className="mb-5">
        <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-700 mb-3">
          Bond Clean
        </span>
        <h1 className="text-2xl font-bold text-black tracking-tight">{job.client_name}</h1>
      </div>

      <div className="space-y-3">
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

        <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
          <MapPin className="w-4 h-4 text-brand-navy mt-0.5 flex-shrink-0" />
          <p className="text-sm text-black">{job.address}</p>
        </div>

        {job.contact_phone && (
          <a href={`tel:${job.contact_phone}`} className="block">
            <div className="bg-white rounded-2xl px-5 py-4 flex items-center gap-3 active:bg-gray-50 transition-colors">
              <Phone className="w-4 h-4 text-brand-navy flex-shrink-0" />
              <p className="text-sm font-medium text-black">{job.contact_phone}</p>
            </div>
          </a>
        )}

        {job.comments && (
          <div className="bg-white rounded-2xl px-5 py-4 flex items-start gap-3">
            <MessageSquare className="w-4 h-4 text-brand-navy mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.comments}</p>
          </div>
        )}
      </div>
    </PortalShell>
  )
}
