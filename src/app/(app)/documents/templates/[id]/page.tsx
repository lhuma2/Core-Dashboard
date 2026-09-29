export const dynamic = 'force-dynamic'
export const revalidate = 0

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { TemplateSetup } from '@/components/documents/template/TemplateSetup'

// Turn a company document into a template: mark which parts of it change on
// each proposal, and how they should look.
export default async function TemplateSetupPage({ params }: { params: { id: string } }) {
  const db = createAdminClient() as any
  const { data: doc } = await db.from('company_documents').select('*').eq('id', params.id).single()
  if (!doc) notFound()
  return <TemplateSetup companyDocId={doc.id} name={doc.name} fileUrl={doc.file_url} initial={doc.template ?? null} />
}
