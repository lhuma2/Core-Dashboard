'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setFlash } from '@/lib/hub/flash'
import { pwCheck } from '@/lib/clientapp/portal'
import { PwFields } from './PwFields'
import { clientPasswordReset } from '@/actions/client-portal'

/** The page the Forgot password email opens: choose a new password, then go to the portal. */
export function ClientReset() {
  const [ready, setReady] = useState<'wait' | 'ok' | 'bad'>('wait')
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sb = createClient('client')
    const code = new URLSearchParams(window.location.search).get('code')
    ;(async () => {
      try {
        if (code) { const { error } = await sb.auth.exchangeCodeForSession(code); if (error) throw error }
        const { data } = await sb.auth.getSession()
        setReady(data.session ? 'ok' : 'bad')
      } catch { setReady('bad') }
    })()
  }, [])

  async function save(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    const bad = pwCheck(p1, p2, '')
    if (bad) { setErr(bad); return }
    setBusy(true); setErr('')
    const { error } = await createClient('client').auth.updateUser({ password: p1 })
    if (error) { setErr(/weak|pwned|leaked/i.test(error.message) ? 'That password is too easy to guess. Try a longer one.' : 'That didn’t save. Check your connection and try again.'); setBusy(false); return }
    try { await clientPasswordReset() } catch { /* the password itself is saved */ }
    setFlash('Password saved. Use it next time you log in.')
    window.location.replace('/client/app')
  }

  if (ready === 'wait') return <p className="hint">One moment…</p>
  if (ready === 'bad') return (
    <div className="stack">
      <h1 className="h1">That link has expired</h1>
      <p className="hint">Reset links work once and only for a short time. Go back to the login page and tap Forgot password again.</p>
      <a className="btn main" href="/client/login">Back to login</a>
    </div>
  )
  return (
    <form className="stack" onSubmit={save} noValidate>
      <div>
        <h1 className="h1">Set a new password</h1>
        <p className="hint">Choose one only you know. You’ll use it next time you log in.</p>
      </div>
      <PwFields p1={p1} p2={p2} setP1={v => { setP1(v); setErr('') }} setP2={v => { setP2(v); setErr('') }} show={show} setShow={setShow} first="" />
      {err && <p className="ferr" role="alert">{err}</p>}
      <button type="submit" className="btn main" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
    </form>
  )
}
