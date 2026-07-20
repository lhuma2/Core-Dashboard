'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { bondJobSchema } from '@/lib/validations/bondJob.schema'

export async function createBondJobAction(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const fget = (k: string) => (formData.get(k) as string | null) ?? undefined

  const raw = {
    client_name:   fget('client_name'),
    address:       fget('address'),
    contact_phone: fget('contact_phone'),
    clean_date:    fget('clean_date'),
    clean_time:    fget('clean_time'),
    bedrooms:              fget('bedrooms'),
    bathrooms:             fget('bathrooms'),
    carpet_steam_rooms:    fget('carpet_steam_rooms'),
    carpet_steam_hallways: fget('carpet_steam_hallways'),
    comments:      fget('comments'),
    cleaner_id:    fget('cleaner_id'),
  }

  const parsed = bondJobSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const db = supabase as any
  let createdBy: string | null = null
  if (user) {
    const { data: profile } = await db.from('profiles').select('id').eq('user_id', user.id).single()
    createdBy = profile?.id ?? null
  }

  const { error } = await db.from('bond_jobs').insert({
    client_name:   parsed.data.client_name,
    address:       parsed.data.address,
    contact_phone: parsed.data.contact_phone || null,
    clean_date:    parsed.data.clean_date,
    clean_time:    parsed.data.clean_time || null,
    bedrooms:              parsed.data.bedrooms              ?? null,
    bathrooms:             parsed.data.bathrooms             ?? null,
    carpet_steam_rooms:    parsed.data.carpet_steam_rooms    ?? null,
    carpet_steam_hallways: parsed.data.carpet_steam_hallways ?? null,
    comments:      parsed.data.comments || null,
    cleaner_id:    parsed.data.cleaner_id || null,
    created_by:    createdBy,
  })

  if (error) {
    return { error: { _form: [error.message] } }
  }

  revalidatePath('/clients')
  redirect('/clients?tab=bond')
}

export async function deleteBondJobAction(id: string) {
  const supabase = createClient()
  const db = supabase as any
  await db.from('bond_jobs').delete().eq('id', id)
  revalidatePath('/clients')
}

// ─── Real-time tracking for bond cleans (mirrors src/actions/jobs.ts) ────────

async function getCurrentProfile(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await (supabase as any).from('profiles').select('*').eq('user_id', user.id).single()
  return data ?? null
}

export async function startBondJobAction(jobId: string) {
  const supabase = createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) return { error: 'Not authenticated' }

  const { data: current } = await (supabase as any)
    .from('bond_jobs')
    .select('status, cleaner_id')
    .eq('id', jobId)
    .single()

  if (!current) return { error: 'Job not found' }
  if (current.cleaner_id !== profile.id) return { error: 'This job is not assigned to you.' }
  if (current.status !== 'not_started') return { success: true, alreadyStarted: true }

  // Same "one active clean at a time" rule as regular jobs.
  const { data: activeElsewhere } = await (supabase as any)
    .from('job_assignments')
    .select('id')
    .eq('cleaner_id', profile.id)
    .in('status', ['in_progress', 'flagged'])
    .limit(1)
    .maybeSingle()
  if (activeElsewhere?.id) {
    return { error: 'You already have an active job elsewhere. Finish that one first.' }
  }

  const now = new Date().toISOString()
  const { data: updated, error } = await (supabase as any)
    .from('bond_jobs')
    .update({ status: 'in_progress', started_at: now })
    .eq('id', jobId)
    .eq('cleaner_id', profile.id)
    .eq('status', 'not_started')
    .select('id')
    .single()

  if (error) return { error: error.message }
  if (!updated) return { success: true, alreadyStarted: true }

  revalidatePath('/cleaner/timetable')
  revalidatePath(`/cleaner/bond/${jobId}`)
  revalidatePath('/clients')
  return { success: true }
}

export async function cancelStartBondJobAction(jobId: string) {
  const supabase = createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) return { error: 'Not authenticated' }

  const { data: photos } = await (supabase as any)
    .from('job_photos')
    .select('id')
    .eq('job_id', jobId)
    .eq('job_kind', 'bond_job')
    .limit(1)

  if (photos && photos.length > 0) {
    return { error: 'Photos have already been attached — this clean can no longer be cancelled.' }
  }

  const { error } = await (supabase as any)
    .from('bond_jobs')
    .update({ status: 'not_started', started_at: null })
    .eq('id', jobId)
    .eq('cleaner_id', profile.id)
    .eq('status', 'in_progress')

  if (error) return { error: error.message }

  revalidatePath('/cleaner/timetable')
  revalidatePath(`/cleaner/bond/${jobId}`)
  revalidatePath('/clients')
  return { success: true }
}

export async function finishBondJobAction(jobId: string) {
  const supabase = createClient()
  const profile = await getCurrentProfile(supabase)
  if (!profile) return { error: 'Not authenticated' }

  const now = new Date().toISOString()
  const { error } = await (supabase as any)
    .from('bond_jobs')
    .update({ status: 'completed', finished_at: now })
    .eq('id', jobId)
    .eq('cleaner_id', profile.id)

  if (error) return { error: error.message }

  revalidatePath('/cleaner/timetable')
  revalidatePath(`/cleaner/bond/${jobId}`)
  revalidatePath('/clients')
  return { success: true }
}
