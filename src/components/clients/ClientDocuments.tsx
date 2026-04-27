import Link from 'next/link'
import type { Document } from '@/types/app'
import { formatDate } from '@/lib/formatters'
import { DocumentStatusBadge } from '@/components/ui/Badge'
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { NewDocumentDropdown } from '@/components/documents/NewDocumentDropdown'

interface ClientDocumentsProps {
  clientId: string
  documents: Document[]
}

export function ClientDocuments({ clientId, documents }: ClientDocumentsProps) {
  return (
    <Card padding={false}>
      <CardHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
        <CardTitle>Documents</CardTitle>
        <NewDocumentDropdown clientId={clientId} />
      </CardHeader>
      <div className="divide-y divide-gray-100">
        {documents.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">
            No documents yet for this client
          </p>
        ) : (
          documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-50 transition"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.title || doc.ref_number}
                </p>
                <p className="text-xs text-gray-400">
                  {DOCUMENT_TYPE_LABELS[doc.document_type]} · v{doc.version} ·{' '}
                  {formatDate(doc.created_at)}
                </p>
              </div>
              <DocumentStatusBadge status={doc.status || 'draft'} />
            </Link>
          ))
        )}
      </div>
    </Card>
  )
}
