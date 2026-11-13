'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLiveRefresh } from '@/lib/hub/use-live'
import { Search, Plus } from './icons'
import { takeFlash, setFlash } from '@/lib/hub/flash'
import { createAgreement, sendAgreement, resendAgreement, deleteAgreement } from '@/actions/hub-agreements'
import { docMeta, docTag, type HomeDoc } from '@/lib/hub/home-agreements'
import { AGRN } from '@/lib/hub/div'
import { useDiv } from '@/lib/hub/use-div'

type Show = 'all' | 'draft' | 'sent' | 'signed'
const CHIPS: [Show, string][] = [['all', 'All'], ['draft', 'Drafts'], ['sent', 'Waiting to sign'], ['signed', 'Signed']]
type R = { ok: true; id: string; toast: string } | { ok: false; error: string }

export function copyLink(code: string, setToast: (m: string) => void) {
  const link = `${window.location.origin}/agree/${code}`
  const fail = `Couldn’t copy on this device. Here’s the link to copy by hand: ${link}`
  try {
    if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(link).then(() => setToast(`Signing link copied: ${link}`), () => setToast(fail)); return }
  } catch { /* fall through */ }
  setToast(fail)
}

export function DocList({ docs, homes, initial }: { docs: HomeDoc[]; homes: { id: string; label: string }[]; initial: Show }) {
  const { base, div, name: divName, lower: divLower } = useDiv()
  const router = useRouter()
  useLiveRefresh()
  const [show, setShow] = useState<Show>(initial)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sendTo, setSendTo] = useState('')
  const [err, setErr] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [making, setMaking] = useState(false)
  const [pick, setPick] = useState('')
  const [busy, start] = useTransition()
  useEffect(() => { const m = takeFlash(); if (m) setToast(m) }, [])

  const q = query.trim().toLowerCase()
  const rows = docs.filter(d => (show === 'all' || d.status === show) && (!q || [d.homeName, d.ref, d.sentTo || ''].join(' ').toLowerCase().includes(q)))
  const empty = q ? `No documents match “${query.trim()}”.` : show === 'all' ? 'No agreements yet. When a client accepts a quote, their agreement lands here.' : 'Nothing here yet.'

  function done(r: R, inBox = false) {
    if (!r.ok) { if (inBox) setErr(r.error); else setToast(r.error); return }
    setSending(null); setConfirming(null); setErr(''); setToast(r.toast); router.refresh()
  }

  return (
    <>
      <p className="sub rqsub"><span>Service agreements for your {divLower} clients. One goes out to sign as soon as a client accepts a quote.</span></p>
      <div className="toolbar">
        <label className="search">
          <Search />
          <span className="sr">Search documents</span>
          <input type="search" placeholder="Client or ref" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <button type="button" className="primary" onClick={() => { setMaking(!making); setErr(''); setPick('') }}><Plus />New agreement</button>
      </div>
      {making && (
        <div className="sendbox">
          <label className="fld"><span>Client</span>
            <select value={pick} onChange={e => { setPick(e.target.value); setErr('') }}>
              <option value="">Pick a client</option>
              {homes.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
            </select>
          </label>
          {!homes.length && <p className="nchint">No {divLower} clients yet. They’re added when a client accepts a quote.</p>}
          {err && !sending && <p className="ferr" role="alert">{err}</p>}
          <div className="sheetbtns">
            <button type="button" className="btn call" disabled={busy} onClick={() => start(async () => {
              if (!pick) { setErr('Pick a client.'); return }
              const r = await createAgreement(pick)
              if (!r.ok) { setErr(r.error); return }
              setFlash(r.toast)
              router.push(`${base}/documents/${r.id}`)
            })}>Create draft</button>
            <button type="button" className="btn log" onClick={() => { setMaking(false); setErr('') }}>Cancel</button>
          </div>
        </div>
      )}
      <div className="chips" role="group" aria-label="Show documents">
        {CHIPS.map(([v, label]) => (
          <button key={v} type="button" className={show === v ? 'chip on' : 'chip'} aria-pressed={show === v}
            onClick={() => { setShow(v); setSending(null); setConfirming(null) }}>
            {label} <span className="n">{docs.filter(d => v === 'all' || d.status === v).length}</span>
          </button>
        ))}
      </div>
      <div className="doclist">
        {rows.map(d => {
          const [tag, tagCls] = docTag(d)
          return (
            <div className="docrow" key={d.id} data-testid="doc-row">
              <div className="drtop">
                <span className="drmain"><strong>{d.homeName}</strong><span>{d.ref} · {AGRN[d.division]}</span></span>
                <span className={tagCls}>{tag}</span>
              </div>
              <div className="probmeta">{docMeta(d)}</div>
              <div className="sheetbtns">
                <Link className="btn log" href={`${base}/documents/${d.id}`}>View</Link>
                {d.status === 'draft' && <button type="button" className="btn call" onClick={() => { setSending(d.id); setSendTo(d.homeEmail); setErr(''); setConfirming(null) }}>Send for signature</button>}
                {d.status === 'sent' && <>
                  <button type="button" className="btn log" disabled={busy} onClick={() => start(async () => done(await resendAgreement(d.id)))}>Resend</button>
                  <button type="button" className="btn log" onClick={() => copyLink(d.code, setToast)}>Copy signing link</button>
                  <a className="btn log" href={`/agree/${d.code}`} target="_blank" rel="noreferrer">See what the client sees</a>
                </>}
                {d.status === 'signed' && <a className="btn log" href={`/agree/${d.code}`} target="_blank" rel="noreferrer">Signed copy</a>}
                {d.status !== 'signed' && <button type="button" className="btn log dangerbtn" onClick={() => { setConfirming(d.id); setSending(null) }}>{d.status === 'sent' ? 'Withdraw' : 'Delete'}</button>}
              </div>
              {confirming === d.id && (
                <div className="inlineconfirm">
                  <span>{d.status === 'sent' ? `Withdraw ${d.ref}? The signing link stops working.` : `Remove ${d.ref} for good?`}</span>
                  <button type="button" className="btn call dangerfill" disabled={busy} onClick={() => start(async () => done(await deleteAgreement(d.id)))}>{d.status === 'sent' ? 'Yes, withdraw' : 'Yes, delete'}</button>
                  <button type="button" className="btn log" onClick={() => setConfirming(null)}>Keep it</button>
                </div>
              )}
              {sending === d.id && (
                <div className="sendbox">
                  <label className="fld"><span>Send the signing link to</span><input type="email" autoComplete="off" autoCapitalize="off" value={sendTo} onChange={e => { setSendTo(e.target.value); setErr('') }} /></label>
                  {err && <p className="ferr" role="alert">{err}</p>}
                  <div className="sheetbtns">
                    <button type="button" className="btn call" disabled={busy} onClick={() => start(async () => done(await sendAgreement(d.id, sendTo.trim()), true))}>{busy ? 'Sending…' : 'Send from admin@'}</button>
                    <button type="button" className="btn log" onClick={() => { setSending(null); setErr('') }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!rows.length && <div className="empty">{empty}</div>}
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          <button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button>
        </div>
      )}
    </>
  )
}
