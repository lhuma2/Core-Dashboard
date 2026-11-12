/**
 * Uploads one cleaner job photo (already stamped) to /cleaner/photos/upload.
 *
 * Every failure comes back as a plain sentence a cleaner can act on, and
 * `offline` says whether it's worth keeping the photo to retry later (no
 * signal) rather than a problem retrying won't fix (signed out, bad file).
 * Brief network blips and server hiccups are retried here first.
 *
 * At most MAX_PARALLEL uploads run at once across the whole page. A deep
 * clean can pick 30-40 photos in one go; sending them all together splits a
 * phone's upload bandwidth so thin that every one hits the timeout and fails.
 */

import { shrinkPhoto } from './stampPhoto'
import { photoWorkStarted, photoWorkEnded } from './photoActivity'

export type JobKind = 'job_assignment' | 'bond_job' | 'residential_job'
export type UploadResult =
  | { url: string; storagePath: string }
  | { error: string; offline: boolean }

const ATTEMPTS = 3
const TIMEOUT_MS = 60_000
const MAX_PARALLEL = 3

let running = 0
const waiting: (() => void)[] = []

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL) await new Promise<void>((r) => waiting.push(r))
  else running++
  try {
    return await fn()
  } finally {
    // Hand the slot straight to the next upload in line, or free it.
    const next = waiting.shift()
    if (next) next()
    else running--
  }
}

/** `photoId` is a stable id for this photo on the phone, so a retry of a photo that already arrived isn't stored twice. */
export async function uploadJobPhoto(jobId: string, file: File | Blob, phase: 'before' | 'after', jobKind: JobKind = 'job_assignment', photoId?: string): Promise<UploadResult> {
  photoWorkStarted()
  try {
    return await sendJobPhoto(jobId, file, phase, jobKind, photoId)
  } finally {
    photoWorkEnded()
  }
}

async function sendJobPhoto(jobId: string, file: File | Blob, phase: 'before' | 'after', jobKind: JobKind, photoId?: string): Promise<UploadResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { error: 'No signal. The photo will upload when you’re back online.', offline: true }
  }
  // Safety net: anything still large (e.g. queued before photos were shrunk) is shrunk now.
  const photo = await shrinkPhoto(file)

  let last: UploadResult = { error: 'Upload failed. Tap the photo to try again.', offline: false }
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const fd = new FormData()
    fd.append('photo', photo)
    fd.append('jobId', jobId)
    fd.append('phase', phase)
    fd.append('jobKind', jobKind)
    if (photoId) fd.append('photoId', photoId)
    let res: Response
    let body: any
    try {
      // The timeout only starts once this photo's turn comes, not while it waits in line.
      ;({ res, body } = await withSlot(async () => {
        // AbortController + setTimeout, not AbortSignal.timeout: older iPhones don't have the latter.
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
        try {
          const r = await fetch('/cleaner/photos/upload', { method: 'POST', body: fd, signal: ctrl.signal, credentials: 'same-origin' })
          return { res: r, body: await r.json().catch(() => null) }
        } finally {
          clearTimeout(timer)
        }
      }))
    } catch {
      // No response at all: no signal, or the connection dropped mid-upload.
      last = { error: 'Weak or no signal. The photo will upload when the connection is back.', offline: true }
      if (attempt < ATTEMPTS) { await wait(attempt * 1500); continue }
      return last
    }
    if (res.ok && body?.url) return { url: body.url, storagePath: body.storagePath }
    // Signed out: the request was sent to the login page instead.
    if (res.status === 401 || res.redirected || body == null && res.ok) {
      return { error: 'You’ve been signed out. Sign in again, then add the photo again.', offline: false }
    }
    if (res.status === 413 || body?.error === 'too_large') {
      return { error: 'This photo is too large to upload. Try taking it again with the camera.', offline: false }
    }
    if (res.status >= 400 && res.status < 500) return { error: body?.error || 'Upload failed.', offline: false }
    // Server-side hiccup: try again shortly.
    last = { error: 'Upload failed. Tap the photo to try again.', offline: false }
    if (attempt < ATTEMPTS) await wait(attempt * 1500)
  }
  return last
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
