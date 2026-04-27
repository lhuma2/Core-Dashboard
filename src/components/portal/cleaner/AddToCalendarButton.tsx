'use client'

import { Calendar } from 'lucide-react'

interface Props {
  webcalUrl: string
  googleUrl: string
}

export function AddToCalendarButton({ webcalUrl, googleUrl }: Props) {
  function handle() {
    const ua = navigator.userAgent
    const isAndroid = /Android/.test(ua)

    if (isAndroid) {
      window.open(googleUrl, '_blank', 'noopener,noreferrer')
    } else {
      // iOS / Mac — use webcal:// which opens Apple Calendar directly
      window.location.href = webcalUrl
    }
  }

  return (
    <button
      onClick={handle}
      className="w-full flex items-center justify-center gap-2 bg-black text-white text-xs font-semibold rounded-xl py-3 active:scale-[0.98] transition-all"
    >
      <Calendar className="w-3.5 h-3.5" />
      Add to Calendar
    </button>
  )
}
