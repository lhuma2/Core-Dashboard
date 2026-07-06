'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function createFolderAction(name: string) {
  const n = (name ?? '').trim()
  if (!n) return { error: 'Enter a folder name.' }
  const db = createAdminClient() as any
  const { error } = await db.from('document_folders').insert({ name: n })
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}

export async function renameFolderAction(id: string, name: string) {
  const n = (name ?? '').trim()
  if (!n) return { error: 'Enter a folder name.' }
  const db = createAdminClient() as any
  const { error } = await db.from('document_folders').update({ name: n }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}

export async function deleteFolderAction(id: string) {
  const db = createAdminClient() as any
  // Documents in this folder are un-filed automatically (FK on delete set null).
  const { error } = await db.from('document_folders').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}

export async function moveDocToFolderAction(docId: string, folderId: string | null) {
  const db = createAdminClient() as any
  const { error } = await db.from('proposal_documents').update({ folder_id: folderId }).eq('id', docId)
  if (error) return { error: error.message }
  revalidatePath('/documents')
  return { success: true }
}
