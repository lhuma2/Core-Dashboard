'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { uploadComplianceDocAction } from '@/actions/team'

interface Client { id: string; business_name: string }

export function ComplianceUploadForm({ clients }: { clients: Client[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'sds' | 'insurance' | 'contract' | 'other'>('sds')
  const [clientId, setClientId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const inp = 'w-full bg-white border border-gray-200 text-gray-900 text-sm rounded-lg px-3 py-2.5 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors'
  const lbl = 'block text-xs font-medium text-gray-600 mb-1.5'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !file) return setError('Name and file are required')
    setUploading(true); setError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', name.trim())
    fd.append('description', description.trim())
    fd.append('type', type)
    fd.append('clientId', clientId)
    const result = await uploadComplianceDocAction(fd)
    setUploading(false)
    if (result.error) return setError(result.error)
    setSuccess(true); setName(''); setDescription(''); setFile(null); setClientId('')
    if (fileRef.current) fileRef.current.value = ''
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-2.5">✓ Document uploaded</div>}
      {error && <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2.5">{error}</div>}

      <div>
        <label className={lbl}>Document Name</label>
        <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., SDS - Floor Cleaner" />
      </div>
      <div>
        <label className={lbl}>Description <span className="text-gray-400">(optional)</span></label>
        <input className={inp} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description of this document" />
      </div>
      <div>
        <label className={lbl}>Type</label>
        <select
          className={inp}
          value={type}
          onChange={(e) => {
            const t = e.target.value as any
            setType(t)
            if (t === 'contract') {
              setName('Service Agreement')
              setDescription('Your signed service agreement outlining scope, schedule, and terms.')
            } else if (type === 'contract') {
              setName('')
              setDescription('')
            }
          }}
        >
          <option value="sds">Safety Data Sheet (SDS)</option>
          <option value="insurance">Insurance Certificate</option>
          <option value="contract">Client Contract</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className={lbl}>Assign to Client <span className="text-gray-400">(leave blank for global)</span></label>
        <select className={inp} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Global (all clients)</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.business_name}</option>)}
        </select>
      </div>
      <div>
        <label className={lbl}>File (PDF)</label>
        <input ref={fileRef} type="file" accept=".pdf,image/*" className={inp + ' py-1.5'}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <button type="submit" disabled={uploading} className="w-full bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50">
        {uploading ? 'Uploading…' : 'Upload Document'}
      </button>
    </form>
  )
}
