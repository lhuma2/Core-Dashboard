'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { addCompanyDocumentAction } from '@/actions/company-docs'
import { Plus, Loader2 } from 'lucide-react'

export function UploadCompanyDocButton({ kind = 'document' }: { kind?: 'document' | 'sop' }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const router = useRouter()

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return
    if (file.size === 0) {
      // Common cause: the file lives in a cloud-synced folder (OneDrive, Dropbox, ...)
      // as an online-only placeholder that hasn't actually downloaded yet, so the
      // browser reads zero bytes. Uploading it "succeeds" but produces a dead file
      // that fails to render later with no clue why — catch it here instead.
      setErr('That file is empty (0 bytes) — if it’s in OneDrive/Dropbox, make sure it’s fully downloaded first, then try again.')
      return
    }
    setErr(null)
    setBusy(true)
    try {
      const supabase = createClient() as any
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'pdf'
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `company-documents/${Date.now()}-${safe}`
      const { error: upErr } = await supabase.storage
        .from('job-photos')
        .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (upErr) { setErr(upErr.message); setBusy(false); return }
      const { data } = supabase.storage.from('job-photos').getPublicUrl(path)
      const displayName = file.name.replace(/\.[^.]+$/, '')
      const res = await addCompanyDocumentAction(displayName, data.publicUrl, kind)
      if (res?.error) { setErr(res.error); setBusy(false); return }
      router.refresh()
    } catch {
      setErr('Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-red-500">{err}</span>}
      <input ref={inputRef} type="file" onChange={onPick} className="hidden"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.xlsx,.csv" />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Upload company document"
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#00250e] text-white hover:bg-[#001a09] transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
      </button>
    </div>
  )
}
