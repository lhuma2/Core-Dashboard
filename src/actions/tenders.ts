'use server'

import { revalidatePath } from 'next/cache'
import { tickOffTender, refreshTenders } from '@/lib/tenders/refresh'

export async function tickOffTenderAction(id: string) {
  const result = await tickOffTender(id)
  if (result.error) return { error: result.error }
  revalidatePath('/tenders')
  return { success: true }
}

export async function refreshTendersAction() {
  const result = await refreshTenders()
  revalidatePath('/tenders')
  return { success: true, ...result }
}
