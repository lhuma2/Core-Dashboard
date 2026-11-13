'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Client login (mock-up). The email isn't case sensitive; the password is. */
export function ClientLogin() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  async function login(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    const em = email.trim().toLowerCase()
    if (!em || !pw) { setErr('Enter your email and password.'); return }
    setBusy(true); setErr(''); setNote('')
    const sb = createClient('client')
    const { data, error } = await sb.auth.signInWithPassword({ email: em, password: pw })
    if (error || !data.user) {
      setBusy(false)
      setErr(/fetch|network/i.test(error?.message || '') ? 'Couldn’t reach the server. Check your connection and try again.' : 'That email or password doesn’t match. Check the capital letters.')
      return
    }
    if ((data.user.user_metadata?.role as string) !== 'client') {
      await sb.auth.signOut().catch(() => {})
      setBusy(false); setErr('This login is for Core Cleaning clients. Staff log in at the main login page.')
      return
    }
    window.location.replace('/client/app')
  }
  async function forgot() {
    const em = email.trim().toLowerCase()
    setErr('')
    if (!em) { setNote('Enter your email above first, then tap Forgot password.'); return }
    try { await createClient('client').auth.resetPasswordForEmail(em, { redirectTo: window.location.origin + '/client/reset' }) } catch { /* same answer either way */ }
    setNote(`If ${em} has a portal login, we’ve emailed it a link to set a new password.`)
  }

  return (
    <form className="stack" onSubmit={login} noValidate>
      <div>
        <h1 className="h1">Client login</h1>
        <p className="hint">Use the email and password from your Core Cleaning welcome email.</p>
      </div>
      <label className="fld"><span>Email</span>
        <input type="email" inputMode="email" autoComplete="username" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={email} onChange={e => { setEmail(e.target.value); setErr('') }} />
      </label>
      <label className="fld"><span>Password</span>
        <span className="pwrow">
          <input type={show ? 'text' : 'password'} autoComplete="current-password" autoCapitalize="off" autoCorrect="off" value={pw} onChange={e => { setPw(e.target.value); setErr('') }} />
          <button type="button" className="linkbtn" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
        </span>
      </label>
      <p className="hint">Passwords are case sensitive. A first-name password starts with a capital, e.g. Helen.</p>
      {err && <p className="ferr" role="alert">{err}</p>}
      <button type="submit" className="btn main" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <button type="button" className="linkbtn" onClick={forgot}>Forgot password?</button>
      {note && <p className="forgot" role="status">{note}</p>}
    </form>
  )
}
