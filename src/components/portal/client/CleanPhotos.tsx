import { PhotoGrid } from '@/components/ui/PhotoLightbox'
import { Camera, Link as LinkIcon } from 'lucide-react'

export type CleanMedia = { before: string[]; after: string[]; videos: string[] }

/**
 * Photos/videos for completed cleans, keyed by job id. Tagged before/after
 * photos come from job_photos; jobs recorded before that table existed only
 * have the flat job_submissions.photo_urls list, shown as "after" (same rule
 * as the manager job page).
 */
export async function loadCleanMedia(supabase: any, jobs: any[]): Promise<Record<string, CleanMedia>> {
  const ids = jobs.map((j) => j.id).filter(Boolean)
  if (ids.length === 0) return {}

  const { data: tagged } = await supabase
    .from('job_photos')
    .select('job_id, phase, storage_path, uploaded_at')
    .eq('job_kind', 'job_assignment')
    .in('job_id', ids)
    .order('uploaded_at', { ascending: true })

  const toPublicUrl = (path: string) => supabase.storage.from('job-photos').getPublicUrl(path).data.publicUrl as string

  const media: Record<string, CleanMedia> = {}
  for (const job of jobs) {
    const sub = Array.isArray(job.job_submissions) ? job.job_submissions[0] : job.job_submissions
    const rows = (tagged ?? []).filter((p: any) => p.job_id === job.id)
    const before = rows.filter((p: any) => p.phase === 'before').map((p: any) => toPublicUrl(p.storage_path))
    const after  = rows.filter((p: any) => p.phase === 'after').map((p: any) => toPublicUrl(p.storage_path))
    media[job.id] = {
      before,
      after:  rows.length > 0 ? after : ((sub?.photo_urls ?? []) as string[]),
      videos: (sub?.video_urls ?? []) as string[],
    }
  }
  return media
}

export function CleanPhotos({ media }: { media?: CleanMedia }) {
  if (!media) return null
  const count = media.before.length + media.after.length + media.videos.length
  if (count === 0) return null

  const photoCount = media.before.length + media.after.length
  const label = [
    photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? 's' : ''}` : null,
    media.videos.length > 0 ? `${media.videos.length} video${media.videos.length !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <details className="mt-2 group">
      <summary className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 cursor-pointer hover:text-black list-none">
        <Camera className="w-3.5 h-3.5" />
        <span className="group-open:hidden">View {label}</span>
        <span className="hidden group-open:inline">Hide {label}</span>
      </summary>
      <div className="mt-3 space-y-4 max-w-md">
        {media.before.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Before</p>
            <PhotoGrid photos={media.before} />
          </div>
        )}
        {media.after.length > 0 && (
          <div>
            {media.before.length > 0 && (
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">After</p>
            )}
            <PhotoGrid photos={media.after} />
          </div>
        )}
        {media.videos.length > 0 && (
          <div className="space-y-1.5">
            {media.videos.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-black hover:underline"
              >
                <LinkIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="truncate">Video {i + 1}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}
