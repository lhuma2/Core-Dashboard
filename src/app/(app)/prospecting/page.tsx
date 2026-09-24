import { createAdminClient } from '@/lib/supabase/admin'
import { ProspectingBoard } from '@/components/prospecting/ProspectingBoard'
import { apolloConfigured } from '@/lib/prospecting/apollo'
import { lushaConfigured } from '@/lib/prospecting/lusha'
import type { Prospect } from '@/lib/prospecting/types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function ProspectingPage() {
  const db = createAdminClient() as any
  const { data } = await db
    .from('prospects')
    .select('*')
    .eq('status', 'saved')
    .order('created_at', { ascending: false })

  return <ProspectingBoard initialProspects={(data ?? []) as Prospect[]} connected={{ apollo: apolloConfigured(), lusha: lushaConfigured() }} />
}
