import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PhotoGrid } from '@/components/ui/PhotoLightbox'
import { ArrowLeft, MapPin, Phone, User, MessageSquare } from 'lucide-react'

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
}

function formatBrisbaneTime(isoString: string | null | undefined): string {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Brisbane', hour: '2-digit', minute: '2-digit',
  })
}

export default async function AdminBondJobDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: job }, { data: photos }] = await Promise.all([
    (supabase as any)
      .from('bond_jobs')
      .select('*, profiles!bond_jobs_cleaner_id_fkey(full_name)')
      .eq('id', params.id)
      .single(),
    (supabase as any)
      .from('job_photos')
      .select('id, phase, storage_path')
      .eq('job_id', params.id)
      .eq('job_kind', 'bond_job')
      .order('uploaded_at', { ascending: true }),
  ])

  if (!job) notFound()

  const toPublicUrl = (path: string) => (supabase as any).storage.from('job-photos').getPublicUrl(path).data.publicUrl as string
  const beforePhotos = (photos ?? []).filter((p: any) => p.phase === 'before').map((p: any) => toPublicUrl(p.storage_path))
  const afterPhotos  = (photos ?? []).filter((p: any) => p.phase === 'after').map((p: any) => toPublicUrl(p.storage_path))

  let durationMin: number | null = null
  if (job.started_at && job.finished_at) {
    durationMin = Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 60000)
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Link href="/clients?tab=bond" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" />
        Back to Bond Clients
      </Link>

      <div className="bg-white border border-gray-200/70 rounded-2xl px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{job.client_name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(job.clean_date + 'T00:00:00').toLocaleDateString('en-AU', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
          <span className="flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">
            {STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm text-gray-700">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {job.address}
          </div>
          {job.contact_phone && (
            <div className="flex items-center gap-1.5 text-sm text-gray-700">
              <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {job.contact_phone}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-sm text-gray-700">
            <User className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {job.profiles?.full_name ?? 'Unassigned'}
          </div>
        </div>
      </div>

      {(job.started_at || job.finished_at) && (
        <div className="bg-white border border-gray-200/70 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Timing</p>
          <div className="flex gap-6 flex-wrap">
            {job.started_at && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Started</p>
                <p className="text-sm font-semibold text-black">{formatBrisbaneTime(job.started_at)}</p>
              </div>
            )}
            {job.finished_at && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Finished</p>
                <p className="text-sm font-semibold text-black">{formatBrisbaneTime(job.finished_at)}</p>
              </div>
            )}
            {durationMin != null && durationMin > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Duration</p>
                <p className="text-sm font-semibold text-black">{durationMin} min</p>
              </div>
            )}
          </div>
        </div>
      )}

      {beforePhotos.length > 0 && (
        <div className="bg-white border border-gray-200/70 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Before ({beforePhotos.length})</p>
          <PhotoGrid photos={beforePhotos} />
        </div>
      )}

      {afterPhotos.length > 0 && (
        <div className="bg-white border border-gray-200/70 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">After ({afterPhotos.length})</p>
          <PhotoGrid photos={afterPhotos} />
        </div>
      )}

      {job.comments && (
        <div className="bg-white border border-gray-200/70 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Comments
          </p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.comments}</p>
        </div>
      )}
    </div>
  )
}
