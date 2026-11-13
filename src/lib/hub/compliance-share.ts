import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { COMPLIANCE_DOCS, type ComplianceDoc } from './compliance-docs'

/** The documents a share link shows, in the pack's order. Null if there's no such link. */
export async function sharedDocs(code: string): Promise<ComplianceDoc[] | null> {
  if (!/^[2-9a-z]{6,16}$/.test(code || '')) return null
  const { data } = await (createAdminClient() as any).from('compliance_links').select('doc_ids').eq('code', code).maybeSingle()
  if (!data) return null
  const ids = new Set<string>(data.doc_ids || [])
  const docs = COMPLIANCE_DOCS.filter(d => ids.has(d.id))
  return docs.length ? docs : null
}
