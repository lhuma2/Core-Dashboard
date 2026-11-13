'use client'
import { useEffect, useState } from 'react'
import { allPhotos, isSignedOut, onPhotos, startSender, type QPhoto } from '@/lib/crew/photo-queue'

/** Every photo on this phone, kept current as the sender works. */
export function usePhotos(today: string): { list: QPhoto[]; online: boolean; ready: boolean } {
  const [list, setList] = useState<QPhoto[]>([])
  const [online, setOnline] = useState(true)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let live = true
    const read = () => allPhotos().then(l => { if (live) { setList(l); setReady(true) } }).catch(() => { if (live) setReady(true) })
    const net = () => setOnline(navigator.onLine !== false)
    net(); read(); startSender(today)
    const off = onPhotos(() => { net(); read() })
    window.addEventListener('online', net); window.addEventListener('offline', net)
    return () => { live = false; off(); window.removeEventListener('online', net); window.removeEventListener('offline', net) }
  }, [today])
  return { list, online, ready }
}

/** The home screen tray: shows while any photo is still waiting to send. */
export function usePhotoTray(today: string): { off: boolean; title: string; sub: string } | null {
  const { list, online } = usePhotos(today)
  const waitN = list.filter(p => p.state === 'wait').length
  if (!waitN) return null
  const off = !online
  const n = list.length
  return {
    off,
    title: off ? waitN + ' photo' + (waitN === 1 ? '' : 's') + ' saved on this phone' : 'Sending photos: ' + (n - waitN) + ' of ' + n + ' sent',
    sub: off ? 'No signal right now. They send by themselves when you’re back online, even if you close the app.'
      : isSignedOut() ? 'Log in again and they carry on sending. Nothing is lost.' : 'You can keep working or close the app. Nothing is lost.',
  }
}
