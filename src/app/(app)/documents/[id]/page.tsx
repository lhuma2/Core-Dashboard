export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { ProposalEditor } from '@/components/documents/ProposalEditor'
import { CompanyDocEditor } from '@/components/documents/CompanyDocEditor'
import { AgreementEditor } from '@/components/documents/AgreementEditor'
import { withProposalDefaults } from '@/lib/documents/proposal'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { ensureSignCode } from '@/actions/signing'
import type { SignatureFill } from '@/components/documents/render/AgreementDocument'

function auDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane',
  })
}

export default async function DocumentEditorPage({ params }: { params: { id: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('proposal_documents').select('*').eq('id', params.id).single()
  if (!doc) notFound()

  if (doc.kind === 'agreement') {
    const signCode = await ensureSignCode(doc.id)
    const { data: clients } = await db
      .from('clients').select('id, business_name').eq('active', true).order('business_name')
    const signature: SignatureFill | null =
      doc.signed_at && doc.signed_name ? { name: doc.signed_name, date: auDate(doc.signed_at) } : null
    return (
      <AgreementEditor
        id={doc.id}
        status={doc.status}
        initialData={withAgreementDefaults(doc.data)}
        signCode={signCode}
        clients={clients ?? []}
        clientId={doc.client_id}
        signature={signature}
      />
    )
  }
  // Company-document proposals (a PDF is attached) use the overlay editor.
  if (doc.pdf_url) {
    return (
      <CompanyDocEditor
        id={doc.id}
        initialData={doc.data ?? {}}
        pdfUrl={doc.pdf_url}
        docTitle={doc.client_name || 'Company document'}
      />
    )
  }
  return <ProposalEditor id={doc.id} status={doc.status} initialData={withProposalDefaults(doc.data)} pdfUrl={doc.pdf_url} />
}
