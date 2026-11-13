'use client'
import { useState } from 'react'
import { clientSavePassword, clientSkipWelcome } from '@/actions/client-portal'
import { setFlash } from '@/lib/hub/flash'
import { pwCheck } from '@/lib/clientapp/portal'
import { PwFields } from './PwFields'

/** First login: their login details in one place, then change the starter password now or skip. */
export function ClientWelcome({ first, biz, email }: { first: string; biz: string; email: string }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function go(fn: () => Promise<{ ok: true; toast: string } | { ok: false; error: string }>) {
    setBusy(true); setErr('')
    try {
      const r = await fn()
      if (!r.ok) { setErr(r.error); setBusy(false); return }
      setFlash(r.toast)
      window.location.replace('/client/app')
    } catch { setErr('That didn’t save. Check your connection and try again.'); setBusy(false) }
  }
  function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    const bad = pwCheck(p1, p2, first)
    if (bad) { setErr(bad); return }
    go(() => clientSavePassword(null, p1, p2))
  }

  return (
    <div className="stack">
      <div className="welcomehead">
        <h1 className="h1">Welcome to Core Cleaning, {first}</h1>
        <p className="hint">Thanks for choosing us for {biz}. This is your client portal. Here are your login details, so you have them in one place.</p>
      </div>
      <div className="card creds">
        <div><span>Website</span><span className="cv">portal.corecleaning.services</span></div>
        <div><span>Username</span><span className="cv">{email}</span></div>
        <div><span>Password</span><span className="cv">Your first name, starting with a capital</span></div>
      </div>
      <form className="card stack inner" onSubmit={save} noValidate>
        <div>
          <h2 className="h2">Change your password now</h2>
          <p className="hint">Your starter password is your first name, so it’s easy to guess. Choose one only you know.</p>
        </div>
        <PwFields p1={p1} p2={p2} setP1={v => { setP1(v); setErr('') }} setP2={v => { setP2(v); setErr('') }} show={show} setShow={setShow} first={first} />
        {err && <p className="ferr" role="alert">{err}</p>}
        <button type="submit" className="btn main" disabled={busy}>{busy ? 'Saving…' : 'Save my new password'}</button>
        <button type="button" className="linkbtn center" disabled={busy} onClick={() => go(clientSkipWelcome)}>Skip for now, I’ll keep the starter password</button>
      </form>
    </div>
  )
}
