'use client'

import { useState, useTransition } from 'react'
import { clientSign } from '@/actions/hub-agreements'
import { AgreementHead } from './AgreementBody'
import type { Part } from '@/lib/hub/home-agreements'

// The client's signing page: a short summary, the full agreement one tap away, then name + tick + Sign.
// Once signed (now or before), the whole signed agreement shows with Download PDF.
export function AgreementClientPanel({ code, open, client, parts, banner, closedText, children }: {
  code: string; open: boolean; client: string; parts: Part[]; banner: string; closedText: string; children: React.ReactNode
}) {
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const [full, setFull] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState('')
  const [busy, start] = useTransition()
  const signing = open && !done
  const top = done || (signing ? banner : closedText)

  return (
    <>
      {top && <p className={done || (signing && banner) ? 'agstatus ok asbanner' : 'agstatus asbanner'} role="status">{top}</p>}
      <article className="doc">
        <AgreementHead kicker="Service agreement" title={client} />
        {signing ? (
          <>
            <p className="dp">Hi, here is your Core Cleaning service agreement. Please read it, then sign below.</p>
            {!full && <ul className="dul">{parts.map((p, i) => <li key={i}><strong>{p.k}:</strong> {p.v}</li>)}</ul>}
            <button type="button" className="linkbtn" aria-expanded={full} onClick={() => setFull(!full)}>{full ? 'Hide the full agreement' : 'Read the full agreement and terms'}</button>
            {full && children}
            <div className="stackform">
              <label className="fld"><span>Type your full name to sign</span><input className="sig" type="text" autoComplete="name" value={name} onChange={e => { setName(e.target.value); setErr('') }} /></label>
              <label className="check"><input type="checkbox" checked={agree} onChange={e => { setAgree(e.target.checked); setErr('') }} /><span>I agree to this service agreement.</span></label>
              {err && <p className="ferr" role="alert">{err}</p>}
              <button type="button" className="btn call" disabled={busy} onClick={() => start(async () => {
                const r = await clientSign(code, name, agree)
                if (!r.ok) { setErr(r.error); return }
                setDone(r.message); window.scrollTo({ top: 0, behavior: 'smooth' })
              })}>{busy ? 'Signing…' : 'Sign agreement'}</button>
            </div>
          </>
        ) : (
          <>
            <div className="sheetbtns"><button type="button" className="btn log" onClick={() => window.print()}>Download PDF</button></div>
            {children}
          </>
        )}
      </article>
    </>
  )
}
