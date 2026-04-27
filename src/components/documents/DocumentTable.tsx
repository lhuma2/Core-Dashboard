'use client'

import { useRouter } from 'next/navigation'
import { Table, type Column } from '@/components/ui/Table'
import { DocumentStatusBadge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/formatters'
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants'
import type { Document } from '@/types/app'

type DocumentWithClient = Document & {
  clients: { business_name: string } | null
}

interface DocumentTableProps {
  documents: DocumentWithClient[]
}

export function DocumentTable({ documents }: DocumentTableProps) {
  const router = useRouter()

  const columns: Column<DocumentWithClient>[] = [
    {
      key: 'ref_number',
      header: 'Ref',
      render: (d) => <span className="font-mono text-xs text-gray-400">{d.ref_number}</span>,
    },
    {
      key: 'title',
      header: 'Document',
      sortable: true,
      render: (d) => (
        <div>
          <p className="font-medium text-gray-900">{d.title || d.ref_number}</p>
          <p className="text-xs text-gray-400">{DOCUMENT_TYPE_LABELS[d.document_type]} · v{d.version}</p>
        </div>
      ),
    },
    {
      key: 'clients',
      header: 'Client',
      render: (d) => d.clients?.business_name || '—',
    },
    {
      key: 'status',
      header: 'Status',
      render: (d) => <DocumentStatusBadge status={d.status || 'draft'} />,
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      render: (d) => formatDate(d.created_at),
    },
    {
      key: 'sent_at',
      header: 'Sent',
      render: (d) => formatDate(d.sent_at),
    },
    {
      key: 'signed_at',
      header: 'Signed',
      render: (d) => formatDate(d.signed_at),
    },
  ]

  return (
    <Table
      data={documents}
      columns={columns}
      keyExtractor={(d) => d.id}
      onRowClick={(d) => router.push(`/documents/${d.id}`)}
      emptyMessage="No documents found."
    />
  )
}
