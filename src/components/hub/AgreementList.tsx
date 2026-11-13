'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Plus } from './icons'
import {
  createCommAgreement, deleteCommAgreement, fileUploadUrl, removeClientFile, renewCommAgreement, resendCommAgreement, saveClientFile,
  sendCommAgreement, sendRequestedDocs,
} from '@/actions/hub-comm-agreements'
import { AS_REQ_SHORT, DOC_CHIPS, UPLOAD_KINDS, agrState, agrTitle, daysBetween, dShort, type Agr, type DKey } from '@/lib/hub/proposals'
import type { DocsData } from '@/lib/hub/documents-data'

export type DocF = DKey | 'all'
type R = { ok: true; id: string; toast: string } | { ok: false; error: string }
const BASE = '/hub/commercial/documents'
const ORDER: Record<DKey, number> = { sent: 0, draft: 1, expiring: 2, signed: 3, rolling: 4, filed: 5 }

type Row =
  | { kind: 'agr'; id: string; client: string; created: string; key: DKey; d: Agr; st: ReturnType<typeof agrState> }
  | { kind: 'file'; id: string; client: string; created: string; key: 'filed'; f: DocsData['files'][number] }

export function AgreementList({ data, today, initial, initialQuery, onToast }: { data: DocsData; today: string; initial: DocF; initialQuery: string; onToast: (t: string) => void }) {
  const router = useRouter()
  const [f, setF] = useState<DocF>(initial)
  const [query, setQuery] = useState(initialQuery)
  const [making, setMaking] = useState<null | 'agreement' | 'upload'>(null)
  const [client, setClient] = useState('')
  const [start, setStart] = useState('')
  const [term, setTerm] = useState('12')
  const [utype, setUtype] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [sendTo, setSendTo] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, start_] = useTransition()

  const all: Row[] = [
    ...data.agrs.map(d => { const st = agrState(d, today); return { kind: 'agr' as const, id: d.id, client: d.client, created: d.created, key: st.key, d, st } }),
    ...data.files.map(x => ({ kind: 'file' as const, id: x.id, client: x.client, created: x.created, key: 'filed' as const, f: x })),
  ].sort((a, b) => ORDER[a.key] - ORDER[b.key] || a.client.localeCompare(b.client))
  const q = query.trim().toLowerCase()
  const text = (r: Row) => (r.kind === 'agr' ? [r.client, r.d.ref, agrTitle(r.d), r.d.sentTo] : [r.client, r.f.kind, r.f.fileName]).join(' ').toLowerCase()
  const match = (r: Row, v: DocF) => v === 'all' || r.key === v || (v === 'signed' && (r.key === 'expiring' || r.key === 'rolling'))
  const rows = all.filter(r => match(r, f) && (!q || text(r).includes(q)))

  const close = () => { setSending(null); setConfirming(null); setErr('') }
  const done = (r: R, inBox = false) => {
    if (!r.ok) { if (inBox) setErr(r.error); else onToast(r.error); return }
    if (making) setF('all')
    close(); setMaking(null); onToast(r.toast); router.refresh()
  }
  function open(kind: 'agreement' | 'upload') {
    close(); setMaking(making === kind ? null : kind); setClient(''); setStart(''); setTerm('12'); setUtype(''); setFile(null)
  }
  function copy(code: string) {
    const link = `${window.location.origin}/agreement/${code}`
    const fail = `Couldn’t copy on this device. Here’s the link to copy by hand: ${link}`
    try {
      if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(link).then(() => onToast('Signing link copied.'), () => onToast(fail)); return }
    } catch { /* fall through */ }
    onToast(fail)
  }
  function pickFile(x?: File) {
    if (!x) return
    if (!(x.type === 'application/pdf' || /^image\//.test(x.type || ''))) { setErr('Upload a PDF or a photo.'); return }
    if (x.size > 20 * 1024 * 1024) { setErr('That file is over 20 MB.'); return }
    setFile(x); setErr('')
  }
  function saveUpload() {
    if (!client) { setErr('Choose the client.'); return }
    if (!utype) { setErr('Choose what kind of document it is.'); return }
    if (!file) { setErr('Choose the file to upload.'); return }
    start_(async () => {
      try {
        const u = await fileUploadUrl(client, file.type, file.size)
        if (!u.ok) { setErr(u.error); return }
        const put = await fetch(u.url, { method: 'PUT', headers: { 'content-type': file.type, 'x-upsert': 'true' }, body: file })
        if (!put.ok) { setErr('The upload didn’t go through. Check your connection and try again.'); return }
        done(await saveClientFile(client, utype, file.name, u.path, file.type, file.size), true)
      } catch { setErr('The upload didn’t go through. Check your connection and try again.') }
    })
  }

  return (
    <>
      <div className="toolbar wrap">
        <label className="search">
          <Search />
          <span className="sr">Search documents</span>
          <input type="search" placeholder="Search by client or document" value={query} onChange={e => setQuery(e.target.value)} />
        </label>
        <button type="button" className="primary" onClick={() => open('agreement')}><Plus />New agreement</button>
        <button type="button" className="btn log" onClick={() => open('upload')}>Upload document</button>
      </div>

      {making === 'agreement' && (
        <div className="addcard">
          <h2 className="nch">New service agreement</h2>
          <p className="nchint">Fills in the client’s details, sites, cleaning days and price from their client record, with your standard 19 clauses.</p>
          <div className="ncgrid">
            <label className="fld span2"><span>Client</span>
              <select value={client} onChange={e => { const v = e.target.value; setClient(v); setErr(''); if (!start) setStart(data.clients.find(c => c.id === v)?.firstClean || '') }}>
                <option value="">Choose a client</option>
                {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="fld half"><span>Start date</span><input type="date" value={start} onChange={e => { setStart(e.target.value); setErr('') }} /></label>
            <label className="fld half"><span>Initial term</span>
              <select value={term} onChange={e => { setTerm(e.target.value); setErr('') }}>
                <option value="6">6 months</option><option value="12">12 months</option><option value="24">24 months</option>
              </select>
            </label>
          </div>
          {err && <p className="ferr" role="alert">{err}</p>}
          <div className="sheetbtns">
            <button type="button" className="btn call" disabled={busy} onClick={() => {
              if (!client) { setErr('Choose the client.'); return }
              if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { setErr('Add the start date.'); return }
              start_(async () => done(await createCommAgreement(client, start, +term), true))
            }}>Create draft</button>
            <button type="button" className="btn log" onClick={() => { setMaking(null); setErr('') }}>Cancel</button>
          </div>
        </div>
      )}

      {making === 'upload' && (
        <div className="addcard">
          <h2 className="nch">Upload a document</h2>
          <p className="nchint">For things signed outside the hub, insurance certificates, site forms and so on. It’s filed under the client.</p>
          <div className="ncgrid">
            <label className="fld half"><span>Client</span>
              <select value={client} onChange={e => { setClient(e.target.value); setErr('') }}>
                <option value="">Choose a client</option>
                {data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="fld half"><span>Type</span>
              <select value={utype} onChange={e => { setUtype(e.target.value); setErr('') }}>
                <option value="">Choose a type</option>
                {UPLOAD_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
          </div>
          <label className="upload">
            <input className="sr" type="file" accept="application/pdf,image/*" onChange={e => { const x = e.target.files?.[0]; e.target.value = ''; pickFile(x) }} />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M12 18v-6M9 15l3-3 3 3" /></svg>
            <span><strong>{file ? file.name : 'Choose the file'}</strong><span>PDF or photo, up to 20 MB</span></span>
          </label>
          {err && <p className="ferr" role="alert">{err}</p>}
          <div className="sheetbtns">
            <button type="button" className="btn call" disabled={busy} onClick={saveUpload}>{busy ? 'Uploading…' : 'Save to client'}</button>
            <button type="button" className="btn log" onClick={() => { setMaking(null); setErr('') }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="chips" role="group" aria-label="Show documents">
        {DOC_CHIPS.map(([v, label]) => (
          <button key={v} type="button" className={f === v ? 'chip on' : 'chip'} aria-pressed={f === v} onClick={() => { setF(v); close() }}>
            {label} <span className="n">{all.filter(r => match(r, v)).length}</span>
          </button>
        ))}
      </div>
      <div className="doclist">
        {rows.map(r => {
          if (r.kind === 'file') {
            const x = r.f
            return (
              <div className="docrow" key={'f' + x.id} data-testid="doc-row">
                <div className="drtop">
                  <span className="drmain"><strong>{x.client}</strong><span>{x.kind}</span></span>
                  <span className="tag wt">On file</span>
                </div>
                <div className="probmeta">Uploaded {dShort(x.created)} · {x.fileName}</div>
                <div className="sheetbtns">
                  <a className="btn log" href={`${BASE}/files/${x.id}`} target="_blank" rel="noreferrer">Open file</a>
                  <button type="button" className="btn log dangerbtn" onClick={() => { setConfirming(x.id); setSending(null) }}>Remove</button>
                </div>
                {confirming === x.id && (
                  <div className="inlineconfirm">
                    <span>Remove {x.fileName} from {x.client}?</span>
                    <button type="button" className="btn call dangerfill" disabled={busy} onClick={() => start_(async () => done(await removeClientFile(x.id)))}>Yes, remove</button>
                    <button type="button" className="btn log" onClick={() => setConfirming(null)}>Keep it</button>
                  </div>
                )}
              </div>
            )
          }
          const { d, st } = r, k = st.key, spec = d.atype === 'spec'
          const waited = d.sentAt ? Math.max(0, daysBetween(d.sentAt, today)) : 0
          let meta = spec
            ? (k === 'draft' ? `Draft created ${dShort(d.created)} · works date ${d.start ? dShort(d.start) : 'not set yet'}`
              : k === 'sent' ? `Sent to ${d.sentTo} on ${dShort(d.sentAt)} · ` + (d.start ? `works on ${dShort(d.start)}` : 'they choose the works date when signing')
              : `Signed by ${d.signedBy} on ${dShort(d.signedAt)} · works booked for ${dShort(d.start)}`)
            : (k === 'draft' ? `Draft created ${dShort(d.created)} · starts ${dShort(d.start)}`
              : k === 'sent' ? `Sent to ${d.sentTo} on ${dShort(d.sentAt)} · waiting ${waited} ${waited === 1 ? 'day' : 'days'}`
              : `Signed by ${d.signedBy} on ${dShort(d.signedAt)} · ` + (k === 'rolling' ? `initial term ended ${dShort(st.end)}, now rolling` : `initial term to ${dShort(st.end)}`))
          meta = d.ref + ' · ' + meta
          const reqs = d.details?.reqs || [], docReqs = reqs.filter(x => x === 'coc' || x === 'pack')
          if (reqs.length) meta += ' · asked for ' + reqs.map(x => AS_REQ_SHORT[x]).join(', ') + (docReqs.length && d.reqSentAt ? ` (documents sent ${dShort(d.reqSentAt)})` : '')
          const signed = k === 'signed' || k === 'expiring' || k === 'rolling'
          return (
            <div className="docrow" key={d.id} data-testid="doc-row">
              <div className="drtop">
                <span className="drmain"><strong>{d.client}</strong><span>{agrTitle(d)}</span></span>
                <span className={st.tagCls}>{st.tag}</span>
              </div>
              <div className="probmeta">{meta}</div>
              <div className="sheetbtns">
                <Link className="btn log" href={`${BASE}/agreements/${d.id}`}>Open</Link>
                {k === 'draft' && <button type="button" className="btn call" onClick={() => { setSending(d.id); setSendTo(d.sentTo || data.clients.find(c => c.id === d.clientId)?.email || d.snap?.prop?.email || ''); setErr(''); setConfirming(null) }}>Send for signature</button>}
                {k === 'sent' && <>
                  <button type="button" className="btn log" disabled={busy} onClick={() => start_(async () => done(await resendCommAgreement(d.id)))}>Resend</button>
                  <button type="button" className="btn log" onClick={() => copy(d.code)}>Copy signing link</button>
                  <a className="btn log" href={`/agreement/${d.code}`} target="_blank" rel="noreferrer">See what the client sees</a>
                </>}
                {signed && <a className="btn log" href={`/agreement/${d.code}?print=1`} target="_blank" rel="noreferrer">Download PDF</a>}
                {signed && docReqs.length > 0 && !d.reqSentAt && (
                  <button type="button" className="btn call" disabled={busy} onClick={() => start_(async () => done(await sendRequestedDocs(d.id)))}>
                    {docReqs.length === 2 ? 'Send CoC and compliance pack' : docReqs[0] === 'coc' ? 'Send Certificate of Currency' : 'Send compliance pack'}
                  </button>
                )}
                {(k === 'expiring' || k === 'rolling') && !spec && <button type="button" className="btn call" disabled={busy} onClick={() => start_(async () => { const res = await renewCommAgreement(d.id); if (res.ok) setF('draft'); done(res) })}>Renew</button>}
                {k === 'draft' && <button type="button" className="btn log dangerbtn" onClick={() => { setConfirming(d.id); setSending(null) }}>Delete draft</button>}
              </div>
              {confirming === d.id && (
                <div className="inlineconfirm">
                  <span>Delete this draft agreement?</span>
                  <button type="button" className="btn call dangerfill" disabled={busy} onClick={() => start_(async () => done(await deleteCommAgreement(d.id)))}>Yes, remove</button>
                  <button type="button" className="btn log" onClick={() => setConfirming(null)}>Keep it</button>
                </div>
              )}
              {sending === d.id && (
                <div className="sendbox">
                  <label className="fld"><span>Send the signing link to</span><input type="email" autoComplete="off" autoCapitalize="off" value={sendTo} onChange={e => { setSendTo(e.target.value); setErr('') }} /></label>
                  {err && <p className="ferr" role="alert">{err}</p>}
                  <div className="sheetbtns">
                    <button type="button" className="btn call" disabled={busy} onClick={() => start_(async () => done(await sendCommAgreement(d.id, sendTo), true))}>{busy ? 'Sending…' : 'Send from admin@'}</button>
                    <button type="button" className="btn log" onClick={() => { setSending(null); setErr('') }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!rows.length && <div className="empty">{q ? `No documents match “${query.trim()}”.` : 'Nothing here yet.'}</div>}
      </div>
    </>
  )
}
