'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ImageIcon, Trash2, ZoomIn } from 'lucide-react'
import { uploadScopeOfWorksAction, removeScopeOfWorksAction } from '@/actions/team'
import { PhotoLightbox } from '@/components/ui/PhotoLightbox'

interface Props {
  jobId: string
  imageUrl: string | null
}

export function ScopeOfWorksUploader({ jobId, imageUrl }: Props) {
  const router       = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (fileInputRef.current) fileInputRef.current.value = ''

    setUploading(true)
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadScopeOfWorksAction(jobId, fd)
    setUploading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  async function handleRemove() {
    setUploading(true)
    await removeScopeOfWorksAction(jobId)
    setUploading(false)
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl px-5 py-4 mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Scope of Works</p>

      {imageUrl ? (
        <div className="space-y-3">
          <button
            onClick={() => setLightboxOpen(true)}
            className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 active:opacity-80 transition-opacity"
          >
            <Image src={imageUrl} alt="Scope of works" fill className="object-cover" sizes="100vw" />
            <span className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-medium text-white bg-black/60 px-2 py-1 rounded-lg">
              <ZoomIn className="w-3 h-3" /> View
            </span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex-1 text-xs font-semibold border border-gray-200 rounded-lg py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="flex items-center justify-center gap-1 text-xs font-semibold text-red-600 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-8 text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors disabled:opacity-50"
        >
          <ImageIcon className="w-6 h-6" />
          <span className="text-xs font-medium">{uploading ? 'Uploading…' : 'Upload scope of works image'}</span>
        </button>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleSelect}
        className="hidden"
      />

      {imageUrl && (
        <PhotoLightbox
          photos={[imageUrl]}
          initialIndex={lightboxOpen ? 0 : null}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}
