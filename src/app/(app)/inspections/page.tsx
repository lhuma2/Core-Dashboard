import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { scoreBand } from '@/lib/inspections/template'
import { ClipboardCheck, Plus, AlertTriangle, Share2 } from 'lucide-react'
import { DeleteInspectionButton } from '@/components/inspections/DeleteInspectionButton'

export const dynamic = 'force-dynamic'

const BAND_PILL: Record<string, string> = {
  pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  watch: 'bg-amber-50 text-amber-700 border-amber-200',
  fail: 'bg-red-50 text-red-700 border-red-200',
  none: 'bg-gray-50 text-gray-500 border-gray-200',
}

function auDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' })
}

export default async function InspectionsPage() {
  const db = createAdminClient() as any
  const { data: inspections } = await db
    .from('inspections')
    .select('id, site_label, score, rectifications, shared_with_client, inspected_at, inspector')
    .order('inspected_at', { ascending: false })
    .limit(100)

  const list: any[] = inspections ?? []
  const now = new Date()
  const monthCount = list.filter((i) => {
    const d = new Date(i.inspected_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  }).length
  const scored = list.filter((i) => i.score != null)
  const avg = scored.length ? Math.round(scored.reduce((s, i) => s + i.score, 0) / scored.length) : null
  const openFixes = list.reduce((n, i) => n + (i.rectifications?.length ?? 0), 0)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">{list.length} inspection{list.length !== 1 ? 's' : ''} on record</p>
        <Link href="/inspections/new" className="inline-flex items-center gap-1.5 bg-[#0b1320] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors">
          <Plus className="w-4 h-4" /> New inspection
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Avg score</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{avg != null ? `${avg}%` : '—'}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">This month</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{monthCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Open fixes</p>
          <p className={`text-2xl font-extrabold mt-1 ${openFixes > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{openFixes}</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <ClipboardCheck className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No inspections yet.</p>
          <p className="text-xs text-gray-400 mt-1">Start one on-site — it takes a few minutes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((i) => {
            const band = scoreBand(i.score)
            const fixes = i.rectifications?.length ?? 0
            return (
              <div key={i.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center hover:border-gray-300 transition-colors">
                <Link href={`/inspections/${i.id}`} className="flex-1 min-w-0 flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{i.site_label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{auDate(i.inspected_at)}</span>
                      {i.inspector && <span>· {i.inspector}</span>}
                      {fixes > 0 && <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" />{fixes} to fix</span>}
                      {i.shared_with_client && <span className="inline-flex items-center gap-1 text-[#1e3a5f]"><Share2 className="w-3 h-3" />Shared</span>}
                    </p>
                  </div>
                  <span className={`text-xs font-bold border rounded-full px-2.5 py-1 flex-shrink-0 ${BAND_PILL[band]}`}>{i.score != null ? `${i.score}%` : 'Draft'}</span>
                </Link>
                <div className="pr-3 pl-1 flex-shrink-0">
                  <DeleteInspectionButton id={i.id} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
