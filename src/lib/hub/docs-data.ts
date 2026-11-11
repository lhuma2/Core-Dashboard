import { createClient } from '@/lib/supabase/server'
import { docOf, DOC_COLS, snapFromHome, type HomeDoc, type HomeLike } from './home-agreements'

const HOME_COLS = 'id, name, email, street, suburb, state, postcode, kind, every, days, anchor, first_clean, start_time, price, beds, baths, carpet_rooms, hallways, windows_price, windows_freq, status'
const num = (v: any) => (v == null ? null : Number(v))
export const homeLike = (h: any): HomeLike => ({ ...h, price: Number(h.price) || 0, windows_price: num(h.windows_price) })

/** All residential agreements, newest ref first. Null if the hub can't be reached. */
export async function loadDocs(): Promise<HomeDoc[] | null> {
  const db = createClient() as any
  const { data, error } = await db.from('home_docs').select(DOC_COLS).eq('division', 'res')
  if (error) return null
  return (data as any[]).map(docOf).sort((a, b) => (a.ref < b.ref ? 1 : -1))
}

/** One agreement. A draft reads from the client's page, so it always shows what would be sent now. */
export async function loadDoc(id: string): Promise<{ d: HomeDoc; email: string; price: number } | null | 'missing'> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return 'missing'
  const db = createClient() as any
  const { data, error } = await db.from('home_docs').select(DOC_COLS).eq('id', id).maybeSingle()
  if (error) return null
  if (!data) return 'missing'
  const d = docOf(data)
  let email = d.sentTo || d.homeEmail, price = 0
  if (d.homeId) {
    const { data: h } = await db.from('homes').select(HOME_COLS).eq('id', d.homeId).maybeSingle()
    if (h) {
      email = email || h.email || ''
      price = Number(h.price) || 0
      if (d.status === 'draft') d.snap = snapFromHome(homeLike(h))
    }
  }
  return { d, email, price }
}

/** Clients you can make a new agreement for (not ended), for Documents → New agreement. */
export async function loadHomePicks(): Promise<{ id: string; label: string }[]> {
  const db = createClient() as any
  const { data } = await db.from('homes').select('id, name, suburb, status').eq('division', 'res').neq('status', 'ended').order('name')
  return ((data as any[]) || []).map(h => ({ id: h.id, label: h.name + (h.suburb ? ' (' + h.suburb + ')' : '') }))
}
