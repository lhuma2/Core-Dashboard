import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  subvalue?: string
  icon?: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
  className?: string
  accent?: string
}

export function StatCard({
  label,
  value,
  subvalue,
  icon: Icon,
  trend,
  trendLabel,
  className,
  accent,
}: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-gray-200 shadow-sm p-6',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
          {subvalue && (
            <p className="text-xs text-gray-400 mt-1">{subvalue}</p>
          )}
          {trendLabel && (
            <p
              className={cn('text-xs mt-2 font-medium', {
                'text-green-600': trend === 'up',
                'text-red-600': trend === 'down',
                'text-gray-500': trend === 'neutral',
              })}
            >
              {trend === 'up' && '↑ '}
              {trend === 'down' && '↓ '}
              {trendLabel}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-4"
            style={{ backgroundColor: accent || '#e8eef5' }}
          >
            <Icon
              className="w-5 h-5"
              style={{ color: accent ? '#fff' : '#1e3a5f' }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
