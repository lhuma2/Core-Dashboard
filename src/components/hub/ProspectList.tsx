'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { callLead, logLead, undoLeadLog, deleteLead, restoreLead, importLeads } from '@/actions/hub-prospecting'
import { LEAD_CHIPS, inLeadF, leadTag, type Lead, type LeadF } from '@/lib/hub/prospecting'

const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const Phone = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>
const Up = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>

export function ProspectList({ leads, initial }: { leads: Lead[]; initial: LeadF }) {
  const router = useRouter()
  const [, start] = useTransition()
  const [f, setF] = useState<LeadF>(initial)
  const [menu, setMenu] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<{ text: string; undo?: () => Promise<void> } | null>(null)
  const [extra, setExtra] = useState<Record<string, number>>({}) // calls counted on this screen, until the refresh lands
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => { setExtra({}) }, [leads])
  const refresh = () => start(() => router.refresh())
  const shown = leads.filter(l => inLeadF(l, f))

  async function run<T extends { ok: boolean }>(key: string, fn: () => Promise<T>, then: (r: T) => void) {
    setBusy(key)
    try {
      const r = await fn()
      if (!r.ok) { setToast({ text: (r as any).error }); return }
      then(r); refresh()
    } catch { setToast({ text: NO_DB }) } finally { setBusy(null) }
  }
  const pick = (id: LeadF) => { setF(id); setMenu(null); setConfirm(null) }

  return (
    <>
      <div className="toolbar prosbar">
        <div className="chips" role="group" aria-label="Show leads">
          {LEAD_CHIPS.map(([id, label]) => (
            <button key={id} type="button" className={f === id ? 'chip on' : 'chip'} aria-pressed={f === id} onClick={() => pick(id)}>{label} <span className="n">{leads.filter(l => inLeadF(l, id)).length}</span></button>
          ))}
        </div>
        <button type="button" className="primary" disabled={busy === 'csv'} onClick={() => file.current?.click()}><Up />{busy === 'csv' ? 'Uploading…' : 'Upload CSV'}</button>
        <input ref={file} type="file" accept=".csv,text/csv" hidden aria-label="Choose a CSV file of leads" onChange={async e => {
          const fl = e.target.files?.[0]; e.target.value = ''
          if (!fl) return
          if (fl.size > 3_000_000) { setToast({ text: 'That file is too big. Split it into files under 3 MB.' }); return }
          const text = await fl.text()
          run('csv', () => importLeads(text), r => { setF('all'); setToast({ text: (r as any).toast }) })
        }} />
      </div>
      <p className="capline">Walk-through and Follow-up email your <a href="/hub/commercial/prospecting/capability-statement" target="_blank" rel="noopener">capability statement (PDF)</a>, signed off with your email signature.</p>
      <div className="leads">
        {shown.map(l => {
          const calls = l.calls + (extra[l.id] || 0)
          const [tag, tagCls] = leadTag(l.status)
          const tel = l.phone.replace(/[^\d+]/g, '')
          const open = menu === l.id
          return (
            <div className="lead" key={l.id} data-lead={l.id}>
              <div className="lmain">
                <div className="lco">{l.company}{tag && <span className={tagCls}>{tag}</span>}</div>
                {l.name && <div className="lname">{l.name}</div>}
                <div className="linfo">
                  {l.phone && <span>{l.phone}</span>}
                  <span>{l.email || 'No email'}</span>
                  {l.address && <span>{l.address}</span>}
                </div>
              </div>
              <div className="lact">
                <span className="calls" aria-label={`Called ${calls} ${calls === 1 ? 'time' : 'times'}`}><strong>{calls}</strong> {calls === 1 ? 'call' : 'calls'}</span>
                {tel
                  ? <a className="btn call" href={'tel:' + tel} aria-label={`Call ${l.name || l.company}${l.name ? ' at ' + l.company : ''} on ${l.phone}`} onClick={() => {
                      setExtra(x => ({ ...x, [l.id]: (x[l.id] || 0) + 1 }))
                      callLead(l.id).then(r => { if (!r.ok) { setExtra(x => ({ ...x, [l.id]: (x[l.id] || 1) - 1 })); setToast({ text: r.error }) } else { refresh() } }).catch(() => setToast({ text: NO_DB }))
                    }}><Phone />Call</a>
                  : <span className="btn call" aria-disabled="true" title="No phone number">No phone</span>}
                <button type="button" className="btn log" aria-expanded={open} onClick={() => { setMenu(open ? null : l.id); setConfirm(null) }}>Log</button>
              </div>
              {open && (
                <div className="logmenu">
                  {(['walkthrough', 'follow_up'] as const).map(k => (
                    <button key={k} type="button" className="opt" disabled={busy === l.id} onClick={() => run(l.id, () => logLead(l.id, k), r => {
                      setMenu(null)
                      const prev = (r as any).prev
                      setToast({ text: (r as any).toast, undo: async () => { const u = await undoLeadLog(l.id, prev); if (!u.ok) setToast({ text: u.error }); else { setToast(null); refresh() } } })
                    })}>{k === 'walkthrough' ? 'Walk-through' : 'Follow-up'}</button>
                  ))}
                  <button type="button" className="opt danger" onClick={() => { setMenu(null); setConfirm(l.id) }}>Delete lead</button>
                  <p className="optnote">{l.email ? `Walk-through and Follow-up email your capability statement to ${l.email}.` : 'No email on file, so logging will not send anything.'}</p>
                </div>
              )}
              {confirm === l.id && (
                <div className="logmenu">
                  <span className="confirmq">Delete {l.company} for good?</span>
                  <button type="button" className="opt danger" disabled={busy === l.id} onClick={() => run(l.id, () => deleteLead(l.id), r => {
                    setConfirm(null)
                    const row = (r as any).row
                    setToast({ text: (r as any).toast, undo: async () => { const u = await restoreLead(row); if (!u.ok) setToast({ text: u.error }); else { setToast(null); refresh() } } })
                  })}>Delete</button>
                  <button type="button" className="opt" onClick={() => setConfirm(null)}>Cancel</button>
                </div>
              )}
            </div>
          )
        })}
        {!shown.length && <div className="empty">{leads.length ? 'No leads here yet.' : 'No leads yet. Upload a CSV to add them.'}</div>}
      </div>
      <p className="legend"><span>Call opens your phone dialler and adds one to the call count.</span></p>
      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" className="undo" disabled={busy === 'undo'} onClick={async () => { setBusy('undo'); try { await toast.undo!() } catch { setToast({ text: NO_DB }) } finally { setBusy(null) } }}>Undo</button>}
          <button type="button" className="undo" onClick={() => setToast(null)} aria-label="Dismiss">OK</button>
        </div>
      )}
    </>
  )
}
