import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreInspection, scoreBand, type InspArea } from '@/lib/inspections/template'
import { InspectionActions } from '@/components/inspections/InspectionActions'
import { ArrowLeft, AlertTriangle, MapPin, User } from 'lucide-react'

export const dynamic = 'force-dynamic'

const BAND_RING: Record<string, string> = {
  pass: 'border-emerald-500 text-emerald-600', watch: 'border-amber-500 text-amber-600',
  fail: 'border-red-500 text-red-600', none: 'border-gray-200 text-gray-400',
}
const BAND_BAR: Record<string, string> = { pass: 'bg-emerald-500', watch: 'bg-amber-500', fail: 'bg-red-500', none: 'bg-gray-300' }

function auDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
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
      <Link href="/inspections" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> All inspections
      </Link>

      {/* Header + score */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center flex-shrink-0 ${BAND_RING[band]}`}>
            <span className="text-2xl font-extrabold">{overall != null ? `${overall}%` : '—'}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-extrabold text-gray-900 leading-tight">{insp.site_label}</h1>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{auDate(insp.inspected_at)}</span>
              {insp.inspector && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{insp.inspector}</span>}
            </p>
            <p className="text-sm text-gray-500 mt-1">{rectifications.length === 0 ? 'No issues found.' : `${rectifications.length} item${rectifications.length !== 1 ? 's' : ''} to rectify.`}</p>
          </div>
        </div>
      </div>

      {/* Per-area breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Area breakdown</p>
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
              <span className="w-10 text-right text-xs text-gray-400">{a.na ? 'N/A' : (a.score != null ? a.score : '–')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rectifications */}
      {rectifications.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> To rectify</p>
          <div className="space-y-2">
            {rectifications.map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.rating === 'fail' ? 'bg-red-500' : 'bg-amber-500'}`} />
                <span className="text-amber-900"><span className="font-semibold">{r.area}</span> — {r.label}{r.rating === 'fail' ? ' (fail)' : ''}{r.note ? <span className="text-amber-700"> · {r.note}</span> : null}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Photos</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <a key={i} href={p.url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.area} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Overall notes */}
      {insp.notes && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{insp.notes}</p>
        </div>
      )}

      <InspectionActions id={insp.id} shared={insp.shared_with_client} hasFixes={rectifications.length > 0} />
    </div>
  )
}
