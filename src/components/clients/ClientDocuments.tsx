import Link from 'next/link'
import type { Document } from '@/types/app'
import { formatDate } from '@/lib/formatters'
import { DocumentStatusBadge } from '@/components/ui/Badge'
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { NewDocumentDropdown } from '@/components/documents/NewDocumentDropdown'

// Quotes and agreements from the Documents tab (proposal_documents).
export interface ClientPortalDoc {
  id: string
  kind: string
  status: string
  title: string | null
  client_name: string | null
  ref_number: string | null
  signed_at: string | null
  updated_at: string
}

const KIND_LABEL: Record<string, string> = {
  proposal: 'Quote', agreement: 'Service Agreement', one_off: 'One-Off Agreement', capability: 'Capability Statement',
}
const STATUS: Record<string, { label: string; cls: string }> = {
  draft:             { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  sent:              { label: 'Sent', cls: 'bg-blue-50 text-blue-700' },
  accepted:          { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700' },
  declined:          { label: 'Declined', cls: 'bg-red-50 text-red-600' },
  out_for_signature: { label: 'Out for signature', cls: 'bg-amber-50 text-amber-700' },
  signed:            { label: 'Signed', cls: 'bg-[#00250e] text-white' },
}

interface ClientDocumentsProps {
  clientId: string
  documents: Document[]
  portalDocs?: ClientPortalDoc[]
}

export function ClientDocuments({ clientId, documents, portalDocs = [] }: ClientDocumentsProps) {
  return (
    <Card padding={false}>
      <CardHeader className="px-6 pt-5 pb-4 border-b border-gray-100">
        <CardTitle>Documents</CardTitle>
        <NewDocumentDropdown clientId={clientId} />
      </CardHeader>
      <div className="divide-y divide-gray-100">
        {portalDocs.map((d) => {
          const st = STATUS[d.status] ?? STATUS.draft
          return (
            <Link
              key={d.id}
              href={`/documents/${d.id}`}
              className="flex items-center justify-between gap-3 px-6 py-3.5 hover:bg-gray-50 transition"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {KIND_LABEL[d.kind] ?? 'Document'}{d.title ? ` · ${d.title}` : ''}
                </p>
                <p className="text-xs text-gray-400">
                  {[d.ref_number, d.signed_at ? `Signed ${formatDate(d.signed_at)}` : formatDate(d.updated_at)].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className={`text-[11px] font-semibold rounded-full px-2.5 py-0.5 flex-shrink-0 ${st.cls}`}>{st.label}</span>
            </Link>
          )
        })}
        {documents.length === 0 && portalDocs.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">
            No documents yet for this client
          </p>
        ) : (
          documents.length > 0 && documents.map((doc) => (
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
