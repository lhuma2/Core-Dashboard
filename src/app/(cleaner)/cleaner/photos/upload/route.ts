import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Cleaner job photo upload (before/after, every job kind).
//
// A route rather than a server action on purpose: a server action is tied to
// the build it was loaded with, so a cleaner who had the page open across a
// deploy got "Failed" on every photo until they reloaded. This URL never
// changes. It lives under /cleaner so the cleaner's own session is used.

const KINDS = ['job_assignment', 'bond_job', 'residential_job'] as const
const PHASES = ['before', 'after'] as const
const MAX_BYTES = 4 * 1024 * 1024   // Vercel rejects request bodies over 4.5 MB

export async function POST(request: Request) {
  const supabase = createClient() as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'signed_out' }, { status: 401 })
  const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'signed_out' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const file = form?.get('photo')
  const jobId = String(form?.get('jobId') ?? '')
  const phase = String(form?.get('phase') ?? 'after') as (typeof PHASES)[number]
  const jobKind = String(form?.get('jobKind') ?? 'job_assignment') as (typeof KINDS)[number]
  // The phone's own id for this photo. Sending the same photo twice (the reply was
  // lost to bad signal or the app being closed, so it was retried) lands on the
  // same file instead of storing a duplicate.
  const photoId = String(form?.get('photoId') ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 64)
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'No photo was received.' }, { status: 400 })
  if (!/^[0-9a-f-]{36}$/i.test(jobId) || !PHASES.includes(phase) || !KINDS.includes(jobKind)) {
    return NextResponse.json({ error: 'This job link is not valid.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'too_large' }, { status: 413 })

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  // Random suffix: several photos picked at once upload in parallel and can land in the same millisecond.
  const name = photoId.length >= 8 ? photoId : `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const path = `${jobKind}/${jobId}/${phase}/${name}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('job-photos')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false })
  const alreadyStored = !!upErr && (String(upErr.statusCode) === '409' || /already exists|duplicate/i.test(upErr.message))
  if (upErr && !alreadyStored) {
    console.error('Job photo upload failed', jobKind, jobId, upErr.message)
    return NextResponse.json({ error: upErr.message }, { status: 502 })
  }

  // Tag it for the admin view (once). The file is already stored, so a failure here is logged, not fatal.
  const { data: tagged } = alreadyStored
    ? await supabase.from('job_photos').select('id').eq('storage_path', path).limit(1).maybeSingle()
    : { data: null }
  if (!tagged) {
    const { error: tagErr } = await supabase.from('job_photos').insert({
      job_id: jobId, job_kind: jobKind, phase, storage_path: path, uploaded_by: profile.id,
    })
    if (tagErr) console.error('Job photo tag failed', path, tagErr.message)
  }

  const { data } = supabase.storage.from('job-photos').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl as string, storagePath: path })
}
