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
  jobKind: 'job_assignment' | 'bond_job' | 'residential_job'
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

// Photo ids with an upload already under way on this page. The capture box and
// the job screen both flush the queue (on open, and when signal returns); this
// stops them sending the same photo twice.
const claimed = new Set<string>()

/** Marks a photo as being uploaded. Returns false if something else already is. */
export function claimPhoto(id: string): boolean {
  if (claimed.has(id)) return false
  claimed.add(id)
  return true
}

export function releasePhoto(id: string): void {
  claimed.delete(id)
}

/**
 * Attempts to flush every queued photo for a job through `uploadFn`.
 * Leaves an entry in the queue if its upload fails again (still offline).
 * Uploads are started together; uploadJobPhoto limits how many run at once.
 */
export const PHOTO_UPLOADED_EVENT = 'job-photo-uploaded'

export async function flushPhotoQueue(
  jobId: string,
  uploadFn: (entry: QueuedPhoto) => Promise<{ error?: string; storagePath?: string | null }>,
): Promise<{ uploaded: string[]; stillPending: number }> {
  if (typeof indexedDB === 'undefined') return { uploaded: [], stillPending: 0 }
  const pending = (await getQueuedPhotos(jobId)).filter((entry) => claimPhoto(entry.id))
  const uploaded: string[] = []
  await Promise.all(pending.map(async (entry) => {
    try {
      const result = await uploadFn(entry)
      if (!result.error) {
        await removeQueuedPhoto(entry.id)
        uploaded.push(entry.id)
        // Lets an open photo box show this photo as uploaded instead of still pending.
        window.dispatchEvent(new CustomEvent(PHOTO_UPLOADED_EVENT, { detail: { id: entry.id, storagePath: result.storagePath ?? null } }))
      }
    } catch {
      // Still offline / still failing — leave it queued, try again next flush
    } finally {
      releasePhoto(entry.id)
    }
  }))
  const remaining = await getQueuedPhotos(jobId)
  return { uploaded, stillPending: remaining.length }
}
