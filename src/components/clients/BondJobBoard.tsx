'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  FolderPlus, Folder, ChevronDown, ChevronRight, Trash2, GripVertical, X,
} from 'lucide-react'

export interface BondJobRow {
  id: string
  client_name: string
  address: string
  contact_phone: string | null
  clean_date: string
  clean_time: string | null
  cleaner_name: string | null
  status: string
  folder_id: string | null
}

export interface BondFolder {
  id: string
  name: string
}

interface BondJobBoardProps {
  jobs: BondJobRow[]
  folders: BondFolder[]
  createFolderAction: (formData: FormData) => Promise<{ error?: string; success?: boolean } | void>
  deleteFolderAction: (id: string) => Promise<void>
  deleteJobAction: (id: string) => Promise<void>
  moveJobAction: (jobId: string, folderId: string | null) => Promise<{ error?: string } | void>
}

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-50 text-blue-600',
  completed:   'bg-emerald-50 text-emerald-600',
}
const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}
function formatTime(timeStr: string | null) {
  if (!timeStr) return null
  const [h, m] = timeStr.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
}

export function BondJobBoard({
  jobs: initialJobs,
  folders: initialFolders,
  createFolderAction,
  deleteFolderAction,
  deleteJobAction,
  moveJobAction,
}: BondJobBoardProps) {
  const [jobs, setJobs] = useState(initialJobs)
  const [folders, setFolders] = useState(initialFolders)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [addingFolder, setAddingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [dragOverId, setDragOverId] = useState<string | null>(null) // 'unfiled' | folder.id
  const [, startTransition] = useTransition()
  const draggedJobId = useRef<string | null>(null)

  function toggleCollapsed(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }))
  }

  async function handleAddFolder(e: React.FormEvent) {
    e.preventDefault()
    const name = folderName.trim()
    if (!name) return
    const fd = new FormData()
    fd.append('name', name)
    const tempId = `temp-${Date.now()}`
    setFolders((f) => [...f, { id: tempId, name }])
    setFolderName('')
    setAddingFolder(false)
    startTransition(async () => {
      const result = await createFolderAction(fd)
      if (result?.error) {
        setFolders((f) => f.filter((x) => x.id !== tempId))
      }
    })
  }

  function handleDeleteFolder(id: string) {
    if (!confirm('Delete this folder? Cleans inside will become unfiled, not deleted.')) return
    setFolders((f) => f.filter((x) => x.id !== id))
    setJobs((j) => j.map((x) => x.folder_id === id ? { ...x, folder_id: null } : x))
    startTransition(() => deleteFolderAction(id))
  }

  function handleDeleteJob(id: string) {
    if (!confirm('Remove this bond clean? This cannot be undone.')) return
    setJobs((j) => j.filter((x) => x.id !== id))
    startTransition(() => deleteJobAction(id))
  }

  function handleDrop(folderId: string | null) {
    setDragOverId(null)
    const jobId = draggedJobId.current
    if (!jobId) return
    setJobs((j) => j.map((x) => x.id === jobId ? { ...x, folder_id: folderId } : x))
    startTransition(() => { moveJobAction(jobId, folderId) })
  }

  function renderJobRow(job: BondJobRow) {
    return (
      <div
        key={job.id}
        draggable
        onDragStart={() => { draggedJobId.current = job.id }}
        className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 border border-gray-100 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <Link href={`/clients/bond/${job.id}`} className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 hover:underline truncate">{job.client_name}</p>
          <p className="text-xs text-gray-500 truncate">
            {formatDate(job.clean_date)}{formatTime(job.clean_time) ? ` · ${formatTime(job.clean_time)}` : ''}
            {job.cleaner_name ? ` · ${job.cleaner_name}` : ' · Unassigned'}
          </p>
        </Link>
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${STATUS_STYLES[job.status] ?? STATUS_STYLES.not_started}`}>
          {STATUS_LABELS[job.status] ?? job.status}
        </span>
        <button
          onClick={() => handleDeleteJob(job.id)}
          className="flex-shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )
  }

  function renderGroup(key: string, label: string, folderId: string | null, groupJobs: BondJobRow[], onDelete?: () => void) {
    const isCollapsed = collapsed[key]
    const isDragOver = dragOverId === key
    return (
      <div
        key={key}
        onDragOver={(e) => { e.preventDefault(); setDragOverId(key) }}
        onDragLeave={() => setDragOverId((d) => d === key ? null : d)}
        onDrop={(e) => { e.preventDefault(); handleDrop(folderId) }}
        className={`rounded-2xl border transition-colors ${isDragOver ? 'border-brand-navy bg-brand-navy/5' : 'border-gray-200/70 bg-gray-50/50'}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <button onClick={() => toggleCollapsed(key)} className="flex items-center gap-2 min-w-0">
            {isCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            <Folder className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-800 truncate">{label}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">({groupJobs.length})</span>
          </button>
          {onDelete && (
            <button onClick={onDelete} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {!isCollapsed && (
          <div className="px-3 pb-3 space-y-2">
            {groupJobs.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Drag a clean here</p>
            ) : (
              groupJobs.map(renderJobRow)
            )}
          </div>
        )}
      </div>
    )
  }

  const unfiled = jobs.filter((j) => !j.folder_id)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        {addingFolder ? (
          <form onSubmit={handleAddFolder} className="flex items-center gap-2">
            <Input
              autoFocus
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-48"
            />
            <Button type="submit" size="sm">Add</Button>
            <button type="button" onClick={() => { setAddingFolder(false); setFolderName('') }} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setAddingFolder(true)}>
            <FolderPlus className="w-4 h-4" />
            Add Folder
          </Button>
        )}
      </div>

      {renderGroup('unfiled', 'Unfiled', null, unfiled)}

      {folders.map((folder) =>
        renderGroup(folder.id, folder.name, folder.id, jobs.filter((j) => j.folder_id === folder.id), () => handleDeleteFolder(folder.id))
      )}

      {jobs.length === 0 && (
        <p className="text-center text-sm text-gray-400 py-6">No bond cleans scheduled yet.</p>
      )}
    </div>
  )
}
