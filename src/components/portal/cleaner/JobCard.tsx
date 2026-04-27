import Link from 'next/link'
import { MapPin, ChevronRight } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; dot: string; text: string }> = {
  not_started: { label: 'Not Started', dot: 'bg-gray-300', text: 'text-gray-400' },
  in_progress: { label: 'In Progress', dot: 'bg-black',    text: 'text-black'   },
  completed:   { label: 'Completed',   dot: 'bg-black',    text: 'text-gray-400' },
  flagged:     { label: 'Flagged',     dot: 'bg-gray-800', text: 'text-gray-700' },
}

interface Props {
  job: {
    id: string
    scheduled_date: string
    status: string
    frequency_label?: string | null
    clients?: { business_name?: string; address?: string; suburb?: string } | null
  }
}

export function JobCard({ job }: Props) {
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.not_started
  const client = job.clients

  const dateLabel = (() => {
    const today = new Date().toISOString().split('T')[0]
    const tom   = new Date(Date.now() + 86_400_000).toISOString().split('T')[0]
    if (job.scheduled_date === today) return 'Today'
    if (job.scheduled_date === tom)   return 'Tomorrow'
    return new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  })()

  return (
    <Link
      href={`/cleaner/jobs/${job.id}`}
      className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 shadow-sm active:scale-[0.98] transition-all"
    >
      <div className="flex items-start gap-4 min-w-0">
        {/* Date badge */}
        <div className="flex-shrink-0 w-12 text-center">
          <p className="text-xs font-medium text-gray-400">{dateLabel}</p>
        </div>

        {/* Info */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-black truncate">{client?.business_name ?? 'Job'}</p>
          {client?.address && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-500 truncate">
                {client.address}{client.suburb ? `, ${client.suburb}` : ''}
              </p>
            </div>
          )}
          {/* Status */}
          <div className="flex items-center gap-1.5 mt-2">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
          </div>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 ml-3" />
    </Link>
  )
}
