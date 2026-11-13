import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { makeClientLogin } from './client-login'
import { AGR_COLS, agrOf } from './proposals'

function siteUrl(): string {
  const h = headers()
  const host = h.get('x-forwarded-host') || h.get('host')
  if (host) return `${h.get('x-forwarded-proto') || 'https'}://${host}`
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://portal.corecleaning.services').replace(/\/$/, '')
}

/**
 * "Set up as client" on an accepted proposal, after the new client is saved: links the proposal and its signed
 * agreement to the client, copies the proposal's scope onto the client (the cleaners' checklist), and makes their
 * client portal login from the details they signed with. Returns the extra words for the toast.
 */
export async function setUpFromProposal(db: any, propId: string, clientId: string, today: string): Promise<string> {
  const { data: p } = await db.from('proposals').select('id, ref, body, setup_client_id').eq('id', propId).maybeSingle()
  if (!p) return ''
  if (p.setup_client_id) return ` ${p.ref} was already set up as a client, so nothing else was linked.`
  await db.from('proposals').update({ setup_client_id: clientId, client_id: clientId }).eq('id', propId)
  const { data: aRow } = await db.from('agreements').select(AGR_COLS).eq('proposal_id', propId).maybeSingle()
  const a = aRow ? agrOf(aRow) : null
  // the scope they agreed to becomes the client's checklist (one line per task, under its heading)
  const sow = (a?.snap?.prop?.sow || (Array.isArray(p.body?.sow) ? p.body.sow : [])) as { heading: string; items: { text: string }[] }[]
  const scope = sow.flatMap(h => (h.items || []).map(it => ({ task: String(it.text || '').trim().slice(0, 300), area: String(h.heading || '').trim().slice(0, 120), frequency: 'visit' }))).filter(t => t.task)
  if (scope.length) await db.from('clients').update({ scope }).eq('id', clientId)
  if (!a) return ''
  await db.from('agreements').update({ client_id: clientId }).eq('id', a.id)
  await db.from('client_history').insert({ client_id: clientId, date: today, text: `Set up from proposal ${p.ref}. ${a.status === 'signed' ? 'Signed' : 'Unsigned'} agreement ${a.ref} linked.` })
  if (a.status !== 'signed' || !a.details) return ` ${a.ref} is linked. Their client portal login is made when they sign.`
  const lg = await makeClientLogin(clientId, a.details.name, a.details.email, siteUrl(), +today.slice(0, 4))
  if (lg.ok && lg.made) {
    await (createAdminClient() as any).from('agreements').update({ portal: { email: lg.email, first: lg.first, sentAt: today } }).eq('id', a.id)
    return lg.tested
      ? ` Their signed agreement ${a.ref} is linked, and their client portal login is made (${lg.email}, starter password ${lg.pw}). This is the test site, so no welcome email went out.`
      : ` Their signed agreement ${a.ref} is linked, and ${lg.first} gets a welcome email with their client portal login at ${lg.email}.`
  }
  if (lg.ok) return ` Their signed agreement ${a.ref} is linked. They already have a client portal login (${lg.email}).`
  return ` Their signed agreement ${a.ref} is linked, but the client portal login couldn’t be made` + (lg.error === 'taken' ? ` because ${a.details.email} already has a login for something else.` : ' just now.')
}
