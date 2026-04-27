import Link from 'next/link'
import { ChevronRight, AlertTriangle } from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  not_started: { label: 'Pending',    cls: 'text-gray-400 border border-gray-200', dot: 'bg-gray-300' },
  in_progress: { label: 'In Progress', cls: 'text-black border border-black',        dot: 'bg-black'   },
  completed:   { label: 'Completed',  cls: 'bg-black text-white',                  dot: 'bg-black'   },
  flagged:     { label: 'Flagged',    cls: 'bg-gray-900 text-white',               dot: 'bg-gray-800'},
}

interface Props {
  job: {
    id: string
    scheduled_date: string
    status: string
    clients?: { business_name?: string; suburb?: string } | null
    profiles?: { full_name?: string } | null
  }
}

export function ManagerJobRow({ job }: Props) {
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.not_started
  const today = new Date().toISOString().split('T')[0]
  const isToday = job.scheduled_date === today

  const dateStr = isToday
    ? 'Today'
    : new Date(job.scheduled_date + 'T00:00:00').toLocaleDateString('en-AU', {
        weekday: 'short', day: 'numeric', month: 'short',
      })

  return (
    <Link
      href={`/manager/jobs/${job.id}`}
      className="flex items-center justify-between bg-white rounded-2xl px-5 py-4 active:scale-[0.98] transition-all"
    >
      <div className="flex items-start gap-4 min-w-0">
        {/* Date */}
        <div className="flex-shrink-0 text-center min-w-[40px]">
          <p className={`text-xs font-semibold ${isToday ? 'text-black' : 'text-gray-400'}`}>{dateStr}</p>
        </div>

        {/* Info */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {job.status === 'flagged' && <AlertTriangle className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />}
            <p className="text-sm font-semibold text-black truncate">
              {job.clients?.business_name ?? 'Unknown'}
            </p>
          </div>
          {job.profiles?.full_name && (
            <p className="text-xs text-gray-400 mt-0.5">{job.profiles.full_name}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cfg.cls}`}>
          {cfg.label}
        </span>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </div>
    </Link>
  )
}
