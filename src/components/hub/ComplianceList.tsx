'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Chev, Close } from './icons'
import { saveSet, removeSet, shareLink, emailDocs } from '@/actions/hub-compliance'
import { COMPLIANCE_DOCS, DOC_GROUPS, GROUP_ORDER, QUICK_SETS, docSlug } from '@/lib/hub/compliance-docs'

const NO_DB = 'Couldn’t reach the hub. Check your connection and try again.'
const Tick = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>

/** Copy a link; if the phone or browser blocks copying, show the link so it can be copied by hand (mock-up copyLink). */
export async function copy(link: string, okMsg: string): Promise<string> {
  try { await navigator.clipboard.writeText(link); return okMsg } catch { return 'Couldn’t copy on this device. Here’s the link to copy by hand: ' + link }
}

export function useToast() {
  const [toast, setToast] = useState('')
  const el = toast ? (
    <div className="toast" role="status"><span>{toast}</span><button type="button" className="undo" onClick={() => setToast('')} aria-label="Dismiss">OK</button></div>
  ) : null
  return { setToast, el }
}

/** The Share sheet: copy the link, send by email, or preview what they see. */
export function ShareSheet({ ids, onClose, onToast }: { ids: string[]; onClose: () => void; onToast: (t: string) => void }) {
  const [mode, setMode] = useState<'link' | 'email'>('link')
  const [url, setUrl] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [native, setNative] = useState(false)
  const docs = COMPLIANCE_DOCS.filter(d => ids.includes(d.id))
  const getUrl = async (): Promise<string> => {
    if (url) return url
    const r = await shareLink(ids)
    if (!r.ok) { onToast(r.error); return '' }
    setUrl(r.url); return r.url
  }
  // make the link as soon as the sheet opens, so it shows in the box
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function'); getUrl().catch(() => onToast(NO_DB)) }, [])
  const shown = url ? url.replace(/^https?:\/\//, '') : 'Making the link…'
  return (
    <div className="sheet" role="dialog" aria-label="Share documents">
      <div className="sheethead">
        <strong>Share {docs.length === 1 ? '1 document' : `${docs.length} documents`}</strong>
        <button type="button" className="undo close" onClick={onClose} aria-label="Close"><Close /></button>
      </div>
      <p className="sheetsub">{docs.map(d => d.title).join(', ')}</p>
      {mode === 'link' ? (
        <>
          <div className="linkbox" data-testid="share-link">{shown}</div>
          <div className="sheetbtns">
            <button type="button" className="btn call" disabled={!url} onClick={async () => { const u = await getUrl(); if (!u) return; onClose(); onToast(await copy(u, 'Link copied. Paste it into a text or email.')) }}>Copy link</button>
            <button type="button" className="btn log" onClick={() => setMode('email')}>Send by email</button>
            {url ? <a className="btn log" href={url.replace(/^https?:\/\/[^/]+/, '') + '?preview=1'}>Preview what they see</a> : <button type="button" className="btn log" disabled>Preview what they see</button>}
            {native && <button type="button" className="btn log" disabled={!url} onClick={async () => {
              const title = docs.length === 1 ? `${docs[0].title} from Core Cleaning` : 'Compliance documents from Core Cleaning'
              try { await navigator.share({ title, url }); onClose() } catch { /* they closed the phone's share sheet */ }
            }}>More ways to send</button>}
          </div>
          {native && <p className="sheetsub">More ways to send opens your phone’s normal share sheet (Messages, WhatsApp, Mail).</p>}
        </>
      ) : (
        <form noValidate onSubmit={async e => {
          e.preventDefault(); if (busy) return
          setBusy(true)
          try { const r = await emailDocs(ids, to); if (!r.ok) { onToast(r.error); return } onClose(); onToast(r.toast) } catch { onToast(NO_DB) } finally { setBusy(false) }
        }} style={{ display: 'contents' }}>
          <label className="search"><span className="sr">Send to email</span><input type="email" placeholder="client@business.com.au" value={to} onChange={e => setTo(e.target.value)} autoFocus /></label>
          <p className="sheetsub">Sent from admin@corecleaning.services with the documents attached as PDFs, ending with your signature.</p>
          <div className="sheetbtns">
            <button type="submit" className="btn call" disabled={busy}>{busy ? 'Sending…' : 'Send email'}</button>
            <button type="button" className="btn log" onClick={() => setMode('link')}>Back</button>
          </div>
        </form>
      )}
    </div>
  )
}

export function ComplianceList({ saved }: { saved: { id: string; name: string; ids: string[] }[] }) {
  const router = useRouter()
  const [, start] = useTransition()
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Record<string, boolean>>({})
  const [naming, setNaming] = useState(false)
  const [setName, setSetName] = useState('')
  const [share, setShare] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const { setToast, el } = useToast()
  const ids = COMPLIANCE_DOCS.filter(d => picked[d.id]).map(d => d.id)
  const sets = [...QUICK_SETS.map(s => ({ ...s, id: '' })), ...saved]
  const pick = (list: string[]) => { const p: Record<string, boolean> = {}; list.forEach(i => { p[i] = true }); setPicked(p); setSelecting(true); setNaming(false); setShare(null) }

  return (
    <>
      <div className="titlerow">
        <h1 className="greet">Compliance pack</h1>
        <button type="button" className="btn log" onClick={() => { setSelecting(!selecting); setPicked({}); setNaming(false); setShare(null) }}>{selecting ? 'Done' : 'Select'}</button>
      </div>
      <p className="sub"><span>{COMPLIANCE_DOCS.length} documents, carried over from your current hub</span></p>
      <div className="sets" role="group" aria-label="Quick sets">
        <span className="setslbl">Quick sets</span>
        {sets.map(s => (
          <span key={s.id || s.name} style={{ display: 'contents' }}>
            <button type="button" className="chip" onClick={() => pick(s.ids)}>{s.name} <span className="ccount">{s.ids.length}</span></button>
          </span>
        ))}
      </div>
      {GROUP_ORDER.map(gi => {
        const docs = COMPLIANCE_DOCS.filter(d => d.group === gi)
        return (
          <section className="cgroup" key={gi} aria-label={DOC_GROUPS[gi]}>
            <h2 className="cgh">{DOC_GROUPS[gi]} <span className="ccount">{docs.length}</span></h2>
            <div className="list">
              {docs.map(d => selecting ? (
                <button key={d.id} type="button" className="drow" aria-pressed={!!picked[d.id]} onClick={() => setPicked(p => { const n = { ...p }; if (n[d.id]) delete n[d.id]; else n[d.id] = true; return n })}>
                  <span className={picked[d.id] ? 'box on' : 'box'} aria-hidden="true"><Tick /></span>
                  <span className="dcode">{d.code}</span><span className="dtitle">{d.title}</span><Chev />
                </button>
              ) : (
                <Link key={d.id} className="drow" href={`/hub/compliance/${docSlug(d.id)}`}><span className="dcode">{d.code}</span><span className="dtitle">{d.title}</span><Chev /></Link>
              ))}
            </div>
          </section>
        )
      })}
      {selecting && !share && (
        <div className="selbar">
          {naming ? (
            <form noValidate style={{ display: 'contents' }} onSubmit={async e => {
              e.preventDefault(); if (busy) return
              if (!setName.trim()) { setToast('Give the set a name first.'); return }
              setBusy(true)
              try { const r = await saveSet(setName, ids); if (!r.ok) { setToast(r.error); return } setNaming(false); setSetName(''); setToast(r.toast); start(() => router.refresh()) } catch { setToast(NO_DB) } finally { setBusy(false) }
            }}>
              <label className="search namefield"><span className="sr">Set name</span><input type="text" placeholder="Name this set, e.g. New subbie pack" value={setName} onChange={e => setSetName(e.target.value)} maxLength={60} autoFocus /></label>
              <button type="submit" className="btn call" disabled={busy}>Save</button>
              <button type="button" className="btn log" onClick={() => setNaming(false)}>Cancel</button>
            </form>
          ) : (
            <>
              <span className="selcount">{ids.length === 0 ? 'Tick the documents to share' : ids.length + (ids.length === 1 ? ' document selected' : ' documents selected')}</span>
              <button type="button" className="btn log" disabled={!ids.length} onClick={() => { setNaming(true); setSetName('') }}>Save set</button>
              <button type="button" className="btn call" disabled={!ids.length} onClick={() => setShare(ids)}>Share</button>
            </>
          )}
        </div>
      )}
      {share && <ShareSheet ids={share} onClose={() => setShare(null)} onToast={setToast} />}
      {saved.length > 0 && (
        <section className="cgroup" aria-label="Your saved sets">
          <h2 className="cgh">Your saved sets <span className="ccount">{saved.length}</span></h2>
          <div className="list">
            {saved.map(s => (
              <div className="trow" key={s.id}>
                <div className="tmain"><div className="tname">{s.name}</div><div className="tcontact">{s.ids.length === 1 ? '1 document' : `${s.ids.length} documents`}</div></div>
                <div className="tact"><button type="button" className="linkbtn danger" disabled={busy} onClick={async () => {
                  setBusy(true)
                  try { const r = await removeSet(s.id); setToast(r.ok ? r.toast : r.error); start(() => router.refresh()) } catch { setToast(NO_DB) } finally { setBusy(false) }
                }}>Remove</button></div>
              </div>
            ))}
          </div>
        </section>
      )}
      {el}
    </>
  )
}
