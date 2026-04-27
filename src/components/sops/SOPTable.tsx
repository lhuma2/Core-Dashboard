'use client'

import { useRouter } from 'next/navigation'
import { Table, type Column } from '@/components/ui/Table'
import { formatDate } from '@/lib/formatters'
import { Badge } from '@/components/ui/Badge'
import type { SOP } from '@/types/app'

interface SOPTableProps {
  sops: SOP[]
}

export function SOPTable({ sops }: SOPTableProps) {
  const router = useRouter()

  const columns: Column<SOP>[] = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (s) => (
        <div>
          <p className="font-medium text-gray-900">{s.title}</p>
          {!s.active && <p className="text-xs text-gray-400">Archived</p>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      render: (s) => <Badge>{s.category || '—'}</Badge>,
    },
    {
      key: 'version',
      header: 'Version',
      render: (s) => <span className="font-mono text-xs">v{s.version}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (s) => (
        <Badge variant={s.active ? 'success' : 'neutral'}>
          {s.active ? 'Active' : 'Archived'}
        </Badge>
      ),
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      sortable: true,
      render: (s) => formatDate(s.updated_at),
    },
  ]

  return (
    <Table
      data={sops}
      columns={columns}
      keyExtractor={(s) => s.id}
      onRowClick={(s) => router.push(`/sops/${s.id}`)}
      emptyMessage="No SOPs found. Create your first procedure."
    />
  )
}
