'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { submitJobAction, uploadJobPhotoAction, deleteJobPhotoAction } from '@/actions/jobs'
import { Camera, Video, X, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MIN_PHOTOS = 0
const MAX_PHOTOS = 10

interface ChecklistItem {
  id: string
  label: string
  required?: boolean
}

interface Props {
  jobId: string
  checklist: ChecklistItem[]
}

interface PhotoEntry {
  id: string          // local key
  localUrl: string    // blob URL — shown immediately
  remoteUrl: string | null  // Supabase URL — set after upload
  storagePath: string | null
  uploading: boolean
  error: string | null
}

interface VideoEntry {
  id: string
  localUrl: string    // blob URL — shown immediately in player
  remoteUrl: string | null  // Supabase URL
  name: string
  uploading: boolean
  error: string | null
}

/** Burns a neat AEST timestamp onto a photo and returns a stamped Blob */
async function stampPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)

      const now = new Date()
      const stamp = now.toLocaleString('en-AU', {
        timeZone:   'Australia/Brisbane',
        day:        '2-digit',
        month:      '2-digit',
        year:       'numeric',
        hour:       '2-digit',
        minute:     '2-digit',
        second:     '2-digit',
        hour12:     false,
      }) + ' AEST'

      const fontSize = Math.max(20, Math.round(canvas.width * 0.033))
      const padding  = Math.round(fontSize * 0.6)

      ctx.font      = `bold ${fontSize}px 'Helvetica Neue', Helvetica, Arial, sans-serif`
      ctx.textAlign = 'right'

      const textW = ctx.measureText(stamp).width
      const boxW  = textW + padding * 2
      const boxH  = fontSize + padding * 1.4
      const boxX  = canvas.width  - boxW - padding
      const boxY  = canvas.height - boxH - padding

      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.beginPath()
      const r = fontSize * 0.35
      ctx.roundRect(boxX, boxY, boxW, boxH, r)
      ctx.fill()

      ctx.fillStyle    = '#ffffff'
      ctx.shadowColor  = 'rgba(0,0,0,0.4)'
      ctx.shadowBlur   = 3
      ctx.fillText(stamp, canvas.width - padding * 2, boxY + boxH - padding * 0.7)

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')),
        'image/jpeg',
        0.88,
      )
    }
    img.onerror = reject
    img.src = objectUrl
  })
}

