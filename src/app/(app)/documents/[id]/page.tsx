'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { DocumentPreview } from '@/components/documents/DocumentPreview'
import { DocumentStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { updateDocumentStatusAction } from '@/actions/documents'
import { DOCUMENT_TYPE_LABELS } from '@/lib/constants'
import { formatDate } from '@/lib/formatters'
import { ArrowLeft, Download } from 'lucide-react'
import type { Document, DocumentContent } from '@/types/app'
import { Spinner } from '@/components/ui/Spinner'
import { DocumentEmailButton } from '@/components/documents/DocumentEmailButton'

export default function DocumentViewPage() {
  const params = useParams()
  const router = useRouter()
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('documents')
      .select('*, clients(business_name, contact_email)')
      .eq('id', params.id as string)
      .single()
      .then(({ data }) => {
        setDocument(data)
        setLoading(false)
      })
  }, [params.id])

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  if (!document) return <p className="text-center py-16 text-gray-400">Document not found.</p>

  const content = document.content as unknown as DocumentContent | null

  async function changeStatus(status: 'sent' | 'signed' | 'cancelled') {
    setUpdating(true)
    await updateDocumentStatusAction(document!.id, status)
    router.refresh()
    // Re-fetch
    const supabase = createClient()
    const { data } = await supabase.from('documents').select('*, clients(business_name, contact_email)').eq('id', document!.id).single()
    setDocument(data)
    setUpdating(false)
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-start justify-between">
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Documents
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={() => window.open(`/print/${document.id}`, '_blank')}>
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </Button>
          <DocumentEmailButton document={document} />
          {document.status === 'draft' && (
            <Button size="sm" onClick={() => changeStatus('sent')} disabled={updating}>
              Mark as Sent
            </Button>
          )}
          {document.status === 'sent' && (
            <Button size="sm" onClick={() => changeStatus('signed')} disabled={updating}>
              Mark as Signed
            </Button>
          )}
          {(document.status === 'draft' || document.status === 'sent') && (
            <Button size="sm" variant="danger" onClick={() => changeStatus('cancelled')} disabled={updating}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {/* Document info bar */}
      <Card>
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{document.title || document.ref_number}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{document.ref_number} · {DOCUMENT_TYPE_LABELS[document.document_type]} · v{document.version}</p>
          </div>
          <div className="flex items-center gap-3">
            <DocumentStatusBadge status={document.status || 'draft'} />
            {document.sent_at && <p className="text-xs text-gray-400">Sent {formatDate(document.sent_at)}</p>}
            {document.signed_at && <p className="text-xs text-green-600">Signed {formatDate(document.signed_at)}</p>}
          </div>
        </div>
      </Card>

      {content ? (
        <DocumentPreview document={document} content={content} />
      ) : (
        <Card>
          <p className="text-gray-400 text-sm text-center py-8">
            This document has no preview content stored.
          </p>
        </Card>
      )}
    </div>
  )
}
