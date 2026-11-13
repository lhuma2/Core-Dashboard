'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireStaff } from '@/lib/require-staff'
import { brisbaneToday } from '@/lib/hub/figures'
import { validateNewClient, DAYS, MAX_SITES, MAX_EXTRAS, type NcForm } from '@/lib/hub/new-client'

const str = (max: number) => z.string().max(max)
const extraSchema = z.object({ kind: str(100), custom: str(300), freq: str(20), price: str(30), cost: str(30) })
const svcSchema = z.object({
  days: z.object(Object.fromEntries(DAYS.map(d => [d[0], z.boolean().optional()])) as Record<string, z.ZodOptional<z.ZodBoolean>>).strict(),
  every: str(20), start: str(10), finish: str(10), first: str(10), cost: str(30), price: str(30),
  cleaners: z.array(z.string().uuid()).max(30),
  access: str(4000),
  extras: z.array(extraSchema).max(MAX_EXTRAS + 1),
})
const siteSchema = z.object({ name: str(300), street: str(300), suburb: str(200), postcode: str(10) })
const formSchema = z.object({
  biz: str(300), contact: str(300), phone: str(40), email: str(320), street: str(300), suburb: str(200), postcode: str(10), state: str(5),
  siteType: z.enum(['single', 'multi']),
  sites: z.array(siteSchema).max(MAX_SITES + 1),
  svcs: z.array(svcSchema).min(1).max(MAX_SITES + 1),
})

type Result = { ok: true; toast: string } | { ok: false; error: string }

/** Save a new commercial client with its sites, services, cleaners and add-ons, all or nothing. */
export async function createCommercialClient(input: NcForm, fromProp: string | null = null): Promise<Result> {
  const denied = await requireStaff()
  if (denied) return { ok: false, error: denied }
  const parsed = formSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Some of the details didn’t come through properly. Refresh the page and try again.' }

  const supabase = createClient() as any
  const today = brisbaneToday()
  const [teamQ, clientsQ] = await Promise.all([
    supabase.from('profiles').select('id, pack_signed_at').eq('role', 'cleaner'),
    supabase.from('clients').select('business_name, status, resume_on'),
  ])
  if (teamQ.error || clientsQ.error) return { ok: false, error: 'Couldn’t reach the hub. Check your connection and try again.' }

  const checked = validateNewClient(
    parsed.data as NcForm,
    today,
    teamQ.data.map((t: any) => ({ id: t.id, signed: !!t.pack_signed_at })),
    clientsQ.data.map((c: any) => ({ name: c.business_name ?? '', status: c.status, resume_on: c.resume_on })),
  )
  if (!checked.ok) return checked

  // One database call, so a failure part-way leaves nothing half-saved.
  if (fromProp !== null && !z.string().uuid().safeParse(fromProp).success) return { ok: false, error: 'That proposal was deleted. Refresh the page and try again.' }
  const { data: newId, error } = await supabase.rpc('hub_create_client', { p: checked.payload })
  if (error) {
    const m = String(error.message ?? '')
    if (m.includes('duplicate_client')) return { ok: false, error: `${checked.payload.business_name} is already one of your clients.` }
    if (m.includes('cleaner_not_allowed')) return { ok: false, error: 'One of the chosen cleaners can’t be assigned. Remove them and choose again.' }
    if (m.includes('bad_first_clean')) return { ok: false, error: 'A first clean date is in the past. Pick today or later.' }
    if (m.includes('not_allowed')) return { ok: false, error: 'Only admins and managers can add clients.' }
    return { ok: false, error: 'Couldn’t save the client. Nothing was saved, so you can try again.' }
  }
  let extra = ''
  if (fromProp && newId) {
    const { setUpFromProposal } = await import('@/lib/hub/setup-from-proposal')
    extra = await setUpFromProposal(supabase, fromProp, String(newId), today)
  }
  revalidatePath('/hub')
  revalidatePath('/hub/commercial')
  revalidatePath('/hub/commercial/timetable')
  return { ok: true, toast: checked.toast + extra }
}
