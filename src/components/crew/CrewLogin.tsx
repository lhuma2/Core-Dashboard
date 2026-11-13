'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/** Cleaner login (mock-up). The email isn't case-sensitive; the password is. A username without @ also works. */
export function CrewLogin() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)

  async function login(e?: React.FormEvent) {
    e?.preventDefault()
    if (busy) return
    const em = email.trim().toLowerCase()
    if (!em || !pw) { setErr('Enter your email and password.'); return }
    setBusy(true); setErr('')
    const sb = createClient('cleaner')
    const { data, error } = await sb.auth.signInWithPassword({ email: em.includes('@') ? em : em + '@core-cleaner.internal', password: pw })
    if (error || !data.user) {
      setBusy(false)
      setErr(/fetch|network/i.test(error?.message || '') ? 'Couldn’t reach the server. Check your signal and try again.' : 'That email or password doesn’t match. Check the capital letters.')
      return
    }
    if ((data.user.user_metadata?.role as string) !== 'cleaner') {
      await sb.auth.signOut().catch(() => {})
      setBusy(false); setErr('This login is for cleaners. Staff log in at the main login page.')
      return
    }
    window.location.replace('/cleaner/app')
  }

  return (
    <form className="stack" onSubmit={login} noValidate>
      <div>
        <h1 className="h1">Cleaner login</h1>
        <p className="hint">Use the email and password from your welcome email.</p>
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
      <p className="hint">Passwords are case sensitive. A first-name password starts with a capital, e.g. Angela.</p>
      {err && <p className="ferr" role="alert">{err}</p>}
      <button type="submit" className="btn main" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      <button type="button" className="linkbtn" onClick={() => setForgot(f => !f)} aria-expanded={forgot}>Forgot password?</button>
      {forgot && <p className="forgot" role="status">Message Laith to reset it. Laith sets a new starter password for you, and you choose your own the next time you log in.</p>}
    </form>
  )
}
