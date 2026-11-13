'use client'

import { useRef, useState } from 'react'
import { packCertUpload, signPack } from '@/actions/pack'
import { PACK_DOCS } from '@/lib/hub/team'
import { SUBCONTRACTOR_AGREEMENT, CONTRACTOR_INDUCTION } from '@/lib/documents/subcontractor'

const Chev = () => <svg className="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
const OFFLINE = 'That didn’t go through. Check your connection and try again.'

function DocRows({ open, toggle }: { open: Record<string, boolean>; toggle: (code: string) => void }) {
  return (
    <div className="list sharedlist">
      {PACK_DOCS.map(d => d.href
        ? <a key={d.code} className="drow" href={d.href} target="_blank" rel="noreferrer"><span className="dcode">{d.code}</span><span className="dtitle">{d.title}</span><Chev /></a>
        : <button key={d.code} type="button" className="drow" aria-expanded={!!open[d.code]} onClick={() => toggle(d.code)}><span className="dcode">{d.code}</span><span className="dtitle">{d.title}</span><Chev /></button>)}
    </div>
  )
}

function PackText({ code, signed }: { code: string; signed: { by: string; on: string } | null }) {
  if (code === 'DCA-SUB') {
    const a = SUBCONTRACTOR_AGREEMENT
    return (
      <section className="packdoc" id="dca-sub" aria-label={a.title}>
        <h2 className="dh">{a.title}</h2>
        <p className="dp">{a.intro}</p>
        {a.clauses.map(c => <div key={c.n}><h3>{c.n}. {c.title}</h3><p className="dp">{c.body}</p></div>)}
        {signed && <p className="dp"><strong>Signed by {signed.by} on {signed.on}.</strong></p>}
      </section>
    )
  }
  const n = CONTRACTOR_INDUCTION
  return (
    <section className="packdoc" id="ind-001" aria-label={n.title}>
      <h2 className="dh">{n.title}</h2>
      <p className="dp">{n.intro}</p>
      {n.sections.map(s => <div key={s.heading}><h3>{s.heading}</h3><ul className="dul">{s.bullets.map(b => <li key={b}>{b}</li>)}</ul></div>)}
      <p className="dp">{n.acknowledgment}{signed ? ` Signed by ${signed.by} on ${signed.on}.` : ''}</p>
    </section>
  )
}

