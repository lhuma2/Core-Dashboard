'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

/** Green bar with the logo and, when signed in, the account menu (Signed in as … / Change password / Log out). */
export function ClientTop({ initials, email }: { initials: string | null; email: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    // keep the sign-in fresh: the browser refreshes the token and saves it in the cookie the server reads
    if (!initials) return
    const sb = createClient('client')
    const tick = () => { if (document.visibilityState === 'visible' && navigator.onLine !== false) sb.auth.getSession().catch(() => {}) }
    tick()
    document.addEventListener('visibilitychange', tick); window.addEventListener('focus', tick)
    const t = window.setInterval(tick, 5 * 60 * 1000)
    return () => { document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); window.clearInterval(t) }
  }, [initials])
  useEffect(() => {
    // after Log out, the back button must not show a signed-in page from the browser's memory
    const back = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload() }
    window.addEventListener('pageshow', back)
    return () => window.removeEventListener('pageshow', back)
  }, [])
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const away = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.menu,.avatar')) setOpen(false) }
    document.addEventListener('keydown', esc); document.addEventListener('click', away)
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('click', away) }
  }, [open])

  async function logout() {
    setBusy(true)
    try { await createClient('client').auth.signOut() } catch { /* signed out locally anyway */ }
    window.location.replace('/client/login')
  }

  return (
    <>
      <header className="top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/hub-logo-white.png" alt="Core Cleaning" />
        {initials && <button type="button" className="avatar" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label="Account menu">{initials}</button>}
      </header>
      {initials && open && (
        <div className="menu" role="menu">
          <div className="who">Signed in as {email}</div>
          <Link className="mitem" role="menuitem" href="/client/app/password" onClick={() => setOpen(false)}>Change password</Link>
          <button type="button" className="mitem" role="menuitem" onClick={logout} disabled={busy}>{busy ? 'Logging out…' : 'Log out'}</button>
        </div>
      )}
    </>
  )
}
