'use client'

import { useState, useEffect } from 'react'
import { Bell, BellOff, BellRing } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

type State = 'idle' | 'subscribed' | 'denied' | 'loading' | 'unsupported'

interface Props {
  /** Optional extra className for positioning */
  className?: string
}

export function PushSubscribeButton({ className = '' }: Props) {
  const [state, setState] = useState<State>('idle')

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setState('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setState('denied')
      return
    }
    // Check if already subscribed
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setState('subscribed')
      })
    ).catch(() => {})
  }, [])

  async function handleClick() {
    if (state === 'subscribed' || state === 'loading' || state === 'unsupported') return

    setState('loading')

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('denied')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) { setState('idle'); return }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      const json = subscription.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      })

      setState('subscribed')
    } catch {
      setState('idle')
    }
  }

  if (state === 'unsupported') return null

  if (state === 'subscribed') {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-gray-400 ${className}`}>
        <BellRing className="w-3.5 h-3.5" />
        <span>Notifications on</span>
      </div>
    )
  }

  if (state === 'denied') {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-gray-400 ${className}`} title="Enable notifications in your browser settings">
        <BellOff className="w-3.5 h-3.5" />
        <span>Notifications blocked</span>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading'}
      className={`flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black transition-colors disabled:opacity-50 ${className}`}
    >
      <Bell className="w-3.5 h-3.5" />
      <span>{state === 'loading' ? 'Enabling…' : 'Enable notifications'}</span>
    </button>
  )
}
