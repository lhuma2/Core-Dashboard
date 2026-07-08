/**
 * Offline-resilient photo upload queue.
 *
 * iOS Safari (the cleaner portal's only real-world runtime) does not support
 * the Background Sync API, so a queued upload can't finish itself while the
 * app is closed. Instead we persist the photo blob to IndexedDB (disk-backed,
 * survives the app being killed) and flush the queue whenever the portal is
 * opened or comes back online — good enough for "poor signal in the field",
 * not a guarantee of delivery within seconds of reconnecting.
 */

const DB_NAME = 'core-cleaning-photo-queue'
const STORE = 'pending-photos'

export interface QueuedPhoto {
  id: string
  jobId: string
  phase: 'before' | 'after'
  blob: Blob
  fileName: string
  contentType: string
  queuedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queuePhoto(entry: QueuedPhoto): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getQueuedPhotos(jobId?: string): Promise<QueuedPhoto[]> {
  const db = await openDb()
  const all = await new Promise<QueuedPhoto[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as QueuedPhoto[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return jobId ? all.filter((p) => p.jobId === jobId) : all
}

export async function removeQueuedPhoto(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

/**
 * Attempts to flush every queued photo for a job through `uploadFn`.
 * Leaves an entry in the queue if its upload fails again (still offline).
 */
export async function flushPhotoQueue(
  jobId: string,
  uploadFn: (entry: QueuedPhoto) => Promise<{ error?: string }>,
): Promise<{ uploaded: string[]; stillPending: number }> {
  if (typeof indexedDB === 'undefined') return { uploaded: [], stillPending: 0 }
  const pending = await getQueuedPhotos(jobId)
  const uploaded: string[] = []
  for (const entry of pending) {
    try {
      const result = await uploadFn(entry)
      if (!result.error) {
        await removeQueuedPhoto(entry.id)
        uploaded.push(entry.id)
      }
    } catch {
      // Still offline / still failing — leave it queued, try again next flush
    }
  }
  const remaining = await getQueuedPhotos(jobId)
  return { uploaded, stillPending: remaining.length }
}
