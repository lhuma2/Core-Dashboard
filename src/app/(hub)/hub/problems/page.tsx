import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Back } from '@/components/hub/icons'
import { ProblemList, type Problem } from '@/components/hub/ProblemList'

export const dynamic = 'force-dynamic'

export default async function ProblemsPage({ searchParams }: { searchParams: { show?: string } }) {
  const supabase = createClient() as any
  const COLS = `id, body, created_at, resolved_at,
      cleaner:profiles!issues_cleaner_id_fkey(full_name, phone),
      client:clients(business_name), site:client_sites(site_name), home:homes(name), job:jobs(clean_date)`
  const q = (cols: string) => supabase.from('issues').select(cols).order('created_at', { ascending: false }).limit(500)
  let { data, error } = await q(COLS + ', from_client')
  // before test-db update 068 there's no from_client column
  if (error) ({ data, error } = await q(COLS))

  const problems: Problem[] = (data ?? []).map((r: any) => ({
    id: r.id,
    body: r.body,
    createdAt: r.created_at,
    fixed: !!r.resolved_at,
    resolvedAt: r.resolved_at,
    where: [r.client?.business_name ?? r.home?.name ?? 'No client', r.site?.site_name].filter(Boolean).join(' · '),
    cleaner: r.from_client ? 'The client, from their portal' : r.cleaner?.full_name ?? 'A cleaner',
    phone: r.cleaner?.phone ?? '',
    cleanDate: r.job?.clean_date ?? null,
  }))

  return (
    <>
      <Link className="back" href="/hub"><Back /> Dashboard</Link>
      <h1 className="greet">Problems reported</h1>
      {error
        ? <p className="err" role="alert">The problems couldn’t load just now. Refresh the page to try again.</p>
        : <ProblemList problems={problems} initial={searchParams.show === 'fixed' ? 'fixed' : 'open'} />}
    </>
  )
}
