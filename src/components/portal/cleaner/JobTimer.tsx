'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  const pad = (n: number) => n.toString().padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/**
 * Counts up from `startedAt` (a server timestamp). Always recomputes elapsed
 * time from the real clock rather than an in-memory counter, so the display
 * is correct immediately after the app is backgrounded, killed, or the phone
 * is locked and reopened hours later.
 */
export function JobTimer({ startedAt }: { startedAt: string }) {
  const startMs = new Date(startedAt).getTime()
  const [elapsed, setElapsed] = useState(() => Date.now() - startMs)

  useEffect(() => {
    setElapsed(Date.now() - startMs)
    const id = setInterval(() => setElapsed(Date.now() - startMs), 1000)

    // Recompute immediately when the tab/app regains visibility, rather than
    // waiting for the next tick — covers the "locked phone for an hour" case.
    function onVisible() {
      if (document.visibilityState === 'visible') setElapsed(Date.now() - startMs)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [startMs])

  return (
    <div className="flex items-center gap-2 bg-black text-white rounded-2xl px-5 py-4">
      <Clock className="w-4 h-4 text-white/60 flex-shrink-0" />
      <div>
        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Clean in progress</p>
        <p className="text-xl font-bold tabular-nums">{formatElapsed(elapsed)}</p>
      </div>
    </div>
  )
}
