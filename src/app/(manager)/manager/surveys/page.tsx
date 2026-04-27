import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function ScoreDot({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>
  const color = score >= 8 ? 'text-black' : score >= 6 ? 'text-gray-600' : 'text-gray-400'
  return <span className={`text-sm font-bold ${color}`}>{score}</span>
}

function MetricTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-white rounded-2xl px-3 py-4 text-center">
      <p className="text-xl font-bold text-black">
        {value != null ? value.toFixed(1) : '—'}
      </p>
      <p className="text-[10px] text-gray-400 mt-1 leading-tight">{label}</p>
    </div>
  )
}

export default async function ManagerSurveysPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: surveys } = await (supabase as any)
    .from('surveys')
    .select('*, clients(id, business_name)')
    .order('submitted_at', { ascending: false })
    .limit(50)

  const allSurveys: any[] = surveys ?? []

  // Category averages across all surveys
  function colAvg(field: string): number | null {
    const vals = allSurveys.map((s: any) => s[field]).filter((v: any) => v != null) as number[]
    if (!vals.length) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }

  const qualityAvg     = colAvg('quality_score')
  const reliabilityAvg = colAvg('reliability_score')
  const commsAvg       = colAvg('communication_score')
  const valueAvg       = colAvg('value_score')

  const overallAvg = (() => {
    const present = [qualityAvg, reliabilityAvg, commsAvg, valueAvg].filter((v) => v != null) as number[]
    if (!present.length) return null
    return present.reduce((a, b) => a + b, 0) / present.length
  })()

  // Lowest performing client (avg of all 4 score cols per client)
  type ClientScore = { id: string; name: string; avg: number }
  const clientScoreMap = new Map<string, { name: string; totals: number[]; }>()

  for (const s of allSurveys) {
    if (!s.clients?.id) continue
    const scores = [s.quality_score, s.reliability_score, s.communication_score, s.value_score]
      .filter((v) => v != null) as number[]
    if (!scores.length) continue
    const entry = clientScoreMap.get(s.clients.id)
    if (entry) {
      entry.totals.push(...scores)
    } else {
      clientScoreMap.set(s.clients.id, { name: s.clients.business_name ?? 'Unknown', totals: scores })
    }
  }

  let lowestClientMut: ClientScore | null = null
  Array.from(clientScoreMap.entries()).forEach(([id, { name, totals }]) => {
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length
    if (!lowestClientMut || avg < lowestClientMut.avg) {
      lowestClientMut = { id, name, avg }
    }
  })
  const lowestClient = lowestClientMut as ClientScore | null

  return (
    <>

      {/* Category averages */}
      {allSurveys.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Category Averages · {allSurveys.length} survey{allSurveys.length !== 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-5 gap-2 mb-3">
            <MetricTile label="Quality"     value={qualityAvg} />
            <MetricTile label="Reliability" value={reliabilityAvg} />
            <MetricTile label="Comms"       value={commsAvg} />
            <MetricTile label="Value"       value={valueAvg} />
            <div className="bg-black rounded-2xl px-3 py-4 text-center">
              <p className="text-xl font-bold text-white">
                {overallAvg != null ? overallAvg.toFixed(1) : '—'}
              </p>
              <p className="text-[10px] text-gray-300 mt-1 leading-tight">Overall</p>
            </div>
          </div>

          {/* Lowest performing client */}
          {lowestClient && (
            <Link href={`/manager/clients/${lowestClient.id}`}>
              <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
                    Lowest Performing Client
                  </p>
                  <p className="text-sm font-semibold text-black">{lowestClient.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xl font-bold text-black">{lowestClient.avg.toFixed(1)}</p>
                    <p className="text-[10px] text-gray-400">avg score</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Survey list */}
      <div className="space-y-2">
        {allSurveys.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">No surveys yet</div>
        )}
        {allSurveys.map((survey: any) => {
          const scores = [survey.quality_score, survey.reliability_score, survey.communication_score, survey.value_score, survey.nps_score]
            .filter((x) => x != null) as number[]
          const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
          const atRisk = scores.some((s) => s < 7)

          return (
            <div key={survey.id} className="bg-white rounded-2xl px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-black">
                      {survey.clients?.business_name ?? 'Unknown'}
                    </p>
                    {atRisk && (
                      <span className="text-[10px] font-semibold border border-gray-300 text-gray-500 px-2 py-0.5 rounded-full">
                        At Risk
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(survey.submitted_at).toLocaleDateString('en-AU', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  {/* Score breakdown */}
                  <div className="flex items-center gap-4 mt-2">
                    {[
                      { label: 'Quality',     val: survey.quality_score },
                      { label: 'Reliability', val: survey.reliability_score },
                      { label: 'Comms',       val: survey.communication_score },
                      { label: 'Value',       val: survey.value_score },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <ScoreDot score={item.val} />
                        <p className="text-[9px] text-gray-400 mt-0.5">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  {survey.notes && (
                    <p className="text-xs text-gray-500 mt-2 italic">"{survey.notes}"</p>
                  )}
                </div>
                {avg != null && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-xl font-bold text-black">{avg.toFixed(1)}</p>
                    <p className="text-[10px] text-gray-400">avg</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
