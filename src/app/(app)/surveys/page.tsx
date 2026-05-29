import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SurveyTable } from '@/components/surveys/SurveyTable'
import { SurveyTrendChart } from '@/components/charts/SurveyTrendChart'
import { PendingSurveys } from '@/components/surveys/PendingSurveys'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { StatCard } from '@/components/ui/StatCard'
import { AlertTriangle } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function SurveysPage({
  searchParams,
}: {
  searchParams: { client?: string; risk?: string }
}) {
  const supabase = createClient()

  const [surveysRes, clientsRes, pendingRes] = await Promise.all([
    supabase
      .from('surveys')
      .select('*, clients(business_name, ref_number)')
      .order('submitted_at', { ascending: false }),
    supabase.from('clients').select('id, business_name').eq('active', true).order('business_name'),
    (supabase as any)
      .from('survey_tokens')
      .select('id, token, created_at, clients(id, business_name, contact_name, contact_email)')
      .is('submitted_at', null)
      .order('created_at', { ascending: false }),
  ])

  let surveys = surveysRes.data || []
  const pending: any[] = pendingRes.data || []

  if (searchParams.client) {
    surveys = surveys.filter((s) => s.client_id === searchParams.client)
  }

  if (searchParams.risk === '1') {
    surveys = surveys.filter((s) =>
      [s.quality_score, s.reliability_score, s.communication_score, s.value_score]
        .some((x) => x != null && x < 7)
    )
  }

  const clients = clientsRes.data || []

  // Averages
  const count = surveys.length
  const avgQuality = count ? surveys.reduce((s, r) => s + (r.quality_score || 0), 0) / count : 0
  const avgReliability = count ? surveys.reduce((s, r) => s + (r.reliability_score || 0), 0) / count : 0
  const avgComms = count ? surveys.reduce((s, r) => s + (r.communication_score || 0), 0) / count : 0
  const avgValue = count ? surveys.reduce((s, r) => s + (r.value_score || 0), 0) / count : 0
  const atRiskCount = surveys.filter((s) =>
    [s.quality_score, s.reliability_score, s.communication_score, s.value_score]
      .some((x) => x != null && x < 7)
  ).length

  // Chart: recent trend (last 10 surveys)
  const trendData = [...surveys]
    .sort((a, b) => new Date(a.submitted_at || 0).getTime() - new Date(b.submitted_at || 0).getTime())
    .slice(-10)
    .map((s) => ({
      date: s.submitted_at || '',
      quality: s.quality_score,
      reliability: s.reliability_score,
      communication: s.communication_score,
      value: s.value_score,
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {count} response{count !== 1 ? 's' : ''} · {pending.length} awaiting response
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Quality Avg" value={`${avgQuality.toFixed(1)}/10`} subvalue="All surveys" />
        <StatCard label="Reliability Avg" value={`${avgReliability.toFixed(1)}/10`} />
        <StatCard label="Communication Avg" value={`${avgComms.toFixed(1)}/10`} />
        <StatCard label="Value Avg" value={`${avgValue.toFixed(1)}/10`} />
        <StatCard
          label="At-Risk Clients"
          value={atRiskCount}
          subvalue="Score < 7 on any metric"
          icon={AlertTriangle}
          className={atRiskCount > 0 ? 'border-red-200 bg-red-50' : ''}
        />
      </div>

      {/* Pending surveys */}
      {pending.length > 0 && <PendingSurveys pending={pending} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Link href="/surveys" className={`text-sm px-3 py-1.5 rounded-lg border transition ${!searchParams.risk && !searchParams.client ? 'bg-brand-navy text-white border-brand-navy' : 'border-gray-300 text-gray-600'}`}>
          All Responses
        </Link>
        <Link href="/surveys?risk=1" className={`text-sm px-3 py-1.5 rounded-lg border transition flex items-center gap-1 ${searchParams.risk === '1' ? 'bg-red-600 text-white border-red-600' : 'border-gray-300 text-gray-600'}`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          At Risk Only
        </Link>
        <span className="text-gray-300">|</span>
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/surveys?client=${c.id}`}
            className={`text-sm px-3 py-1.5 rounded-lg border transition ${searchParams.client === c.id ? 'bg-brand-navy text-white border-brand-navy' : 'border-gray-300 text-gray-600'}`}
          >
            {c.business_name}
          </Link>
        ))}
      </div>

      {/* Trend chart */}
      {trendData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Score Trend (Recent Surveys)</CardTitle>
          </CardHeader>
          <SurveyTrendChart data={trendData} />
        </Card>
      )}

      {/* Completed table */}
      {surveys.length > 0 && (
        <Card padding={false}>
          <SurveyTable surveys={surveys as Parameters<typeof SurveyTable>[0]['surveys']} />
        </Card>
      )}
    </div>
  )
}
