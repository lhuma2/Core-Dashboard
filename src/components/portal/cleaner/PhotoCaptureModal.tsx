'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, X, CheckCircle2, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import { deleteJobPhotoAction } from '@/actions/jobs'
import { queuePhoto, flushPhotoQueue, removeQueuedPhoto, claimPhoto, releasePhoto, PHOTO_UPLOADED_EVENT, type QueuedPhoto } from '@/lib/photoQueue'
import { uploadJobPhoto } from '@/lib/uploadJobPhoto'
import { stampPhotoWithThumb } from '@/lib/stampPhoto'

type Phase = 'before' | 'after'
type PhotoStatus = 'uploading' | 'uploaded' | 'queued' | 'failed'

interface PhotoEntry {
  id: string
  /** Small preview shown in the grid (the full photo if no preview could be made) */
  localUrl: string
  file: File
  status: PhotoStatus
  storagePath: string | null
  error?: string
}

interface PhotoCaptureModalProps {
  jobId: string
  phase: Phase
  /** Which table jobId points at — job_assignments' jobs, or a bond_jobs clean */
  jobKind?: 'job_assignment' | 'bond_job' | 'residential_job'
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

async function uploadFile(jobId: string, phase: Phase, file: File | Blob, jobKind: 'job_assignment' | 'bond_job' | 'residential_job', photoId: string) {
  const res = await uploadJobPhoto(jobId, file, phase, jobKind, photoId)
  return 'error' in res ? { error: res.error, offline: res.offline } : { storagePath: res.storagePath, offline: false }
}

export function PhotoCaptureModal({ jobId, phase, jobKind = 'job_assignment', onClose }: PhotoCaptureModalProps) {
  const cameraInputRef  = useRef<HTMLInputElement>(null)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [preparing, setPreparing] = useState(0)
  const [isOffline, setIsOffline] = useState(false)
  const photosRef = useRef(photos)
  photosRef.current = photos
  // Photos removed while their upload was still running: deleted once it lands.
  const removedRef = useRef(new Set<string>())

  useEffect(() => {
    setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine)
    function goOnline() { setIsOffline(false); retryAll() }
    function goOffline() { setIsOffline(true) }
    // The job screen's own queue flush can upload one of this box's pending photos first.
    function onFlushed(e: Event) {
      const { id, storagePath } = (e as CustomEvent<{ id: string; storagePath: string | null }>).detail
      setPhotos((p) => p.map((x) => x.id === id ? { ...x, status: 'uploaded', storagePath, error: undefined } : x))
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    window.addEventListener(PHOTO_UPLOADED_EVENT, onFlushed)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener(PHOTO_UPLOADED_EVENT, onFlushed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => { photosRef.current.forEach((p) => URL.revokeObjectURL(p.localUrl)) }
  }, [])

  function toQueued(entry: PhotoEntry): QueuedPhoto {
    return {
      id: entry.id,
      jobId,
      jobKind,
      phase,
      blob: entry.file,
      fileName: entry.file.name,
      contentType: entry.file.type || 'image/jpeg',
      queuedAt: new Date().toISOString(),
    }
  }

  /** Uploads a photo the caller has already claimed (claimPhoto), and releases it after. */
  async function attemptUpload(entry: PhotoEntry) {
    try {
      const result = await uploadFile(jobId, phase, entry.file, jobKind, entry.id)
      if (removedRef.current.has(entry.id)) {
        // Removed while uploading: don't keep it anywhere.
        removeQueuedPhoto(entry.id).catch(() => {})
        if (result.storagePath) deleteJobPhotoAction(result.storagePath).catch(() => {})
        return
      }
      if (!result.error) {
        setPhotos((p) => p.map((x) => x.id === entry.id ? { ...x, status: 'uploaded', storagePath: result.storagePath ?? null, error: undefined } : x))
        removeQueuedPhoto(entry.id).catch(() => {})
        return
      }
      // Keep every photo that didn't upload in IndexedDB, so it survives this box or
      // the app being closed and is retried when the job is next opened or signal returns.
      if (typeof indexedDB !== 'undefined') await queuePhoto(toQueued(entry)).catch(() => {})
      setPhotos((p) => p.map((x) => x.id === entry.id ? { ...x, status: result.offline ? 'queued' : 'failed', error: result.error } : x))
    } finally {
      releasePhoto(entry.id)
    }
  }

  function startUpload(entry: PhotoEntry) {
    if (!claimPhoto(entry.id)) return
    setPhotos((p) => p.map((x) => x.id === entry.id ? { ...x, status: 'uploading' } : x))
    attemptUpload(entry)
  }

  async function retryAll() {
    // Retry anything marked failed/queued in this box first (claiming them), then
    // anything queued in IndexedDB from a previous session — the flush skips claimed photos.
    photosRef.current.filter((p) => p.status === 'failed' || p.status === 'queued').forEach(startUpload)
    await flushPhotoQueue(jobId, (entry) => uploadFile(entry.jobId, entry.phase, entry.blob, entry.jobKind, entry.id)).catch(() => {})
  }

  async function addFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? [])
    if (!files.length) return
    const takenAt = new Date()
    setPreparing((n) => n + files.length)
    // One at a time: decoding several full-size camera photos at once can run iOS out of memory.
    // Each photo starts uploading as soon as it's ready; uploadJobPhoto limits how many run at once.
    for (const original of files) {
      try {
        // Stamp before upload/queueing so the stored (and any offline-queued) copy carries the date + time
        const { file, thumb } = await stampPhotoWithThumb(original, takenAt)
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
        const entry: PhotoEntry = { id, localUrl: URL.createObjectURL(thumb ?? file), file, status: 'uploading', storagePath: null }
        claimPhoto(id)
        // Saved on the phone before uploading, so closing this box or the app
        // mid-upload never loses it: it's retried when the job is next opened.
        if (typeof indexedDB !== 'undefined') await queuePhoto(toQueued(entry)).catch(() => {})
        setPhotos((p) => [...p, entry])
        attemptUpload(entry)
      } finally {
        setPreparing((n) => n - 1)
      }
    }
  }

  function retryOne(id: string) {
    const entry = photos.find((p) => p.id === id)
    if (entry) startUpload(entry)
  }

  function removePhoto(id: string) {
    const entry = photos.find((p) => p.id === id)
    if (!entry) return
    URL.revokeObjectURL(entry.localUrl)
    setPhotos((p) => p.filter((x) => x.id !== id))
    removedRef.current.add(id)
    removeQueuedPhoto(id).catch(() => {})
    // Already uploaded — clean up the stored copy too, not just the on-screen
    // thumbnail, so an accidental shot doesn't linger for the admin to see.
    // One still uploading is deleted when its upload finishes.
    if (entry.storagePath) {
      deleteJobPhotoAction(entry.storagePath).catch(() => {})
    }
  }

  const copy = PHASE_COPY[phase]
  const uploadingCount = photos.filter((p) => p.status === 'uploading').length + preparing
  const anyUploading = uploadingCount > 0
  const uploadedCount = photos.filter((p) => p.status === 'uploaded').length
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
                  <img src={p.localUrl} alt="" decoding="async" className="w-full h-full object-cover" />
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
            {anyUploading ? `Uploading… ${uploadedCount}/${uploadedCount + uploadingCount}` : 'Submit'}
          </button>
        </div>
        {anyPending && !anyUploading && (
          <p className="text-[11px] text-center text-amber-600 mt-2">
            {photos.find((p) => p.status === 'failed')?.error ?? 'Some photos haven’t uploaded yet.'} They’re saved on this phone and will keep trying each time you open the job.
          </p>
        )}
      </div>
    </div>
  )
}
