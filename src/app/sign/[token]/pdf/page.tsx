export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { PrintProposal } from '@/components/documents/PrintProposal'
import type { SignatureFill } from '@/components/documents/render/AgreementDocument'

function auDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane',
  })
}

// Public "save a copy" print view — reachable only with the unique sign token.
export default async function SignPdfPage({ params }: { params: { token: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db
    .from('proposal_documents')
    .select('kind, data, signed_name, signed_at')
    .eq('sign_code', params.token)
    .maybeSingle()

  if (!doc || doc.kind !== 'agreement') notFound()

  const data = withAgreementDefaults(doc.data)
  const signature: SignatureFill | null =
    doc.signed_at && doc.signed_name ? { name: doc.signed_name, date: auDate(doc.signed_at) } : null

  return <PrintProposal kind="agreement" data={data} signature={signature} />
}
