import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeadDocumentPreview } from '@/components/leads/LeadDocumentPreview'

export default async function LeadPreviewPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { type?: string }
}) {
  const supabase = createClient()
  const { data: lead, error } = await (supabase as any)
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!lead || error) notFound()

  const type = searchParams.type === 'agreement' ? 'agreement' : 'proposal'

  return <LeadDocumentPreview lead={lead} type={type} />
}
