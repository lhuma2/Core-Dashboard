'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Folder, FolderOpen, FilePen, FileText, Plus, Trash2, X, Loader2, Check, FolderInput, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createFolderAction, deleteFolderAction, moveDocToFolderAction, addFolderFileAction, deleteFolderFileAction } from '@/actions/folders'

type Doc = { id: string; client_name: string | null; kind: string; folder_id: string | null; signed_at: string | null }
type FolderFile = { id: string; folder_id: string; name: string; file_url: string }
type FolderT = { id: string; name: string }

export function SignedDocsFolders({ folders, signed, files }: { folders: FolderT[]; signed: Doc[]; files: FolderFile[] }) {
  const router = useRouter()
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState<string | 'unfiled' | null>(null)

  const unfiled = signed.filter((d) => !d.folder_id)
  const docsIn = (fid: string) => signed.filter((d) => d.folder_id === fid)
  const filesIn = (fid: string) => files.filter((f) => f.folder_id === fid)
  const countIn = (fid: string) => docsIn(fid).length + filesIn(fid).length

  async function addFolder() {
    if (!newName.trim()) { setAdding(false); return }
    setBusy(true); await createFolderAction(newName.trim())
    setNewName(''); setAdding(false); setBusy(false); router.refresh()
  }
  async function removeFolder(id: string) {
    if (!confirm('Delete this folder? Its filed documents are un-filed (uploaded files inside are removed).')) return
    await deleteFolderAction(id); if (openId === id) setOpenId(null); router.refresh()
  }
  async function moveTo(docId: string, folderId: string | null) { await moveDocToFolderAction(docId, folderId); router.refresh() }
  async function removeFile(id: string) { await deleteFolderFileAction(id); router.refresh() }

  // Upload external files dropped from the user's computer into a folder.
  async function uploadFilesToFolder(folderId: string, fileList: FileList) {
    setUploading(true)
    const supabase = createClient() as any
    for (const file of Array.from(fileList)) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `folder-files/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safe}`
      const { error: upErr } = await supabase.storage.from('job-photos').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
      if (upErr) { alert(upErr.message); continue }
      const { data } = supabase.storage.from('job-photos').getPublicUrl(path)
      await addFolderFileAction(folderId, file.name.replace(/\.[^.]+$/, ''), data.publicUrl)
    }
    setUploading(false); router.refresh()
  }

  const onDropTo = (folderId: string | null) => (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(null)
    const dropped = e.dataTransfer.files
    if (dropped && dropped.length > 0) {
      if (!folderId) { alert('Drop files onto a folder to save them there.'); return }
      uploadFilesToFolder(folderId, dropped)
      return
    }
    const docId = e.dataTransfer.getData('docId')
    if (docId) moveTo(docId, folderId)
  }
  const dragProps = (docId: string) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => { e.dataTransfer.setData('docId', docId); e.dataTransfer.effectAllowed = 'move' },
  })

  const DocRow = ({ d, showUnfile }: { d: Doc; showUnfile?: boolean }) => (
    <div {...dragProps(d.id)} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing">
      <div className="w-8 h-8 rounded-lg bg-[#00250e]/5 border border-[#00250e]/10 flex items-center justify-center flex-shrink-0"><FilePen className="w-4 h-4 text-[#00250e]" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 truncate">{d.client_name || 'Untitled'}</p>
        <p className="text-xs text-gray-400">Signed{d.signed_at ? ` · ${new Date(d.signed_at).toLocaleDateString('en-AU')}` : ''}</p>
      </div>
      <Link href={`/documents/${d.id}`} className="text-[11px] font-semibold text-[#00250e] border border-[#00250e]/20 rounded-full px-3 py-1 hover:bg-[#00250e] hover:text-white transition-colors flex-shrink-0">View</Link>
      {showUnfile && <button onClick={() => moveTo(d.id, null)} title="Remove from folder" className="text-gray-400 hover:text-red-500 flex-shrink-0"><X className="w-4 h-4" /></button>}
    </div>
  )

  const FileRow = ({ f }: { f: FolderFile }) => (
    <div className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50">
      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-blue-600" /></div>
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold text-gray-900 truncate">{f.name}</p><p className="text-xs text-gray-400">Uploaded file</p></div>
      <a href={f.file_url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-[#00250e] border border-[#00250e]/20 rounded-full px-3 py-1 hover:bg-[#00250e] hover:text-white transition-colors flex-shrink-0">View</a>
      <button onClick={() => removeFile(f.id)} title="Delete file" className="text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 className="w-4 h-4" /></button>
    </div>
  )

  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500">Folders {uploading && <span className="text-[#00250e] inline-flex items-center gap-1 ml-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</span>}</p>
        {adding ? (
          <div className="flex items-center gap-2">
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="Folder name" className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#00250e]/25" />
            <button onClick={addFolder} disabled={busy} className="inline-flex items-center gap-1 bg-[#003314] hover:bg-[#00250e] text-white text-xs font-semibold rounded-lg px-3 py-1.5">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Add
            </button>
            <button onClick={() => { setAdding(false); setNewName('') }} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00250e] border border-[#00250e]/20 rounded-lg px-3 py-1.5 hover:bg-[#00250e]/5">
            <Plus className="w-3.5 h-3.5" /> New folder
          </button>
        )}
      </div>

      {folders.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {folders.map((f) => {
            const open = openId === f.id
            return (
              <button key={f.id}
                onClick={() => setOpenId(open ? null : f.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(f.id) }}
                onDragLeave={() => setDragOver((o) => (o === f.id ? null : o))}
                onDrop={onDropTo(f.id)}
                className={`group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                  dragOver === f.id ? 'border-[#00250e] bg-[#00250e]/10' : open ? 'border-[#00250e] bg-[#00250e]/5' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                {open ? <FolderOpen className="w-4 h-4 text-[#00250e]" /> : <Folder className="w-4 h-4 text-[#00250e]" />}
                <span className="font-semibold text-gray-800">{f.name}</span>
                <span className="text-xs text-gray-400">{countIn(f.id)}</span>
                <span onClick={(e) => { e.stopPropagation(); removeFolder(f.id) }} className="ml-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></span>
              </button>
            )
          })}
        </div>
      )}

      {openId && (
        <div className="mb-4 rounded-2xl border border-gray-200/70 bg-gray-50/50 p-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(openId) }}
            onDragLeave={() => setDragOver((o) => (o === openId ? null : o))}
            onDrop={onDropTo(openId)}
            className={`rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors ${dragOver === openId ? 'border-[#00250e] bg-[#00250e]/5 text-[#00250e]' : 'border-gray-300 text-gray-400'}`}
          >
            <Upload className="w-5 h-5 mx-auto mb-1.5" />
            Drop files from your computer here, or drag a signed document, to add them to <span className="font-semibold">{folders.find((f) => f.id === openId)?.name}</span>
          </div>
          <div className="mt-3 rounded-xl border border-gray-200/70 overflow-hidden divide-y divide-gray-100 bg-white">
            {docsIn(openId).length === 0 && filesIn(openId).length === 0
              ? <p className="px-4 py-5 text-sm text-gray-400 text-center">Nothing in this folder yet.</p>
              : <>{docsIn(openId).map((d) => <DocRow key={d.id} d={d} showUnfile />)}{filesIn(openId).map((f) => <FileRow key={f.id} f={f} />)}</>}
          </div>
        </div>
      )}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver('unfiled') }}
        onDragLeave={() => setDragOver((o) => (o === 'unfiled' ? null : o))}
        onDrop={onDropTo(null)}
        className={`rounded-2xl border overflow-hidden ${dragOver === 'unfiled' ? 'border-[#00250e]' : 'border-gray-200/70'}`}
      >
        <p className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-50/60">Unfiled signed documents · {unfiled.length}</p>
        <div className="divide-y divide-gray-100">
          {unfiled.length === 0
            ? <p className="px-4 py-5 text-sm text-gray-400 text-center">No unfiled signed documents.</p>
            : unfiled.map((d) => <DocRow key={d.id} d={d} />)}
        </div>
      </div>
    </div>
  )
}
