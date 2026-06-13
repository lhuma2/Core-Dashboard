'use client'

import { useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function ClientLoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient() // auto-selects sb-client cookie namespace
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('Invalid email or password. Please try again.')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const role = user?.user_metadata?.role ?? ''

    if (role !== 'client') {
      await supabase.auth.signOut()
      setError('This portal is for clients only.')
      setLoading(false)
      return
    }

    window.location.href = '/client/dashboard'
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden bg-[#0b1320] p-6">
      {/* Glow + watermark */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 110%, rgba(30,58,95,0.8), transparent 65%)' }}
      />
      <span
        aria-hidden
        className="font-display absolute -right-20 -bottom-32 text-[24rem] font-black leading-none select-none text-white/[0.04]"
      >
        Δ
      </span>

      <div className="relative w-full max-w-sm">
        <div className="flex justify-center mb-3">
          <Image src="/logo-white.png" alt="Delta Cleaning" width={150} height={46} className="object-contain" priority />
        </div>
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-400/80 mb-8">
          Client Portal
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-300 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.trim())}
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[16px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400/50 transition"
              placeholder="you@company.com.au"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl text-[16px] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/30 focus:border-sky-400/50 transition"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-white hover:bg-slate-100 text-[#0b1320] text-sm font-bold rounded-xl shadow-[0_4px_20px_rgba(255,255,255,0.12)] transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-500 mt-8">Delta Cleaning · Brisbane, QLD</p>
      </div>
    </div>
  )
}