export function SubmitJobForm({ jobId, checklist }: Props) {
  const router        = useRouter()
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [photos,     setPhotos]     = useState<PhotoEntry[]>([])
  const [videos,     setVideos]     = useState<VideoEntry[]>([])
  const [checked,    setChecked]    = useState<Record<string, boolean>>({})
  const [notes,      setNotes]      = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Revoke blob URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      photos.forEach((p) => URL.revokeObjectURL(p.localUrl))
      videos.forEach((v) => URL.revokeObjectURL(v.localUrl))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const uploadedPhotos   = photos.filter((p) => p.remoteUrl)
  const requiredItems    = checklist.filter((i) => i.required)
  const allRequiredChecked = requiredItems.every((i) => checked[i.id])
  const anyUploading     = photos.some((p) => p.uploading) || videos.some((v) => v.uploading)
  const canSubmit        = uploadedPhotos.length >= MIN_PHOTOS
    && !anyUploading
    && (requiredItems.length === 0 || allRequiredChecked)

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos allowed`)
      return
    }
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''

    for (const file of files) {
      // 1. Show instant local preview
      const localUrl = URL.createObjectURL(file)
      const id       = `${Date.now()}-${Math.random()}`
      setPhotos((p) => [...p, { id, localUrl, remoteUrl: null, storagePath: null, uploading: true, error: null }])

      // 2. Stamp + upload in background
      try {
        const stamped     = await stampPhoto(file)
        const stampedFile = new File([stamped], file.name, { type: 'image/jpeg' })
        const fd          = new FormData()
        fd.append('photo', stampedFile)
        const result = await uploadJobPhotoAction(jobId, fd, 'after')
        if (result.error) {
          setPhotos((p) => p.map((x) => x.id === id ? { ...x, uploading: false, error: result.error! } : x))
        } else {
          setPhotos((p) => p.map((x) => x.id === id ? { ...x, uploading: false, remoteUrl: result.url!, storagePath: result.storagePath ?? null } : x))
        }
      } catch {
        setPhotos((p) => p.map((x) => x.id === id ? { ...x, uploading: false, error: 'Upload failed' } : x))
      }
    }
  }

  async function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    if (videoInputRef.current) videoInputRef.current.value = ''

    // 1. Show instant local video preview
    const localUrl = URL.createObjectURL(file)
    const id       = `${Date.now()}-${Math.random()}`
    setVideos((v) => [...v, { id, localUrl, remoteUrl: null, name: file.name, uploading: true, error: null }])

    // 2. Upload in background
    try {
      const supabase = createClient()
      const fileName = `${Date.now()}.mp4`
      const path     = `videos/${jobId}/${fileName}`

      const { error: upErr } = await (supabase as any).storage
        .from('job-photos')
        .upload(path, file, { contentType: file.type || 'video/mp4', upsert: false })

      if (upErr) {
        setVideos((v) => v.map((x) => x.id === id ? { ...x, uploading: false, error: upErr.message } : x))
      } else {
        const { data } = (supabase as any).storage.from('job-photos').getPublicUrl(path)
        setVideos((v) => v.map((x) => x.id === id ? { ...x, uploading: false, remoteUrl: data.publicUrl as string } : x))
      }
    } catch {
      setVideos((v) => v.map((x) => x.id === id ? { ...x, uploading: false, error: 'Upload failed' } : x))
    }
  }

  function removePhoto(id: string) {
    setPhotos((p) => {
      const entry = p.find((x) => x.id === id)
      if (entry) {
        URL.revokeObjectURL(entry.localUrl)
        // Already uploaded — clean up the stored copy too, not just the thumbnail.
        if (entry.storagePath) deleteJobPhotoAction(entry.storagePath).catch(() => {})
      }
      return p.filter((x) => x.id !== id)
    })
  }

  function removeVideo(id: string) {
    setVideos((v) => {
      const entry = v.find((x) => x.id === id)
      if (entry) URL.revokeObjectURL(entry.localUrl)
      return v.filter((x) => x.id !== id)
    })
  }

  function toggleCheck(id: string) {
    setChecked((c) => ({ ...c, [id]: !c[id] }))
  }

  async function handleSubmit() {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const result = await submitJobAction({
      jobId,
      photoUrls:          uploadedPhotos.map((p) => p.remoteUrl!),
      videoUrls:          videos.filter((v) => v.remoteUrl).map((v) => v.remoteUrl!),
      checklistCompleted: checked,
      notes,
    })
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
      return
    }
    router.push('/cleaner/dashboard')
  }

  const remaining = MIN_PHOTOS - uploadedPhotos.length

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {/* ── Photos ── */}
      <div className="bg-white rounded-2xl px-5 py-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-black">Photos</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Optional · Max {MAX_PHOTOS} · Auto-timestamped if uploaded
            </p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            uploadedPhotos.length >= MIN_PHOTOS ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'
          }`}>
            {uploadedPhotos.length}/{MAX_PHOTOS}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {photos.map((p) => (
            <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
              {/* Instant local preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.localUrl}
                alt="Photo preview"
                className="w-full h-full object-cover"
              />
              {/* Uploading spinner overlay */}
              {p.uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
              {/* Error overlay */}
              {p.error && (
                <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center">
                  <span className="text-white text-[10px] font-semibold px-1 text-center">Failed</span>
                </div>
              )}
              {/* Uploaded tick */}
              {p.remoteUrl && (
                <div className="absolute bottom-1.5 left-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </div>
              )}
              <button
                onClick={() => removePhoto(p.id)}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center active:scale-90 transition-transform"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-all"
            >
              <Camera className="w-6 h-6 text-gray-400" />
              <span className="text-xs text-gray-400 font-medium">Add</span>
            </button>
          )}
        </div>

        {/* No `capture` attribute — on iOS that forces a single-shot camera that
            closes after each photo. Without it, iOS's normal multi-select picker
            (which itself offers a Camera button) lets the cleaner take several
            photos back-to-back before returning here once. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handlePhotoSelect}
        />
      </div>

      {/* ── Videos (optional) ── */}
      <div className="bg-white rounded-2xl px-5 py-5">
        <div className="mb-4">
          <p className="text-sm font-semibold text-black">
            Videos <span className="text-gray-400 font-normal">(optional)</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Add a short video to show completed work, an issue, or anything important
          </p>
        </div>

        {videos.length > 0 && (
          <div className="space-y-3 mb-4">
            {videos.map((v) => (
              <div key={v.id} className="rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                {/* Instant local video preview — plays from blob URL immediately */}
                <div className="relative">
                  <video
                    src={v.localUrl}
                    controls
                    playsInline
                    preload="auto"
                    className="w-full max-h-52 bg-black"
                  >
                    <track kind="captions" />
                  </video>
                  {v.uploading && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/60 rounded-full px-3 py-1.5 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                        <span className="text-white text-xs font-medium">Uploading…</span>
                      </div>
                    </div>
                  )}
                  {v.error && (
                    <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center pointer-events-none">
                      <span className="text-white text-xs font-semibold">Upload failed — tap × to remove</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <Video className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-600 font-medium truncate flex-1">{v.name}</span>
                  {v.remoteUrl && <CheckCircle2 className="w-4 h-4 text-black flex-shrink-0" />}
                  <button
                    onClick={() => removeVideo(v.id)}
                    className="w-6 h-6 rounded-full bg-black/10 flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
                  >
                    <X className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          {/* Record new */}
          <button
            onClick={() => {
              if (videoInputRef.current) {
                videoInputRef.current.removeAttribute('capture')
                videoInputRef.current.setAttribute('capture', 'environment')
                videoInputRef.current.click()
              }
            }}
            disabled={videos.some((v) => v.uploading)}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 border border-dashed border-gray-200 rounded-xl px-3 py-3 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Video className="w-4 h-4 text-gray-400" />
            Record
          </button>
          {/* Pick from library */}
          <button
            onClick={() => {
              if (videoInputRef.current) {
                videoInputRef.current.removeAttribute('capture')
                videoInputRef.current.click()
              }
            }}
            disabled={videos.some((v) => v.uploading)}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-gray-600 border border-dashed border-gray-200 rounded-xl px-3 py-3 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            <Video className="w-4 h-4 text-gray-400" />
            Choose
          </button>
        </div>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoSelect}
        />
      </div>

      {/* ── Checklist ── */}
      {checklist.length > 0 && (
        <div className="bg-white rounded-2xl px-5 py-5">
          <p className="text-sm font-semibold text-black mb-4">Checklist</p>
          <ul className="space-y-1">
            {checklist.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => toggleCheck(item.id)}
                  className="flex items-center gap-3 w-full py-3 text-left border-b border-gray-50 last:border-0 active:scale-[0.98] transition-all"
                >
                  {checked[item.id]
                    ? <CheckCircle2 className="w-5 h-5 text-black flex-shrink-0" />
                    : <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                  }
                  <span className={`text-sm ${checked[item.id] ? 'text-black font-medium' : 'text-gray-700'}`}>
                    {item.label}
                  </span>
                  {item.required && !checked[item.id] && (
                    <span className="ml-auto text-xs text-gray-400">Required</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Notes ── */}
      <div className="bg-white rounded-2xl px-5 py-5">
        <p className="text-sm font-semibold text-black mb-3">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes about this job…"
          rows={3}
          className="w-full text-sm text-black placeholder-gray-400 resize-none focus:outline-none"
        />
      </div>

      {/* ── Submit ── */}
      <div className="space-y-2 pt-2 pb-4">
        {anyUploading && (
          <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Uploading media, please wait…
          </p>
        )}
        {!canSubmit && !anyUploading && (
          <p className="text-xs text-center text-gray-400">
            Complete all required checklist items.
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="w-full bg-black text-white font-semibold text-sm rounded-2xl py-4 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {submitting ? 'Submitting…' : 'Submit Job'}
        </button>
      </div>
    </div>
  )
}
