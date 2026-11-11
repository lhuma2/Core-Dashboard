'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus } from './icons'
import { takeFlash } from '@/lib/hub/flash'
import { sendQuote, resendQuote, deleteQuote } from '@/actions/hub-quotes'
import { Q_STATE, cash, qMeta, qMoney, qWhatLine, type Quote } from '@/lib/hub/home-quotes'

type Show = 'open' | 'sent' | 'closed' | 'all'
const CHIPS: [Show, string][] = [['open', 'To do'], ['sent', 'Sent'], ['closed', 'Accepted or declined'], ['all', 'All']]
function inShow(q: Quote, f: Show) {
  if (f === 'all') return true
  if (f === 'open') return q.status === 'draft' || q.status === 'changes'
  if (f === 'sent') return q.status === 'sent'
  return q.status === 'accepted' || q.status === 'declined'
}

export function QuoteList({ quotes, initial }: { quotes: Quote[]; initial: Show }) {
  const router = useRouter()
  const [show, setShow] = useState<Show>(initial)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sendTo, setSendTo] = useState('')
  const [err, setErr] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [busy, start] = useTransition()
  // The message from the editor or preview ("CCQ-0001 saved."), shown once.
  useEffect(() => { const m = takeFlash(); if (m) setToast(m) }, [])

  const q = query.trim().toLowerCase()
  const rows = quotes.filter(x => inShow(x, show) && (!q || [x.name, x.ref, x.region, x.suburb, x.email].join(' ').toLowerCase().includes(q)))
  const empty = q ? `No quotes match “${query.trim()}”.` : show === 'open' ? 'All caught up. New website requests land here as draft quotes.' : 'Nothing here yet.'

  function done(r: { ok: true; toast: string } | { ok: false; error: string }, inBox = false) {
    if (!r.ok) { if (inBox) setErr(r.error); else setToast(r.error); return }
    setSending(null); setConfirming(null); setErr(''); setToast(r.toast); router.refresh()
  }
  function copy(code: string) {
    const link = `${window.location.origin}/q/${code}`
    const fail = `Couldn’t copy on this device. Here’s the link to copy by hand: ${link}`
    try {
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(link).then(() => setToast(`Quote link copied: ${link}`), () => setToast(fail)); return }
    } catch { /* fall through */ }
    setToast(fail)
  }

  return (
    <>
      <p className="sub rqsub"><span>Each request from your website&apos;s quote form lands here as a draft quote, filled in from what they entered. Check it, adjust the scope or price, and send. The request still emails admin@ as well.</span></p>
      <div className="toolbar">
        <label className="search">
          <Search />
          <span className="sr">Search quotes</span>
          <input type="search" placeholder="Search by name, ref or area" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <Link className="primary" href="/hub/residential/quotes/new"><Plus />New quote</Link>
      </div>
      <div className="chips" role="group" aria-label="Show quotes">
        {CHIPS.map(([v, label]) => (
          <button key={v} type="button" className={show === v ? 'chip on' : 'chip'} aria-pressed={show === v}
            onClick={() => { setShow(v); setSending(null); setConfirming(null) }}>
            {label} <span className="n">{quotes.filter(x => inShow(x, v)).length}</span>
          </button>
        ))}
      </div>
      <div className="doclist">
        {rows.map(x => {
          const [tag, tagCls] = Q_STATE[x.status]
          const canEdit = x.status === 'draft' || x.status === 'changes' || x.status === 'sent'
          const canSend = x.status === 'draft' || x.status === 'changes'
          return (
            <div className="docrow" key={x.id} data-testid="quote-row">
              <div className="drtop">
                <span className="drmain"><strong>{x.name || 'No name yet'}</strong><span>{x.ref} · {qWhatLine(x)}</span></span>
                <span className={tagCls}>{tag}</span>
              </div>
              <div className="probmeta">{qMoney(x.price) > 0 ? cash(qMoney(x.price)) + (x.every === 'oneoff' ? '' : ' a clean') : 'No price'} · {qMeta(x)}</div>
              {x.source === 'website' && <div className="probmeta">Website: {[x.req.frequency, x.req.hours, 'calculator price ' + (x.req.priceInc || 'none')].filter(Boolean).join(', ')}</div>}
              <div className="sheetbtns">
                {canEdit && <Link className="btn log" href={`/hub/residential/quotes/${x.id}/edit`}>{x.status === 'sent' ? 'Revise' : 'Edit'}</Link>}
                <Link className="btn log" href={`/hub/residential/quotes/${x.id}`}>View quote</Link>
                {canSend && <button type="button" className="btn call" onClick={() => { setSending(x.id!); setSendTo(x.email || ''); setErr(''); setConfirming(null) }}>{x.status === 'changes' ? 'Send revised quote' : 'Send to client'}</button>}
                {x.status === 'sent' && <>
                  <button type="button" className="btn log" disabled={busy} onClick={() => start(async () => done(await resendQuote(x.id!)))}>Resend</button>
                  <button type="button" className="btn log" onClick={() => copy(x.code!)}>Copy link</button>
                  <a className="btn log" href={`/q/${x.code}`} target="_blank" rel="noreferrer">See what the client sees</a>
                </>}
                {x.status !== 'accepted' && <button type="button" className="btn log dangerbtn" onClick={() => { setConfirming(x.id!); setSending(null) }}>Delete</button>}
              </div>
              {confirming === x.id && (
                <div className="inlineconfirm">
                  <span>Delete {x.ref}{x.status === 'sent' ? '? The link they have stops working.' : ' for good?'}</span>
                  <button type="button" className="btn call dangerfill" disabled={busy} onClick={() => start(async () => done(await deleteQuote(x.id!)))}>Yes, delete</button>
                  <button type="button" className="btn log" onClick={() => setConfirming(null)}>Keep it</button>
                </div>
              )}
              {sending === x.id && (
                <div className="sendbox">
                  <label className="fld"><span>Send the quote to</span><input type="email" autoComplete="off" autoCapitalize="off" value={sendTo} onChange={e => { setSendTo(e.target.value); setErr('') }} /></label>
                  {err && <p className="ferr" role="alert">{err}</p>}
                  <div className="sheetbtns">
                    <button type="button" className="btn call" disabled={busy} onClick={() => start(async () => done(await sendQuote(x.id!, sendTo.trim()), true))}>{busy ? 'Sending…' : 'Send from admin@'}</button>
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
