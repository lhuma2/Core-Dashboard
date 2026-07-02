import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/actions/settings'
import { computeClientHealth } from '@/lib/health'
import { ClientTable } from '@/components/clients/ClientTable'
import { ClientFilters } from '@/components/clients/ClientFilters'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Plus } from 'lucide-react'
import type { ServiceType } from '@/types/app'

interface SearchParams {
  q?:       string
  status?:  string
  service?: string
  health?:  string
}

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
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
