import Link from 'next/link'
import type { Document } from '@/types/app'
import { formatDate } from '@/lib/formatters'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { AlertTriangle, ArrowRight } from 'lucide-react'

interface UnsignedDocumentsProps {
  documents: (Document & { clients: { business_name: string } | null })[]
}

export function UnsignedDocuments({ documents }: UnsignedDocumentsProps) {
  return (
    <Card padding={false}>
      <CardHeader className="px-6 pt-5 pb-0">
        <CardTitle className="flex items-center gap-2">
          {documents.length > 0 && (
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          )}
          Follow-up Required
        </CardTitle>
        <Link
          href="/documents"
          className="text-xs text-brand-navy hover:underline flex items-center gap-1"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>

      <div className="divide-y divide-gray-100 mt-4">
        {documents.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-400 text-center">
            No unsigned documents — all clear
          </p>
        ) : (
          documents.map((doc) => (
            <Link
              key={doc.id}
              href={`/documents/${doc.id}`}
              className="flex items-center justify-between px-6 py-3.5 hover:bg-amber-50 transition"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {doc.title || doc.ref_number}
                </p>
                <p className="text-xs text-gray-400">
                  {doc.clients?.business_name} · Sent {formatDate(doc.sent_at)}
                </p>
              </div>
              <span className="ml-4 flex-shrink-0 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Awaiting signature
              </span>
            </Link>
          ))
        )}
      </div>
    </Card>
  )
}
