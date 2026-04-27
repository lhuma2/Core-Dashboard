'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer
}

interface EnablePushButtonProps {
  /** Compact icon-only mode for headers */
  compact?: boolean
}

export function EnablePushButton({ compact = false }: EnablePushButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleEnable() {
    setStatus('loading')
    setMessage('')

    try {
      // Check support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatus('error')
        setMessage('Push notifications are not supported in this browser.')
        return
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready

      // Request permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('error')
        setMessage('Notification permission denied.')
        return
      }

      // Subscribe to push
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })

      // Save to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Failed to save subscription')
      }

      setStatus('done')
      setMessage('Notifications enabled!')
    } catch (err: any) {
      setStatus('error')
      setMessage(err?.message ?? 'Something went wrong.')
    }
  }

  if (status === 'done') {
    if (compact) return (
      <button className="p-1.5 text-black" title="Notifications enabled" disabled>
        <Bell className="w-4 h-4" />
      </button>
    )
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Bell className="w-4 h-4 text-black" />
        <span>Notifications enabled</span>
      </div>
    )
  }

  if (compact) {
    return (
      <button
        onClick={handleEnable}
        disabled={status === 'loading'}
        className="p-1.5 text-gray-400 hover:text-black transition-colors disabled:opacity-40"
        title="Enable notifications"
      >
        <Bell className="w-4 h-4" />
      </button>
    )
  }

  return (
    <div className="space-y-1">
      <button
        onClick={handleEnable}
        disabled={status === 'loading'}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl px-4 py-2.5 active:scale-[0.98] transition-all disabled:opacity-50"
      >
        <Bell className="w-4 h-4" />
        {status === 'loading' ? 'Enabling…' : 'Enable Notifications'}
      </button>
      {message && (
        <p className={`text-xs ${status === 'error' ? 'text-red-500' : 'text-gray-400'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
