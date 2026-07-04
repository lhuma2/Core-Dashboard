'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { scoreInspection, type InspArea } from '@/lib/inspections/template'

const OWNER_EMAIL = 'hello@deltacleaning.com.au'

interface SavePayload {
  clientId: string
  siteId?: string | null
  siteLabel: string
  areas: InspArea[]
  notes?: string
}

/** Create a completed inspection. Score + rectifications are computed server-side. */
export async function saveInspectionAction(payload: SavePayload): Promise<{ id?: string; error?: string }> {
  if (!payload.clientId) return { error: 'Please choose a client.' }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let inspector: string | null = user?.email ?? null
  if (user) {
    const { data: prof } = await (supabase as any).from('profiles').select('full_name').eq('user_id', user.id).maybeSingle()
    if (prof?.full_name) inspector = prof.full_name
  }

  const { overall, rectifications } = scoreInspection(payload.areas)

  const db = createAdminClient() as any
  const { data, error } = await db.from('inspections').insert({
    client_id: payload.clientId,
    site_id: payload.siteId || null,
    site_label: payload.siteLabel,
    inspector,
    status: 'completed',
    score: overall,
    areas: payload.areas,
    rectifications,
    notes: payload.notes?.trim() || null,
  }).select('id').single()

  if (error) return { error: error.message }

  revalidatePath('/inspections')
  if (payload.clientId) revalidatePath(`/clients/${payload.clientId}`)
  return { id: data.id }
}

/** Toggle whether the client can see this inspection in their portal. */
export async function shareInspectionAction(id: string, shared: boolean): Promise<{ error?: string }> {
  const db = createAdminClient() as any
  const { data: insp } = await db.from('inspections').select('client_id').eq('id', id).maybeSingle()
  const { error } = await db.from('inspections').update({ shared_with_client: shared, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/inspections'); revalidatePath(`/inspections/${id}`)
  if (insp?.client_id) revalidatePath(`/clients/${insp.client_id}`)
  return {}
}

/** Email the rectification list to the subcontractor to action. */
export async function notifySubcontractorAction(id: string): Promise<{ ok?: boolean; error?: string }> {
  const db = createAdminClient() as any
  const { data: insp } = await db
    .from('inspections')
    .select('site_label, score, inspected_at, rectifications')
    .eq('id', id).maybeSingle()
  if (!insp) return { error: 'Inspection not found.' }

  const { data: sub } = await db
    .from('subcontractors')
    .select('company_name, contact_name, contact_email')
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (!sub?.contact_email) return { error: 'No subcontractor email on file. Add one via the Safety page.' }

  const items: { area: string; label: string; rating: string }[] = insp.rectifications ?? []
  if (items.length === 0) return { error: 'Nothing to rectify on this inspection.' }

  const rows = items
    .map((r) => `<tr><td style="padding:6px 12px 6px 0;color:#0b1320;font-weight:600;">${r.area}</td><td style="padding:6px 0;color:#475569;">${r.label}${r.rating === 'fail' ? ' <span style="color:#dc2626;font-weight:600;">(fail)</span>' : ''}</td></tr>`)
    .join('')
  const when = new Date(insp.inspected_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;">
      <p style="font-size:15px;color:#0b1320;">Hi ${sub.contact_name || sub.company_name || 'there'},</p>
      <p style="font-size:14px;color:#334155;line-height:1.6;">Following a quality inspection at <strong>${insp.site_label}</strong> on ${when}${insp.score != null ? ` (scored ${insp.score}%)` : ''}, the following items need attention on the next visit:</p>
      <table style="border-collapse:collapse;margin:14px 0;font-size:14px;">${rows}</table>
      <p style="font-size:13px;color:#64748b;">Thanks,<br/>Delta Cleaning</p>
    </div>`

  await sendEmail(sub.contact_email, `Rectifications — ${insp.site_label}`, html).catch(() => {})
  return { ok: true }
}

/** Delete an inspection. */
export async function deleteInspectionAction(id: string): Promise<{ error?: string }> {
  const db = createAdminClient() as any
  const { data: insp } = await db.from('inspections').select('client_id').eq('id', id).maybeSingle()
  const { error } = await db.from('inspections').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/inspections')
  if (insp?.client_id) revalidatePath(`/clients/${insp.client_id}`)
  return {}
}
