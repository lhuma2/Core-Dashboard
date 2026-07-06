'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Camera, Check, Loader2, X, ShieldCheck, AlertTriangle } from 'lucide-react'
import { blankAreas, scoreInspection, scoreBand, RATING_LABEL, type InspArea, type Rating } from '@/lib/inspections/template'
import { saveInspectionAction } from '@/actions/inspections'

interface ClientRow { id: string; business_name: string; is_multi_site: boolean; address?: string | null; suburb?: string | null }
interface SiteRow { id: string; client_id: string; site_name: string; suburb?: string | null }

const BAND_COLOR: Record<string, string> = {
  pass: 'text-emerald-600', watch: 'text-amber-600', fail: 'text-red-600', none: 'text-gray-300',
}
const RATING_STYLE: Record<Rating, { on: string; off: string }> = {
  pass:  { on: 'bg-emerald-600 text-white border-emerald-600', off: 'text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  minor: { on: 'bg-amber-500 text-white border-amber-500',     off: 'text-amber-700 border-amber-200 hover:bg-amber-50' },
  fail:  { on: 'bg-red-600 text-white border-red-600',         off: 'text-red-700 border-red-200 hover:bg-red-50' },
}

export function InspectionForm({ clients, sites }: { clients: ClientRow[]; sites: SiteRow[] }) {
  const router = useRouter()
  const [clientId, setClientId] = useState('')
  const [siteId, setSiteId] = useState('')
  const [areas, setAreas] = useState<InspArea[]>(blankAreas())
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = clients.find((c) => c.id === clientId)
  const clientSites = useMemo(() => sites.filter((s) => s.client_id === clientId), [sites, clientId])
  const needsSite = !!client?.is_multi_site

  const { overall, rectifications } = useMemo(() => scoreInspection(areas), [areas])
  const band = scoreBand(overall)
  const ratedCount = areas.reduce((n, a) => n + a.items.filter((it) => it.rating).length, 0)

  function setRating(ai: number, ii: number, rating: Rating) {
    setAreas((prev) => prev.map((a, x) => x !== ai ? a : {
      ...a, items: a.items.map((it, y) => y !== ii ? it : { ...it, rating: it.rating === rating ? null : rating }),
    }))
  }
  function setNote(ai: number, note: string) {
    setAreas((prev) => prev.map((a, x) => x !== ai ? a : { ...a, note }))
  }
  function removePhoto(ai: number, url: string) {
    setAreas((prev) => prev.map((a, x) => x !== ai ? a : { ...a, photos: (a.photos ?? []).filter((p) => p !== url) }))
  }
  function toggleNa(ai: number) {
    setAreas((prev) => prev.map((a, x) => x !== ai ? a : { ...a, na: !a.na }))
  }

  async function addPhoto(ai: number, file: File) {
    try {
      const supabase = createClient() as any
      const path = `inspections/${clientId || 'unassigned'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
      const { error: upErr } = await supabase.storage.from('job-photos').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
      if (upErr) { setError(upErr.message); return }
      const { data } = supabase.storage.from('job-photos').getPublicUrl(path)
      setAreas((prev) => prev.map((a, x) => x !== ai ? a : { ...a, photos: [...(a.photos ?? []), data.publicUrl as string] }))
    } catch { setError('Photo upload failed.') }
  }

  async function submit() {
    setError(null)
    if (!clientId) { setError('Please choose a client.'); return }
    if (needsSite && !siteId) { setError('Please choose which site you inspected.'); return }
    if (ratedCount === 0) { setError('Score at least one item before saving.'); return }

    const site = clientSites.find((s) => s.id === siteId)
    const siteLabel = needsSite && site ? `${client!.business_name} — ${site.site_name}` : client!.business_name

    setBusy(true)
    const res = await saveInspectionAction({ clientId, siteId: needsSite ? siteId : null, siteLabel, areas, notes })
    setBusy(false)
    if (res?.error) { setError(res.error); return }
    router.push(`/inspections/${res.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto pb-28">
      {/* Running score — a contained sticky card (renders cleanly on desktop + mobile) */}
      <div className="sticky top-16 z-20 mb-3 bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Running score</p>
          <p className="text-xs text-gray-500">{ratedCount} item{ratedCount !== 1 ? 's' : ''} scored{rectifications.length > 0 ? ` · ${rectifications.length} to fix` : ''}</p>
        </div>
        <div className={`text-3xl font-extrabold tabular-nums ${BAND_COLOR[band]}`}>{overall != null ? `${overall}%` : '—'}</div>
      </div>

      {/* Client + site */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 block mb-1">Client</label>
          <select value={clientId} onChange={(e) => { setClientId(e.target.value); setSiteId('') }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">Select a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}{c.is_multi_site ? ' (multi-site)' : ''}</option>)}
          </select>
        </div>
        {needsSite && (
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Site</label>
            <select value={siteId} onChange={(e) => setSiteId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
              <option value="">Select the site inspected…</option>
              {clientSites.map((s) => <option key={s.id} value={s.id}>{s.site_name}{s.suburb ? ` · ${s.suburb}` : ''}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Areas */}
      <div className="space-y-3 mt-3">
        {areas.map((a, ai) => {
          const areaRects = a.items.filter((it) => it.rating === 'minor' || it.rating === 'fail').length
          return (
            <div key={a.key} className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-4 ${a.na ? 'opacity-70' : ''}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-bold text-gray-900">{a.name}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!a.na && areaRects > 0 && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600"><AlertTriangle className="w-3.5 h-3.5" />{areaRects}</span>}
                  <button type="button" onClick={() => toggleNa(ai)}
                    className={`text-[11px] font-semibold rounded-full px-2.5 py-1 border transition-colors ${a.na ? 'bg-gray-800 text-white border-gray-800' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
                    N/A
                  </button>
                </div>
              </div>

              {a.na ? (
                <p className="text-xs text-gray-400 py-1">Not applicable at this site — excluded from the score.</p>
              ) : (
                <>
                  <div className="divide-y divide-gray-100">
                    {a.items.map((it, ii) => (
                      <div key={it.key} className="flex items-center justify-between gap-2 py-2">
                        <span className="text-[13px] text-gray-700 min-w-0">{it.label}</span>
                        <div className="flex gap-1 flex-shrink-0">
                          {(['pass', 'minor', 'fail'] as Rating[]).map((r) => (
                            <button key={r} type="button" onClick={() => setRating(ai, ii, r)}
                              className={`text-[11px] font-semibold border rounded-full px-2.5 py-1 transition-colors ${it.rating === r ? RATING_STYLE[r].on : `bg-white ${RATING_STYLE[r].off}`}`}>
                              {RATING_LABEL[r]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Note + photos */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(a.photos ?? []).map((url) => (
                      <div key={url} className="relative w-14 h-14 rounded-lg overflow-hidden border border-gray-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Inspection" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removePhoto(ai, url)} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5">
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    <label className="w-14 h-14 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-gray-400 cursor-pointer hover:border-gray-400">
                      <Camera className="w-5 h-5" />
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto(ai, f); e.target.value = '' }} />
                    </label>
                  </div>
                  <input value={a.note ?? ''} onChange={(e) => setNote(ai, e.target.value)} placeholder="Note (optional)"
                    className="w-full mt-2 rounded-lg border border-gray-200 px-3 py-2 text-[13px]" />
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Overall notes */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mt-3">
        <label className="text-xs font-semibold text-gray-500 block mb-1">Overall notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" placeholder="Anything worth recording for this visit…" />
      </div>

      {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-600">{error}</div>}

      {/* Submit */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-56 z-30 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <span className="text-sm text-gray-400">Score <span className={`font-bold ${BAND_COLOR[band]}`}>{overall != null ? `${overall}%` : '—'}</span></span>
          <button onClick={submit} disabled={busy}
            className="inline-flex items-center gap-2 bg-[#003314] hover:bg-[#00250e] text-white text-sm font-semibold rounded-xl px-6 py-3 disabled:opacity-50 transition-colors">
            {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><ShieldCheck className="w-4 h-4" /> Complete inspection</>}
          </button>
        </div>
      </div>
    </div>
  )
}
