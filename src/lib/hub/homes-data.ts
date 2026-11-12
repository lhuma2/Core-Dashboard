import { createClient } from '@/lib/supabase/server'
import { homeOf, HOME_COLS, type Home, type History } from './homes'
import { docOf, DOC_COLS, type HomeDoc } from './home-agreements'

export interface Cleaner { id: string; name: string }

export async function loadCleaners(): Promise<Cleaner[]> {
  const db = createClient() as any
  const { data } = await db.from('profiles').select('id, full_name').eq('role', 'cleaner').order('full_name')
  return ((data as any[]) || []).map(p => ({ id: p.id, name: p.full_name || 'Cleaner' }))
}

/** All residential homes. Null if the hub can't be reached. */
export async function loadHomes(): Promise<Home[] | null> {
  const db = createClient() as any
  const { data, error } = await db.from('homes').select(HOME_COLS).eq('division', 'res')
  if (error) return null
  return (data as any[]).map(homeOf)
}

/** One home with its history (newest first) and documents. */
export async function loadHome(id: string): Promise<{ h: Home; history: History[]; docs: HomeDoc[] } | null | 'missing'> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return 'missing'
  const db = createClient() as any
  const [{ data, error }, hist, docs] = await Promise.all([
    db.from('homes').select(HOME_COLS).eq('id', id).maybeSingle(),
    db.from('home_history').select('date, text, created_at').eq('home_id', id),
    db.from('home_docs').select(DOC_COLS).eq('home_id', id),
  ])
  if (error) return null
  if (!data) return 'missing'
  const history = ((hist.data as any[]) || [])
    .sort((a, b) => (a.date === b.date ? (a.created_at < b.created_at ? 1 : -1) : a.date < b.date ? 1 : -1))
    .map(r => ({ date: String(r.date).slice(0, 10), text: r.text }))
  return { h: homeOf(data), history, docs: ((docs.data as any[]) || []).map(docOf).sort((a, b) => (a.ref < b.ref ? 1 : -1)) }
}
