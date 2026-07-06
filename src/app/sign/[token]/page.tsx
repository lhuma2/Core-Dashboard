export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { SignExperience } from '@/components/documents/SignExperience'
import { CompanyDocSignExperience } from '@/components/documents/CompanyDocSignExperience'
import type { SignatureFill } from '@/components/documents/render/AgreementDocument'

function auDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane',
  })
}

export default async function SignPage({ params }: { params: { token: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('id, kind, data, signed_name, signed_at, pdf_url, client_name')
    .eq('sign_code', params.token)
    .maybeSingle()

  // Company-document proposals (an attached PDF with placed fields) sign via the PDF overlay.
  if (doc && doc.pdf_url) {
    return (
      <CompanyDocSignExperience
        code={params.token}
        pdfUrl={doc.pdf_url}
        data={doc.data ?? {}}
        docTitle={doc.client_name || 'Document'}
        alreadySigned={!!doc.signed_at}
      />
    )
  }

  if (!doc || doc.kind !== 'agreement') {
    return (
      <div className="min-h-[100dvh] bg-[#00250e] flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-white text-xl font-bold mb-2">This signing link isn&apos;t valid</h1>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            The link may be mistyped or no longer active. Please contact Core Cleaning for a fresh link.
          </p>
        </div>
      </div>
    )
  }

  const data = withAgreementDefaults(doc.data)
  const alreadySigned: SignatureFill | null =
    doc.signed_at && doc.signed_name
      ? { name: doc.signed_name, date: auDate(doc.signed_at) }
      : null

  return <SignExperience token={params.token} data={data} alreadySigned={alreadySigned} />
}
