'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { AlertCircle, AlertTriangle, X } from 'lucide-react'
import type { DashboardAlert } from '@/types/app'

const STORAGE_KEY = 'delta-dismissed-alerts'

interface AlertPanelProps {
  alerts: DashboardAlert[]
}

export function AlertPanel({ alerts }: AlertPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setDismissed(new Set(JSON.parse(stored) as string[]))
    } catch {}
  }, [])

  const visible = alerts.filter(a => !dismissed.has(a.id))
  if (visible.length === 0) return null

  function persist(next: Set<string>) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))) } catch {}
  }

  const dismiss = (id: string) =>
    setDismissed(prev => {
      const next = new Set(Array.from(prev).concat(id))
      persist(next)
      return next
    })

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {visible.length} alert{visible.length !== 1 ? 's' : ''} requiring attention
        </p>
        <button
          onClick={() => {
            const next = new Set(visible.map(a => a.id))
            persist(next)
            setDismissed(next)
          }}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Dismiss all
        </button>
      </div>

      {/* Alert rows */}
      <div className="divide-y divide-gray-100">
        {visible.map(alert => {
          const isCritical = alert.severity === 'critical'
          const Icon       = isCritical ? AlertCircle : AlertTriangle
          const iconColor  = isCritical ? 'text-red-500' : 'text-amber-500'
          const dotColor   = isCritical ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'

          return (
            <div key={alert.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
              <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{alert.message}</p>
                {alert.subtext && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.subtext}</p>
                )}
              </div>
              <Link
                href={alert.href}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline flex-shrink-0"
              >
                {alert.resolveHint} →
              </Link>
              <button
                onClick={() => dismiss(alert.id)}
                className="p-1 rounded text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
