import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreInspection, scoreBand, type InspArea } from '@/lib/inspections/template'
import { InspectionActions } from '@/components/inspections/InspectionActions'
import { ArrowLeft } from 'lucide-react'

export const dynamic = 'force-dynamic'

const BAND_TEXT: Record<string, string> = {
  pass: 'text-emerald-600', watch: 'text-amber-600', fail: 'text-red-600', none: 'text-gray-400',
}
const BAND_LABEL: Record<string, string> = {
  pass: 'Passed', watch: 'Watch', fail: 'Needs attention', none: 'Not scored',
}
const BAND_BAR: Record<string, string> = { pass: 'bg-emerald-500', watch: 'bg-amber-500', fail: 'bg-red-500', none: 'bg-gray-300' }

function auDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
}

function SectionLabel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-[11px] font-semibold uppercase tracking-widest mb-3 ${className || 'text-gray-400'}`}>{children}</p>
}

export default async function InspectionReportPage({ params }: { params: { id: string } }) {
  const db = createAdminClient() as any
  const { data: insp } = await db.from('inspections').select('*').eq('id', params.id).maybeSingle()
  if (!insp) notFound()

  const areas: InspArea[] = insp.areas ?? []
  const { overall, perArea, rectifications } = scoreInspection(areas)
  const band = scoreBand(overall)
  const photos = areas.flatMap((a) => (a.photos ?? []).map((url) => ({ url, area: a.name })))

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/inspections" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-2">
        <ArrowLeft className="w-4 h-4" /> All inspections
      </Link>

      {/* Hero */}
      <div className="text-center pt-6 pb-8">
        <p className={`text-6xl font-extrabold tracking-tight tabular-nums ${BAND_TEXT[band]}`}>{overall != null ? `${overall}%` : '—'}</p>
        <p className={`text-sm font-semibold mt-1 ${BAND_TEXT[band]}`}>{BAND_LABEL[band]}</p>
        <h1 className="text-lg font-bold text-gray-900 mt-4">{insp.site_label}</h1>
        <p className="text-xs text-gray-400 mt-1">{auDate(insp.inspected_at)}{insp.inspector ? ` · ${insp.inspector}` : ''}</p>
        <p className="text-sm text-gray-500 mt-3">
          {rectifications.length === 0 ? 'No issues found.' : `${rectifications.length} item${rectifications.length !== 1 ? 's' : ''} to rectify.`}
        </p>
      </div>

      {/* One card, divided sections */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {/* Area breakdown */}
        <div className="p-5">
          <SectionLabel>Area breakdown</SectionLabel>
          <div className="space-y-2.5">
            {perArea.map((a) => (
              <div key={a.key} className="flex items-center gap-3">
                <span className="w-40 text-[13px] text-gray-600 truncate">{a.name}</span>
                {a.na ? (
                  <span className="flex-1 text-xs text-gray-400">Not applicable</span>
                ) : (
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    {a.score != null && <div className={`h-full rounded-full ${BAND_BAR[scoreBand(a.score)]}`} style={{ width: `${a.score}%` }} />}
                  </div>
                )}
                <span className="w-10 text-right text-xs text-gray-400 tabular-nums">{a.na ? 'N/A' : (a.score != null ? a.score : '–')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* To rectify */}
        {rectifications.length > 0 && (
          <div className="p-5">
            <SectionLabel className="text-amber-600">To rectify · {rectifications.length}</SectionLabel>
            <div className="space-y-2.5">
              {rectifications.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.rating === 'fail' ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <span className="text-gray-700">
                    <span className="font-semibold text-gray-900">{r.area}</span> — {r.label}{r.rating === 'fail' ? ' (fail)' : ''}
                    {r.note ? <span className="text-gray-400"> · {r.note}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <div className="p-5">
            <SectionLabel>Photos · {photos.length}</SectionLabel>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {photos.map((p, i) => (
                <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.area} className="w-full h-full object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {insp.notes && (
          <div className="p-5">
            <SectionLabel>Notes</SectionLabel>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{insp.notes}</p>
          </div>
        )}
      </div>

      <div className="mt-4">
        <InspectionActions id={insp.id} shared={insp.shared_with_client} hasFixes={rectifications.length > 0} />
      </div>
    </div>
  )
}
