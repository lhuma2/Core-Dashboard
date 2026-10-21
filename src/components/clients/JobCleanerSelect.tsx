'use client'

import { useState, useTransition } from 'react'

interface CleanerOption {
  id: string
  fullName: string
}

interface JobCleanerSelectProps {
  jobId: string
  currentCleanerId: string | null
  currentCleanerName: string | null
  cleaners: CleanerOption[]
  assignAction: (id: string, cleanerId: string) => Promise<{ error?: string; success?: boolean }>
  /** A clean that's already started or finished keeps its cleaner. */
  locked?: boolean
}

// Bordered picker while unassigned; once a cleaner is set it reads as plain
// text with a small caret, and picking another name reassigns the clean.
export function JobCleanerSelect({ jobId, currentCleanerId, currentCleanerName, cleaners, assignAction, locked }: JobCleanerSelectProps) {
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(currentCleanerId ?? '')

  if (currentCleanerId && locked) {
    return <span className="text-gray-900">{currentCleanerName ?? 'Unknown'}</span>
  }

  const assigned = !!currentCleanerId
  // Keep the current cleaner selectable even if they're no longer in the cleaner list.
  const options = assigned && !cleaners.some((c) => c.id === currentCleanerId)
    ? [{ id: currentCleanerId!, fullName: currentCleanerName ?? 'Unknown' }, ...cleaners]
    : cleaners

  return (
    <select
      className={assigned
        ? 'max-w-full bg-transparent text-gray-900 border-0 p-0 cursor-pointer hover:underline focus:outline-none focus:ring-0 disabled:opacity-50'
        : 'text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:border-[#00250e] disabled:opacity-50'}
      value={value}
      disabled={isPending}
      title={assigned ? 'Change cleaner' : undefined}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const cleanerId = e.target.value
        if (!cleanerId || cleanerId === value) return
        const previous = value
        setValue(cleanerId)
        startTransition(async () => {
          const res = await assignAction(jobId, cleanerId)
          if (res?.error) {
            setValue(previous)
            alert(res.error)
          }
        })
      }}
    >
      {!assigned && <option value="" disabled>Unassigned</option>}
      {options.map((c) => (
        <option key={c.id} value={c.id}>{c.fullName}</option>
      ))}
    </select>
  )
}
