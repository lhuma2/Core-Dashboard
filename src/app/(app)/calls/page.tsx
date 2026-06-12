import { createAdminClient } from '@/lib/supabase/admin'
import { CallDeck } from '@/components/calls/CallDeck'
import type { ColdLead } from '@/actions/cold-leads'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CallsPage() {
  const db = createAdminClient() as any
  const { data } = await db
    .from('cold_leads')
    .select('*')
    .order('created_at', { ascending: false })

  return <CallDeck initialLeads={(data ?? []) as ColdLead[]} />
}
