'use client'
import { useState } from 'react'
import Link from 'next/link'
import { sendClientRequest } from '@/actions/client-portal'
import { setFlash } from '@/lib/hub/flash'
import { RQ_SERVICES, type PortalClean, type PortalSite, type RqDef } from '@/lib/clientapp/portal'

const Back = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>

export function ClientRequestForm({ t, sites, recent, today }: { t: RqDef; sites: PortalSite[]; recent: PortalClean[]; today: string }) {
  const [clean, setClean] = useState('')
  const [service, setService] = useState('')
  const [site, setSite] = useState(sites[0]?.id || '')
  const [date, setDate] = useState('')
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const ch = <T,>(f: (v: T) => void) => (v: T) => { f(v); setErr('') }

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    if (t.clean && !recent.some(r => r.key === clean)) { setErr('Choose which clean.'); return }
    if (t.service && !service) { setErr('Choose which service.'); return }
    if (t.date === 'req' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) { setErr('Choose the day.'); return }
    if (t.date && date && date < today) { setErr('That date is in the past.'); return }
    if (t.textReq && text.trim().replace(/\s+/g, ' ').length < 5) { setErr('Add a few words so we know what you need.'); return }
    setBusy(true); setErr('')
    try {
      const r = await sendClientRequest({ kind: t.id, site, service, clean, date, text })
      if (!r.ok) { setErr(r.error); setBusy(false); return }
      setFlash(r.toast)
      window.location.replace('/client/app?tab=requests')
    } catch { setErr('That didn’t send. Check your connection and try again.'); setBusy(false) }
  }

  return (
    <>
      <Link className="back" href="/client/app?tab=requests"><Back /> Requests</Link>
      <form className="stack" onSubmit={send} noValidate>
        <div><h1 className="h1">{t.label}</h1><p className="hint">{t.sub}</p></div>
        {t.clean && (
          <label className="fld"><span>Which clean?</span>
            <select value={clean} onChange={e => ch(setClean)(e.target.value)}>
              <option value="">Choose a clean</option>
              {recent.map(r => <option key={r.key} value={r.key}>{r.day + ' ' + r.date + ' · ' + r.site}</option>)}
            </select>
          </label>
        )}
        {t.clean && !recent.length && <p className="hint">There are no finished cleans in the last few weeks to choose from. Use Something else instead, or call us.</p>}
        {t.service && (
          <label className="fld"><span>Which service?</span>
            <select value={service} onChange={e => ch(setService)(e.target.value)}>
              <option value="">Choose a service</option>
              {RQ_SERVICES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
        {t.site && sites.length > 1 && (
          <label className="fld"><span>Which site?</span>
            <select value={site} onChange={e => ch(setSite)(e.target.value)}>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="all">{sites.length === 2 ? 'Both sites' : 'All sites'}</option>
            </select>
          </label>
        )}
        {t.date && <label className="fld"><span>{t.dateLabel}</span><input type="date" min={today} value={date} onChange={e => ch(setDate)(e.target.value)} /></label>}
        <label className="fld"><span>{t.textLabel}</span><textarea maxLength={2000} value={text} onChange={e => ch(setText)(e.target.value)} placeholder={t.ph} /></label>
        {t.note && <p className="hint">{t.note}</p>}
        {err && <p className="ferr" role="alert">{err}</p>}
        <button type="submit" className="btn main" disabled={busy}>{busy ? 'Sending…' : 'Send to Core Cleaning'}</button>
        <p className="hint">For anything urgent on the night, call 0407 026 360.</p>
      </form>
    </>
  )
}
