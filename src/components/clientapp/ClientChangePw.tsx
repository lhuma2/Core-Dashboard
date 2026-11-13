'use client'
import { useState } from 'react'
import Link from 'next/link'
import { clientSavePassword } from '@/actions/client-portal'
import { setFlash } from '@/lib/hub/flash'
import { pwCheck } from '@/lib/clientapp/portal'
import { PwFields } from './PwFields'

const Back = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>

/** Menu → Change password: needs the current one. */
export function ClientChangePw({ first }: { first: string }) {
  const [p0, setP0] = useState('')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    if (!p0) { setErr('Your current password isn’t right.'); return }
    const bad = pwCheck(p1, p2, first)
    if (bad) { setErr(bad); return }
    if (p1 === p0) { setErr('That’s the same as your current password.'); return }
    setBusy(true); setErr('')
    try {
      const r = await clientSavePassword(p0, p1, p2)
      if (!r.ok) { setErr(r.error); setBusy(false); return }
      setFlash(r.toast)
      window.location.replace('/client/app')
    } catch { setErr('That didn’t save. Check your connection and try again.'); setBusy(false) }
  }

  return (
    <>
      <Link className="back" href="/client/app"><Back /> Back</Link>
      <form className="stack" onSubmit={save} noValidate>
        <h1 className="h1">Change password</h1>
        <label className="fld"><span>Current password</span>
          <input type={show ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="off" autoCorrect="off" value={p0} onChange={e => { setP0(e.target.value); setErr('') }} />
        </label>
        <PwFields p1={p1} p2={p2} setP1={v => { setP1(v); setErr('') }} setP2={v => { setP2(v); setErr('') }} show={show} setShow={setShow} first={first} />
        {err && <p className="ferr" role="alert">{err}</p>}
        <button type="submit" className="btn main" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </>
  )
}
