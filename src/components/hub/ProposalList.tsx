'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus } from './icons'
import { sendProposal, resendProposal, deleteProposal } from '@/actions/hub-proposals'
import { PROP_CHIPS, propMeta, propState, propTitle, sortProps, type PKey, type Prop } from '@/lib/hub/proposals'

export type PropF = PKey | 'all'
const BASE = '/hub/commercial/documents/proposals'

export function ProposalList({ props, initial, onToast, onAgreements }: { props: Prop[]; initial: PropF; onToast: (t: string) => void; onAgreements: (q: string) => void }) {
  const router = useRouter()
  const [f, setF] = useState<PropF>(initial)
  const [query, setQuery] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sendTo, setSendTo] = useState('')
  const [err, setErr] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, start] = useTransition()

  const q = query.trim().toLowerCase()
  const rows = sortProps(props.filter(p => (f === 'all' || propState(p).key === f) && (!q || (p.biz + ' ' + p.ref + ' ' + (p.ptype === 'spec' ? 'specialist' : 'commercial')).toLowerCase().includes(q))))
  const done = (r: { ok: true; toast: string } | { ok: false; error: string }, inBox = false) => {
    if (!r.ok) { if (inBox) setErr(r.error); else onToast(r.error); return }
    setSending(null); setConfirming(null); setErr(''); onToast(r.toast); router.refresh()
  }
  function copy(code: string) {
    const link = `${window.location.origin}/proposal/${code}`
    const fail = `Couldn’t copy on this device. Here’s the link to copy by hand: ${link}`
    try {
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(link).then(() => onToast('Proposal link copied.'), () => onToast(fail)); return }
    } catch { /* fall through */ }
    onToast(fail)
  }

  return (
    <>
      <div className="toolbar wrap">
        <label className="search">
          <Search />
          <span className="sr">Search proposals</span>
          <input type="search" placeholder="Search by business or ref" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <Link className="primary" href={BASE + '/new?type=comm'}><Plus />New proposal</Link>
        <Link className="btn log" href={BASE + '/new?type=spec'}>New specialist proposal</Link>
      </div>
      <div className="chips" role="group" aria-label="Show proposals">
        {PROP_CHIPS.map(([v, label]) => (
          <button key={v} type="button" className={f === v ? 'chip on' : 'chip'} aria-pressed={f === v} onClick={() => { setF(v); setSending(null); setConfirming(null) }}>
            {label} <span className="n">{props.filter(p => v === 'all' || propState(p).key === v).length}</span>
          </button>
        ))}
      </div>
      <div className="doclist">
        {rows.map(p => {
          const ps = propState(p), k = ps.key, comm = p.ptype === 'comm'
          const signed = p.agr && p.agr.status === 'signed'
          return (
            <div className="docrow" key={p.id} data-testid="prop-row">
              <div className="drtop">
                <span className="drmain"><strong>{p.biz}</strong><span>{propTitle(p)}</span></span>
                <span className={ps.tagCls}>{ps.tag}</span>
              </div>
              <div className="probmeta">{propMeta(p)}</div>
              <div className="sheetbtns">
                {k === 'draft' && <Link className="btn log" href={`${BASE}/${p.id}/edit`}>Edit</Link>}
                <Link className="btn log" href={`${BASE}/${p.id}`}>Preview</Link>
                {k === 'draft' && <button type="button" className="btn call" onClick={() => { setSending(p.id); setSendTo(p.email || ''); setErr(''); setConfirming(null) }}>Send to client</button>}
                {k === 'sent' && <>
                  <button type="button" className="btn log" disabled={busy} onClick={() => start(async () => done(await resendProposal(p.id)))}>Resend</button>
                  <button type="button" className="btn log" onClick={() => copy(p.code)}>Copy link</button>
                  <a className="btn log" href={`/proposal/${p.code}`} target="_blank" rel="noreferrer">See what the client sees</a>
                </>}
                {k === 'accepted' && comm && signed && !p.setupClientId && <Link className="btn call" href={`/hub/commercial/new?from=${p.id}`}>Set up as client</Link>}
                {k === 'accepted' && p.agr && <button type="button" className="btn call" onClick={() => onAgreements(p.biz)}>{comm ? 'Go to the service agreement' : 'Go to the works agreement'}</button>}
                {(k === 'declined' || k === 'revision') && <Link className={k === 'revision' ? 'btn call' : 'btn log'} href={`${BASE}/${p.id}/edit?revise=1`}>Revise</Link>}
                {(k === 'draft' || k === 'declined') && <button type="button" className="btn log dangerbtn" onClick={() => { setConfirming(p.id); setSending(null) }}>Delete</button>}
              </div>
              {confirming === p.id && (
                <div className="inlineconfirm">
                  <span>Delete this proposal for {p.biz}?</span>
                  <button type="button" className="btn call dangerfill" disabled={busy} onClick={() => start(async () => done(await deleteProposal(p.id)))}>Yes, delete</button>
                  <button type="button" className="btn log" onClick={() => setConfirming(null)}>Keep it</button>
                </div>
              )}
              {sending === p.id && (
                <div className="sendbox">
                  <label className="fld"><span>Email the proposal to</span><input type="email" autoComplete="off" autoCapitalize="off" value={sendTo} onChange={e => { setSendTo(e.target.value); setErr('') }} /></label>
                  {err && <p className="ferr" role="alert">{err}</p>}
                  <div className="sheetbtns">
                    <button type="button" className="btn call" disabled={busy} onClick={() => start(async () => done(await sendProposal(p.id, sendTo), true))}>{busy ? 'Sending…' : 'Send from admin@'}</button>
                    <button type="button" className="btn log" onClick={() => { setSending(null); setErr('') }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!rows.length && <div className="empty">{q ? `No proposals match “${query.trim()}”.` : 'No proposals here yet.'}</div>}
      </div>
    </>
  )
}
