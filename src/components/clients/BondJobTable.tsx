'use client'

import { useState, useTransition } from 'react'
import { Table, type Column } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Trash2 } from 'lucide-react'

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
        <div>
          <p className="font-medium text-gray-900">{j.client_name}</p>
          <p className="text-xs text-gray-500">{j.address}</p>
        </div>
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
    <Table
      data={jobs}
      columns={columns}
      keyExtractor={(j) => j.id}
      emptyMessage="No bond cleans scheduled yet."
    />
  )
}
