'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Table, type Column } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Trash2, ChevronRight } from 'lucide-react'

export interface BondJobRow {
  id: string
  client_name: string
  address: string
  contact_phone: string | null
  clean_date: string
  clean_time: string | null
  comments: string | null
  cleaner_id: string | null
  cleaner_name: string | null
  status: string
}

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-50 text-blue-600',
  completed:   'bg-emerald-50 text-emerald-600',
}
const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
}

interface BondJobTableProps {
  jobs: BondJobRow[]
  deleteAction: (id: string) => Promise<void>
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

export function BondJobTable({ jobs, deleteAction }: BondJobTableProps) {
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleDelete(id: string) {
    if (!confirm('Remove this bond clean? This cannot be undone.')) return
    setDeletingId(id)
    startTransition(async () => {
      await deleteAction(id)
      setDeletingId(null)
    })
  }

  const columns: Column<BondJobRow>[] = [
    {
      key: 'client_name',
      header: 'Client',
      render: (j) => (
        <Link href={`/clients/bond/${j.id}`} className="block">
          <p className="font-medium text-gray-900 hover:underline">{j.client_name}</p>
          <p className="text-xs text-gray-500">{j.address}</p>
        </Link>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (j) => (
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_STYLES[j.status] ?? STATUS_STYLES.not_started}`}>
          {STATUS_LABELS[j.status] ?? j.status}
        </span>
      ),
    },
    {
      key: 'clean_date',
      header: 'Scheduled',
      sortable: true,
      render: (j) => (
        <div>
          <p className="text-gray-900">{formatDate(j.clean_date)}</p>
          <p className="text-xs text-gray-500">{formatTime(j.clean_time)}</p>
        </div>
      ),
    },
    {
      key: 'contact_phone',
      header: 'Contact',
      render: (j) => <span className="text-gray-700">{j.contact_phone || '—'}</span>,
    },
    {
      key: 'cleaner_name',
      header: 'Cleaner',
      render: (j) => (
        <span className={j.cleaner_name ? 'text-gray-900' : 'text-gray-400'}>
          {j.cleaner_name || 'Unassigned'}
        </span>
      ),
    },
    {
      key: 'id',
      header: '',
      render: (j) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending && deletingId === j.id}
          onClick={() => handleDelete(j.id)}
        >
          <Trash2 className="w-4 h-4 text-gray-400" />
        </Button>
      ),
    },
  ]

  return (
    <>
      {/* Desktop / tablet — full table, unchanged */}
      <div className="hidden sm:block">
        <Table
          data={jobs}
          columns={columns}
          keyExtractor={(j) => j.id}
          emptyMessage="No bond cleans scheduled yet."
        />
      </div>

      {/* Phone — a table here would need horizontal scrolling to see status,
          cleaner, or the delete button, so it's a stacked card list instead.
          Same data, same actions (tap to open, tap trash to delete). */}
      <div className="sm:hidden divide-y divide-gray-100">
        {jobs.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">No bond cleans scheduled yet.</p>
        ) : (
          jobs.map((j) => (
            <div key={j.id} className="flex items-center gap-2 px-4 py-4">
              <Link href={`/clients/bond/${j.id}`} className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-gray-900 truncate">{j.client_name}</p>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${STATUS_STYLES[j.status] ?? STATUS_STYLES.not_started}`}>
                    {STATUS_LABELS[j.status] ?? j.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{j.address}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {formatDate(j.clean_date)} · {formatTime(j.clean_time)}
                  {' · '}
                  <span className={j.cleaner_name ? '' : 'text-gray-400'}>{j.cleaner_name || 'Unassigned'}</span>
                </p>
              </Link>
              <button
                type="button"
                disabled={isPending && deletingId === j.id}
                onClick={() => handleDelete(j.id)}
                className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-gray-400 active:bg-gray-100 disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          ))
        )}
      </div>
    </>
  )
}