export function PackForm({ token, first, name, phone, today, preview, signed }: {
  token: string; first: string; name: string; phone: string; today: string; preview: boolean
  signed: { by: string; on: string; company: string } | null
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [f, setF] = useState({ company: '', abn: '', contact: name, phone, insurer: '', policy: '', expiry: '', sig: '' })
  const [agree, setAgree] = useState(false)
  const [cert, setCert] = useState<{ path: string; name: string } | null>(null)
  const [upBusy, setUpBusy] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ email: string; pw?: string; tested: boolean } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF(x => ({ ...x, [k]: e.target.value })); setErr('') }
  const toggle = (code: string) => { setOpen(o => ({ ...o, [code]: !o[code] })); if (!open[code]) setTimeout(() => document.getElementById(code.toLowerCase())?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }

  async function pickCert(file: File | undefined) {
    if (!file) return
    setErr(''); setUpBusy(true)
    try {
      const r = await packCertUpload(token, file.type, file.size)
      if (!r.ok) { setErr(r.error); return }
      const up = await fetch(r.url, { method: 'PUT', headers: { 'content-type': file.type, 'x-upsert': 'true' }, body: file })
      if (!up.ok) { setErr(OFFLINE); return }
      setCert({ path: r.path, name: file.name })
    } catch { setErr(OFFLINE) } finally { setUpBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || upBusy) return
    setBusy(true); setErr('')
    try {
      const r = await signPack(token, { ...f, cert: cert?.path || '', agree })
      if (!r.ok) { setErr(r.error); return }
      setDone({ email: r.email, pw: r.pw, tested: r.tested })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch { setErr(OFFLINE) } finally { setBusy(false) }
  }

  const head = (code: string, title: string) => (
    <div className="dochead">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="doclogo" src="/hub-logo-white.png" alt="Core Cleaning" />
      <div><div className="doccode">{code}</div><h1 className="doctitle">{title}</h1></div>
    </div>
  )
  const note = preview && (
    <div className="previewnote">
      <span>Preview: this is the page {first} opens from the email.</span>
      <a className="back" href="/hub/team">Back to Team</a>
    </div>
  )

  if (done || signed) {
    const by = signed?.by || f.sig.trim().replace(/\s+/g, ' ')
    const on = signed?.on || new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Brisbane', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
    return (
      <>
        {note}
        <article className="doc">
          {head('Contractor onboarding', done ? `Thanks, ${first}` : 'Signed onboarding pack')}
          <div className="packdone" role="status">
            <div className="sigblock"><div className="sigline">{by}</div><div className="sigmeta">Signed electronically on {on}{(signed?.company || f.company) ? ` for ${signed?.company || f.company.trim()}` : ''}</div></div>
            {done && !done.tested && <p className="dp">You’re all signed up. We’ve emailed your login for the cleaner app to {done.email}.</p>}
            {done && done.tested && <p className="dp">You’re all signed up. This is the test site, so no email went out. The login is {done.email}, password {done.pw}.</p>}
            {!done && <p className="dp">This pack is signed. Your login for the cleaner app was emailed to you. Lost it? Call Laith on 0407 026 360.</p>}
            <p className="dp"><a className="btn call" href="/cleaner/login">Go to the cleaner app</a></p>
          </div>
          <h2 className="dh">Documents covered by this signature</h2>
          <DocRows open={open} toggle={toggle} />
          {open['DCA-SUB'] && <PackText code="DCA-SUB" signed={{ by, on }} />}
          {open['IND-001'] && <PackText code="IND-001" signed={{ by, on }} />}
        </article>
      </>
    )
  }

  return (
    <>
      {note}
      <article className="doc">
        {head('Contractor onboarding', `Welcome, ${first}`)}
        <p className="dp">Please read the pack below, add your business and insurance details, and sign once. One signature covers every document.</p>
        <h2 className="dh">Your pack ({PACK_DOCS.length} documents)</h2>
        <DocRows open={open} toggle={toggle} />
        {open['DCA-SUB'] && <PackText code="DCA-SUB" signed={null} />}
        {open['IND-001'] && <PackText code="IND-001" signed={null} />}
        <form onSubmit={submit} noValidate aria-label="Your details and signature">
          <h2 className="dh">Your business</h2>
          <div className="fgrid">
            <label className="fld"><span>Company or trading name</span><input type="text" autoComplete="organization" value={f.company} onChange={set('company')} maxLength={200} /></label>
            <label className="fld"><span>ABN</span><input type="text" inputMode="numeric" value={f.abn} onChange={set('abn')} maxLength={20} /></label>
            <label className="fld"><span>Contact name</span><input type="text" autoComplete="name" value={f.contact} onChange={set('contact')} maxLength={200} /></label>
            <label className="fld"><span>Mobile</span><input type="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} maxLength={20} /></label>
          </div>
          <h2 className="dh">Public liability insurance</h2>
          <div className="fgrid">
            <label className="fld"><span>Insurer</span><input type="text" value={f.insurer} onChange={set('insurer')} maxLength={200} /></label>
            <label className="fld"><span>Policy number</span><input type="text" value={f.policy} onChange={set('policy')} maxLength={200} /></label>
            <label className="fld"><span>Expiry date</span><input type="date" min={today} value={f.expiry} onChange={set('expiry')} /></label>
            <div className="fld"><span>Certificate of currency</span>
              <div className="certpick">
                <button type="button" className="btn log" disabled={upBusy} onClick={() => fileRef.current?.click()}>{upBusy ? 'Uploading…' : cert ? 'Certificate attached' : 'Attach file'}</button>
                {cert && <span className="cpnote">{cert.name}</span>}
              </div>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden aria-label="Certificate of currency file" onChange={e => pickCert(e.target.files?.[0])} />
            </div>
          </div>
          <h2 className="dh">Sign</h2>
          <label className="fld"><span>Type your full name to sign</span><input className="sig" type="text" autoComplete="off" value={f.sig} onChange={set('sig')} maxLength={200} /></label>
          <label className="check"><input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); setErr('') }} /><span>I agree to the Subcontractor Services Agreement, and I confirm I have read and understood the Contractor Induction, SWMS and policies in this pack.</span></label>
          {err && <p className="ferr" role="alert">{err}</p>}
          <button type="submit" className="btn call dlall" disabled={busy || upBusy}>{busy ? 'Signing…' : 'Sign and finish'}</button>
        </form>
      </article>
    </>
  )
}
