'use client'

// Magic-link landing page. Supabase redirects the client here after they click
// the sign-in link in their email. We complete the PKCE exchange in the *client*
// cookie namespace (the same one signInWithOtp used), then send them to their
// dashboard. Password login is unaffected — this is an additive path for clients.
//
// This route is listed in middleware PUBLIC_ROUTES so the exchange can happen
// before a session exists.

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function AuthCallbackPage() {
  const [message, setMessage] = useState('Signing you in…')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const run = async () => {
      // Must use the 'client' namespace — that's where signInWithOtp stored the
      // PKCE code verifier, and where the client portal reads its session.
      const supabase = createClient('client')

      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const errorDescription = params.get('error_description')

      if (errorDescription) {
        setFailed(true)
        setMessage('This sign-in link is invalid or has expired. Please request a new one.')
        return
      }

      // Exchange the one-time code for a session (PKCE; same browser as request).
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setFailed(true)
          setMessage('We couldn’t sign you in with that link. Please request a fresh one from the same device.')
          return
        }
      }

      const { data: { user } } = await supabase.auth.getUser()
      const role = (user?.user_metadata?.role as string | undefined) ?? null

      if (!user) {
        setFailed(true)
        setMessage('This sign-in link is invalid or has expired. Please request a new one.')
        return
      }

      if (role === 'client') {
        // Hard navigation so the fresh session cookie is sent on the next request.
        window.location.href = '/client/dashboard'
        return
      }

      // Magic-link is for clients; staff/managers use password login.
      setFailed(true)
      setMessage('Sign-in links are for client accounts. Please use the password login.')
    }
    run().catch(() => {
      setFailed(true)
      setMessage('Something went wrong signing you in. Please try the link again.')
    })
  }, [])

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <Image src="/logo-white.png" alt="Delta Cleaning" width={150} height={46} className="object-contain invert" priority />
        </div>
        {!failed ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-[#1e3a5f] rounded-full animate-spin" />
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-700 mb-6">{message}</p>
            <a href="/login" className="inline-block py-3 px-6 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold rounded-xl transition">
              Back to sign in
            </a>
          </>
        )}
      </div>
    </div>
  )
}
