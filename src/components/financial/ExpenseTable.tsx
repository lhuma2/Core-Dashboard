'use client'

import { useState } from 'react'
import { Table, type Column } from '@/components/ui/Table'
import { formatAUD, formatDate } from '@/lib/formatters'
import { deleteFinancialRecordAction } from '@/actions/financial'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FinancialRecord } from '@/types/app'

type RecordWithClient = FinancialRecord & {
  clients: { business_name: string } | null
}

interface ExpenseTableProps {
  records: RecordWithClient[]
}

export function ExpenseTable({ records }: ExpenseTableProps) {
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('Delete this record?')) return
    setDeleting(id)
    await deleteFinancialRecordAction(id)
    setDeleting(null)
  }

  const columns: Column<RecordWithClient>[] = [
    {
      key: 'record_date',
      header: 'Date',
      sortable: true,
      render: (r) => formatDate(r.record_date),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => (
        <span className={cn('text-xs font-semibold uppercase tracking-wide',
          r.type === 'income' ? 'text-green-600' : 'text-red-500'
        )}>{r.type}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (r) => r.category || '—',
    },
    {
      key: 'clients',
      header: 'Client',
      render: (r) => r.clients?.business_name || <span className="text-gray-400">General</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (r) => <span className="text-gray-500">{r.description || '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      className: 'text-right font-semibold',
      headerClassName: 'text-right',
      render: (r) => (
        <span className={cn('block text-right font-semibold',
          r.type === 'income' ? 'text-green-700' : 'text-red-600'
        )}>
          {r.type === 'income' ? '+' : '-'}{formatAUD(r.amount)}
        </span>
      ),
    },
    {
      key: 'id',
      header: '',
      render: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(r.id) }}
          disabled={deleting === r.id}
          className="p-1.5 text-gray-300 hover:text-red-500 transition"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ]

  return (
    <Table
      data={records}
      columns={columns}
      keyExtractor={(r) => r.id}
      emptyMessage="No financial records yet."
    />
  )
}
