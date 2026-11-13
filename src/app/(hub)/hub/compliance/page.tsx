import Link from 'next/link'
import { Back } from '@/components/hub/icons'
import { ComplianceList } from '@/components/hub/ComplianceList'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function CompliancePage() {
  // quick sets Laith saved (none before test-db update 070)
  const q = await (createClient() as any).from('compliance_sets').select('id, name, doc_ids').order('created_at')
  const saved = q.error ? [] : ((q.data || []) as any[]).map(s => ({ id: s.id as string, name: s.name as string, ids: (s.doc_ids || []) as string[] }))
  return <><Link className="back" href="/hub"><Back /> Dashboard</Link><ComplianceList saved={saved} /></>
}
