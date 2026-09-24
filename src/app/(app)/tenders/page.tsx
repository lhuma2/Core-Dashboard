import { createAdminClient } from '@/lib/supabase/admin'
import { TenderBoard } from '@/components/tenders/TenderBoard'
import type { Tender } from '@/lib/tenders/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function TendersPage() {
  const db = createAdminClient() as any
  const { data } = await db
    .from('tenders')
    .select('*')
    .eq('status', 'active')
    .order('close_date', { ascending: true, nullsFirst: false })

  return <TenderBoard initialTenders={(data ?? []) as Tender[]} />
}
