import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { LeadProfile } from '@/components/leads/LeadProfile'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: lead, error } = await (supabase as any)
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!lead || error) notFound()

  return (
    <div className="-m-4 lg:-m-6 p-4 lg:p-6">
      <LeadProfile lead={lead} />
    </div>
  )
}
