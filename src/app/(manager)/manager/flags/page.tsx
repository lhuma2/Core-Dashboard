import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ResolveButton } from '@/components/portal/manager/ResolveButton'
import { AlertTriangle, MessageSquare } from 'lucide-react'

function ScoreDot({ score }: { score: number | null }) {
  if (score == null) return <span className="text-gray-300 text-xs">—</span>
  const color = score >= 8 ? 'text-black' : score >= 6 ? 'text-gray-600' : 'text-gray-400'
  return <span className={`text-sm font-bold ${color}`}>{score}</span>
}

function MetricTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-white rounded-2xl px-3 py-4 text-center">
      <p className="text-xl font-bold text-black">{value != null ? value.toFixed(1) : '—'}</p>
      <p className="text-[10px] text-gray-400 mt-1 leading-tight">{label}</p>
    </div>
  )
}

export default async function ManagerFlagsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: flags }, { data: issues }, { data: surveys }, { data: unassignedClients }] = await Promise.all([
    (supabase as any)
      .from('job_flags')
      .select('*, job_assignments(scheduled_date, clients(business_name)), profiles!job_flags_cleaner_id_fkey(full_name)')
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('client_issues')
      .select('*, clients(business_name)')
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('surveys')
      .select('*, clients(id, business_name)')
      .order('submitted_at', { ascending: false })
      .limit(50),
    (supabase as any)
      .from('clients')
      .select('id, business_name')
      .eq('active', true)
      .is('assigned_cleaner_id', null)
      .order('business_name'),
  ])

  const openFlags    = (flags   ?? []).filter((f: any) => !f.resolved)
  const closedFlags  = (flags   ?? []).filter((f: any) =>  f.resolved)
  const openIssues   = (issues  ?? []).filter((i: any) => !i.resolved)
  const closedIssues = (issues  ?? []).filter((i: any) =>  i.resolved)
  const allSurveys: any[] = surveys ?? []

  // Survey averages
  function colAvg(field: string) {
    const vals = allSurveys.map((s: any) => s[field]).filter((v: any) => v != null) as number[]
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }
  const qualityAvg     = colAvg('quality_score')
  const reliabilityAvg = colAvg('reliability_score')
  const commsAvg       = colAvg('communication_score')
  const valueAvg       = colAvg('value_score')
  const overallAvg = (() => {
    const present = [qualityAvg, reliabilityAvg, commsAvg, valueAvg].filter((v) => v != null) as number[]
    return present.length ? present.reduce((a, b) => a + b, 0) / present.length : null
  })()

  // Lowest performing client
  type ClientScore = { id: string; name: string; avg: number }
  const clientScoreMap = new Map<string, { name: string; totals: number[] }>()
  for (const s of allSurveys) {
    if (!s.clients?.id) continue
    const scores = [s.quality_score, s.reliability_score, s.communication_score, s.value_score]
      .filter((v) => v != null) as number[]
    if (!scores.length) continue
    const entry = clientScoreMap.get(s.clients.id)
    if (entry) entry.totals.push(...scores)
    else clientScoreMap.set(s.clients.id, { name: s.clients.business_name ?? 'Unknown', totals: scores })
  }
  let lowestMut: ClientScore | null = null
  Array.from(clientScoreMap.entries()).forEach(([id, { name, totals }]) => {
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length
    if (!lowestMut || avg < lowestMut.avg) lowestMut = { id, name, avg }
  })
  const lowestClient = lowestMut as ClientScore | null

  const unassigned: any[] = unassignedClients ?? []

  return (
    <>

      {/* ── Unassigned Clients ────────────────────────────── */}
      {unassigned.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Unassigned Clients · {unassigned.length}
          </p>
          <div className="space-y-2">
            {unassigned.map((client: any) => (
              <Link key={client.id} href={`/manager/clients/${client.id}`} className="block">
                <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors border border-dashed border-gray-300">
                  <div>
                    <p className="text-sm font-semibold text-black">{client.business_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">No cleaner assigned</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Cleaner Flags ─────────────────────────────────── */}
      <section className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Cleaner Flags · {openFlags.length} open
        </p>
        {openFlags.length === 0 && closedFlags.length === 0 && (
          <p className="text-sm text-gray-400 py-2">No flags reported.</p>
        )}
        <div className="space-y-2">
          {[...openFlags, ...closedFlags].map((flag: any) => (
            <div key={flag.id} className={`bg-white rounded-2xl px-5 py-4 ${flag.resolved ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <p className="text-xs text-gray-500 font-medium truncate">
                      {flag.job_assignments?.clients?.business_name ?? 'Unknown client'}
                    </p>
                    <p className="text-xs text-gray-400">·</p>
                    <p className="text-xs text-gray-400">
                      {new Date(flag.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <p className="text-sm text-black">{flag.description}</p>
                  {flag.profiles?.full_name && (
                    <p className="text-xs text-gray-400 mt-1">By {flag.profiles.full_name}</p>
                  )}
                  {flag.resolved && <p className="text-xs text-gray-400 mt-1">✓ Resolved</p>}
                </div>
                {!flag.resolved && <ResolveButton flagId={flag.id} type="flag" />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Client Issues ─────────────────────────────────── */}
      <section className="mb-10">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Client Issues · {openIssues.length} open
        </p>
        {openIssues.length === 0 && closedIssues.length === 0 && (
          <p className="text-sm text-gray-400 py-2">No client issues reported.</p>
        )}
        <div className="space-y-2">
          {[...openIssues, ...closedIssues].map((issue: any) => (
            <div key={issue.id} className={`bg-white rounded-2xl px-5 py-4 ${issue.resolved ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                    <p className="text-xs text-gray-500 font-medium truncate">
                      {issue.clients?.business_name ?? 'Unknown client'}
                    </p>
                    <p className="text-xs text-gray-400">·</p>
                    <p className="text-xs text-gray-400">
                      {new Date(issue.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <p className="text-sm text-black">{issue.description}</p>
                  {issue.resolved && <p className="text-xs text-gray-400 mt-1">✓ Resolved</p>}
                </div>
                {!issue.resolved && <ResolveButton flagId={issue.id} type="issue" />}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Surveys ───────────────────────────────────────── */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          Surveys · {allSurveys.length}
        </p>

        {/* Averages grid */}
        {allSurveys.length > 0 && (
          <div className="mb-4">
            <div className="grid grid-cols-5 gap-2 mb-3">
              <MetricTile label="Quality"     value={qualityAvg} />
              <MetricTile label="Reliability" value={reliabilityAvg} />
              <MetricTile label="Comms"       value={commsAvg} />
              <MetricTile label="Value"       value={valueAvg} />
              <div className="bg-black rounded-2xl px-3 py-4 text-center">
                <p className="text-xl font-bold text-white">{overallAvg != null ? overallAvg.toFixed(1) : '—'}</p>
                <p className="text-[10px] text-gray-300 mt-1 leading-tight">Overall</p>
              </div>
            </div>

            {lowestClient && (
              <Link href={`/manager/clients/${lowestClient.id}`}>
                <div className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-3 active:bg-gray-50 transition-colors mb-4">
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
            <p className="text-sm text-gray-400 py-2">No surveys yet.</p>
          )}
          {allSurveys.map((survey: any) => {
            const scores = [survey.quality_score, survey.reliability_score, survey.communication_score, survey.value_score, survey.nps_score]
              .filter((x) => x != null) as number[]
            const avg    = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
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
      </section>
    </>
  )
}
