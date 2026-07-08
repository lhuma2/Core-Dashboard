export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/actions/settings'
import { computeClientHealth } from '@/lib/health'
import { ClientTable } from '@/components/clients/ClientTable'
import { ClientFilters } from '@/components/clients/ClientFilters'
import { BondJobTable, type BondJobRow } from '@/components/clients/BondJobTable'
import { deleteBondJobAction } from '@/actions/bondJobs'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Plus } from 'lucide-react'
import type { ServiceType } from '@/types/app'

interface SearchParams {
  q?:       string
  status?:  string
  service?: string
  health?:  string
  tab?:     string
}

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const isBondTab = searchParams.tab === 'bond'

  if (isBondTab) {
    return <BondClientsTab />
  }

  const supabase = createClient()
  const settings = await getSettings()

  const [clientsRes, surveysRes, pendingTokensRes] = await Promise.all([
    (supabase as any).from('clients').select('*').order('business_name'),
    (supabase as any)
      .from('surveys')
      .select('client_id, quality_score, reliability_score, communication_score, value_score, nps_score, submitted_at')
      .order('submitted_at', { ascending: false }),
    (supabase as any)
      .from('survey_tokens')
      .select('client_id')
      .is('submitted_at', null),
  ])

  const rawClients: any[]    = clientsRes.data      || []
  const surveys:    any[]    = surveysRes.data       || []
  const pendingClientIds     = new Set((pendingTokensRes.data || []).map((t: any) => t.client_id))

  const surveyAvgs: Record<string, number | null> = {}
  for (const s of surveys) {
    if (surveyAvgs[s.client_id] === undefined) {
      const scores = [s.quality_score, s.reliability_score, s.communication_score, s.value_score, s.nps_score]
        .filter((x: any) => x != null) as number[]
      surveyAvgs[s.client_id] = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    }
  }

  const clients = rawClients.map(c => {
    const h = computeClientHealth(
      { ...c, profile_complete: c.profile_complete ?? false },
      surveyAvgs[c.id] ?? null,
      settings.margin_thresholds
    )
    return { ...c, healthStatus: h.status, latestSurveyAvg: surveyAvgs[c.id] ?? null, surveyPending: pendingClientIds.has(c.id) }
  })

  let filtered = clients

  if (searchParams.q) {
    const q = searchParams.q.toLowerCase()
    filtered = filtered.filter(c =>
      c.business_name.toLowerCase().includes(q) ||
      c.contact_name?.toLowerCase().includes(q) ||
      c.ref_number?.toLowerCase().includes(q)
    )
  }

  // Default view is active clients only; inactive are hidden unless explicitly requested.
  if (searchParams.status === 'inactive')  filtered = filtered.filter(c => !c.active)
  else if (searchParams.status !== 'all')  filtered = filtered.filter(c => c.active)

  if (searchParams.service) {
    filtered = filtered.filter(c =>
      (c.service_type as ServiceType[])?.includes(searchParams.service as ServiceType)
    )
  }

  if (searchParams.health) {
    filtered = filtered.filter(c => c.healthStatus === searchParams.health)
  }

  const activeCount = clients.filter(c => c.active).length
  const atRiskCount = clients.filter(c => c.active && c.healthStatus === 'at_risk').length
  const incomplete  = clients.filter(c => c.active && c.healthStatus === 'incomplete').length

  return (
    <div className="space-y-5">
      <ClientsTabBar active="commercial" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {activeCount} active · {clients.length} total
          {atRiskCount > 0 && (
            <span className="ml-2 text-red-600 font-medium">{atRiskCount} at risk</span>
          )}
          {incomplete > 0 && (
            <span className="ml-2 text-gray-500">· {incomplete} incomplete</span>
          )}
        </p>
        <Link href="/clients/new">
          <Button>
            <Plus className="w-4 h-4" />
            Add Client
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Suspense fallback={<div className="h-10" />}>
        <ClientFilters />
      </Suspense>

      {/* Table */}
      <Card padding={false}>
        <ClientTable clients={filtered} thresholds={settings.margin_thresholds} />
      </Card>

      {filtered.length === 0 && clients.length > 0 && (
        <p className="text-center text-sm text-gray-400 py-4">
          No clients match your filters.{' '}
          <Link href="/clients" className="text-blue-600 hover:underline">Clear filters</Link>
        </p>
      )}
    </div>
  )
}

function ClientsTabBar({ active }: { active: 'commercial' | 'bond' }) {
  const tabClass = (tab: 'commercial' | 'bond') =>
    `px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
      active === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
    }`

  return (
    <div className="inline-flex items-center gap-1 bg-gray-100 rounded-xl p-1">
      <Link href="/clients" className={tabClass('commercial')}>Commercial</Link>
      <Link href="/clients?tab=bond" className={tabClass('bond')}>Bond</Link>
    </div>
  )
}

async function BondClientsTab() {
  const supabase = createClient()
  const { data: rawJobs } = await (supabase as any)
    .from('bond_jobs')
    .select('id, client_name, address, contact_phone, clean_date, clean_time, cleaner_id, status, profiles!bond_jobs_cleaner_id_fkey(full_name)')
    .order('clean_date', { ascending: true })

  const jobs: BondJobRow[] = (rawJobs ?? []).map((j: any) => ({
    id:            j.id,
    client_name:   j.client_name,
    address:       j.address,
    contact_phone: j.contact_phone,
    clean_date:    j.clean_date,
    clean_time:    j.clean_time,
    comments:      null,
    cleaner_id:    j.cleaner_id,
    cleaner_name:  j.profiles?.full_name ?? null,
    status:        j.status ?? 'not_started',
  }))

  return (
    <div className="space-y-5">
      <ClientsTabBar active="bond" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">
          Bond / end-of-lease cleans · {jobs.length} scheduled
        </p>
        <Link href="/clients/bond/new">
          <Button>
            <Plus className="w-4 h-4" />
            Add Bond Clean
          </Button>
        </Link>
      </div>

      <Card padding={false}>
        <BondJobTable jobs={jobs} deleteAction={deleteBondJobAction} />
      </Card>
    </div>
  )
}
