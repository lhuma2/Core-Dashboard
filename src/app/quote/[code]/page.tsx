export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { isTemplateDocData } from '@/lib/documents/template'
import { QuoteAcceptExperience } from '@/components/documents/template/QuoteAcceptExperience'

export default async function QuotePage({ params }: { params: { code: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, kind, status, data, pdf_url, client_name')
    .eq('sign_code', params.code)
    .maybeSingle()

  if (!doc || doc.kind !== 'proposal' || !doc.pdf_url || !isTemplateDocData(doc.data) || !doc.data.quoteMode) {
    return (
      <div className="min-h-[100dvh] bg-[#00250e] flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-white text-xl font-bold mb-2">This quote link isn&apos;t valid</h1>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            The link may be mistyped or no longer active. Please contact Core Cleaning for a fresh link.
          </p>
        </div>
      </div>
    )
  }

  // Already accepted: point straight at their agreement.
  let agreementCode: string | null = null
  if (doc.status === 'accepted') {
    const { data: agr } = await db.from('proposal_documents')
      .select('sign_code').eq('source_id', doc.id).eq('kind', 'agreement')
      .order('created_at', { ascending: true }).limit(1).maybeSingle()
    agreementCode = agr?.sign_code ?? null
  }

  return (
    <QuoteAcceptExperience
      code={params.code}
      pdfUrl={doc.pdf_url}
      data={doc.data}
      docTitle={doc.data.clientName || doc.client_name || 'Your quote'}
      accepted={doc.status === 'accepted'}
      agreementCode={agreementCode}
    />
  )
}
