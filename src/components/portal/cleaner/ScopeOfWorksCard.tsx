'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ZoomIn } from 'lucide-react'
import { PhotoLightbox } from '@/components/ui/PhotoLightbox'

export function ScopeOfWorksCard({ imageUrl }: { imageUrl: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-2xl px-5 py-4 mb-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Scope of Works</p>
      <button
        onClick={() => setOpen(true)}
        className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-100 active:opacity-80 transition-opacity"
      >
        <Image src={imageUrl} alt="Scope of works" fill className="object-cover" sizes="100vw" />
        <span className="absolute bottom-2 right-2 flex items-center gap-1 text-xs font-medium text-white bg-black/60 px-2 py-1 rounded-lg">
          <ZoomIn className="w-3 h-3" /> View full size
        </span>
      </button>
      <PhotoLightbox photos={[imageUrl]} initialIndex={open ? 0 : null} onClose={() => setOpen(false)} />
    </div>
  )
}
