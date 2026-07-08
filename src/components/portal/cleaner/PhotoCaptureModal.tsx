'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, X, CheckCircle2, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { uploadJobPhotoAction, deleteJobPhotoAction } from '@/actions/jobs'
import { queuePhoto, flushPhotoQueue, type QueuedPhoto } from '@/lib/photoQueue'

type Phase = 'before' | 'after'
type PhotoStatus = 'uploading' | 'uploaded' | 'queued' | 'failed'

interface PhotoEntry {
  id: string
  localUrl: string
  file: File
  status: PhotoStatus
  storagePath: string | null
}

interface PhotoCaptureModalProps {
  jobId: string
  phase: Phase
  /** Which table jobId points at — job_assignments' jobs, or a bond_jobs clean */
  jobKind?: 'job_assignment' | 'bond_job'
  /** Called once the cleaner is done (Submit or Skip) */
  onClose: () => void
}

const PHASE_COPY: Record<Phase, { title: string; hint: string }> = {
  before: {
    title: 'Before you start',
    hint: 'Photograph the area’s condition before you begin cleaning.',
  },
  after: {
    title: 'Finishing up',
    hint: 'Photograph the finished result before you submit.',
  },
}

async function uploadFile(jobId: string, phase: Phase, file: File, jobKind: 'job_assignment' | 'bond_job') {
  const fd = new FormData()
  fd.append('photo', file)
  return uploadJobPhotoAction(jobId, fd, phase, jobKind)
}

export function PhotoCaptureModal({ jobId, phase, jobKind = 'job_assignment', onClose }: PhotoCaptureModalProps) {
  const cameraInputRef  = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine)
    function goOnline() { setIsOffline(false); retryAll() }
    function goOffline() { setIsOffline(true) }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => { photos.forEach((p) => URL.revokeObjectURL(p.localUrl)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function attemptUpload(entry: PhotoEntry) {
    try {
      const result = await uploadFile(jobId, phase, entry.file, jobKind)
      if (result.error) {
        setPhotos((p) => p.map((x) => x.id === entry.id ? { ...x, status: 'failed' } : x))
      } else {
        setPhotos((p) => p.map((x) => x.id === entry.id ? { ...x, status: 'uploaded', storagePath: result.storagePath ?? null } : x))
      }
    } catch {
      // Network failure (or genuinely offline) — queue to IndexedDB so it survives
      // the app being closed, and retry automatically once back online.
      if (typeof indexedDB !== 'undefined') {
        const queued: QueuedPhoto = {
          id: entry.id,
          jobId,
          jobKind,
          phase,
          blob: entry.file,
          fileName: entry.file.name,
          contentType: entry.file.type || 'image/jpeg',
          queuedAt: new Date().toISOString(),
        }
        await queuePhoto(queued)
        setPhotos((p) => p.map((x) => x.id === entry.id ? { ...x, status: 'queued' } : x))
      } else {
        setPhotos((p) => p.map((x) => x.id === entry.id ? { ...x, status: 'failed' } : x))
      }
    }
  }

  async function retryAll() {
    // Retry anything queued in IndexedDB from this or a previous session
    await flushPhotoQueue(jobId, async (entry) => {
      const file = new File([entry.blob], entry.fileName, { type: entry.contentType })
      return uploadFile(entry.jobId, entry.phase, file, entry.jobKind)
    })
    // Retry anything marked failed/queued in this modal's current state
    const stuck = photos.filter((p) => p.status === 'failed' || p.status === 'queued')
    for (const entry of stuck) {
      setPhotos((p) => p.map((x) => x.id === entry.id ? { ...x, status: 'uploading' } : x))
      await attemptUpload(entry)
    }
  }

  function addFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (!files.length) return
    for (const file of files) {
      const id = `${Date.now()}-${Math.random()}`
      const entry: PhotoEntry = { id, localUrl: URL.createObjectURL(file), file, status: 'uploading', storagePath: null }
      setPhotos((p) => [...p, entry])
      attemptUpload(entry)
    }
  }

  function retryOne(id: string) {
    const entry = photos.find((p) => p.id === id)
    if (!entry) return
    setPhotos((p) => p.map((x) => x.id === id ? { ...x, status: 'uploading' } : x))
    attemptUpload(entry)
  }

  function removePhoto(id: string) {
    const entry = photos.find((p) => p.id === id)
    if (!entry) return
    URL.revokeObjectURL(entry.localUrl)
    setPhotos((p) => p.filter((x) => x.id !== id))
    // Already uploaded (or queued for upload) — clean up the stored copy too,
    // not just the on-screen thumbnail, so an accidental shot doesn't linger
    // for the admin to see.
    if (entry.storagePath) {
      deleteJobPhotoAction(entry.storagePath).catch(() => {})
    }
  }

  const copy = PHASE_COPY[phase]
  const anyUploading = photos.some((p) => p.status === 'uploading')
  const anyPending    = photos.some((p) => p.status === 'queued' || p.status === 'failed')

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center sm:justify-center">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-black">{copy.title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">{copy.hint}</p>

        {isOffline && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl px-3 py-2 mb-4">
            <WifiOff className="w-3.5 h-3.5 flex-shrink-0" />
            No connection — photos will be saved and uploaded automatically once you’re back online.
          </div>
        )}

        {photos.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500">Photos</p>
              <span className="text-xs font-semibold bg-black text-white px-2.5 py-1 rounded-full">
                {photos.length} taken
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.localUrl} alt="" className="w-full h-full object-cover" />
                  {p.status === 'uploading' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  {p.status === 'uploaded' && (
                    <div className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                  )}
                  {p.status === 'queued' && (
                    <button
                      onClick={() => retryOne(p.id)}
                      className="absolute inset-0 bg-amber-500/70 flex flex-col items-center justify-center gap-0.5"
                    >
                      <WifiOff className="w-4 h-4 text-white" />
                      <span className="text-white text-[9px] font-semibold">Pending upload</span>
                    </button>
                  )}
                  {p.status === 'failed' && (
                    <button
                      onClick={() => retryOne(p.id)}
                      className="absolute inset-0 bg-red-500/70 flex flex-col items-center justify-center gap-0.5"
                    >
                      <RefreshCw className="w-4 h-4 text-white" />
                      <span className="text-white text-[9px] font-semibold">Retry</span>
                    </button>
                  )}
                  {/* Remove — always available so an accidental shot can be undone */}
                  <button
                    onClick={() => removePhoto(p.id)}
                    aria-label="Remove photo"
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="mb-2">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-black text-white font-semibold text-sm rounded-2xl py-3.5 active:scale-[0.98] transition-all"
          >
            <Camera className="w-4 h-4" />
            Add Photos
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mb-4">
          Take as many as you need, then tap Done — no need to reopen this each time.
          Camera not opening? Enable it under Settings → Safari → Camera.
        </p>

        {/* No `capture` attribute — that forces iOS into a single-shot camera
            that closes after each photo. Without it, iOS opens its normal
            picker (which itself offers a Camera button), letting the cleaner
            snap several photos back-to-back before returning here once. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium text-gray-500 py-3"
          >
            Skip for now
          </button>
          <button
            onClick={onClose}
            disabled={anyUploading}
            className="flex-1 bg-brand-navy text-white font-semibold text-sm rounded-2xl py-3 disabled:opacity-40"
          >
            {anyUploading ? 'Uploading…' : 'Submit'}
          </button>
        </div>
        {anyPending && !anyUploading && (
          <p className="text-[11px] text-center text-amber-600 mt-2">
            Some photos are still pending upload — they’ll keep trying in the background.
          </p>
        )}
      </div>
    </div>
  )
}
