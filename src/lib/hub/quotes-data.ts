import { createClient } from '@/lib/supabase/server'
import type { Div } from './div'
import { quoteOf, QUOTE_COLS, type Quote, type QuoteRow } from './home-quotes'

/** All quotes for the division, newest ref first. Null if the hub can't be reached. */
export async function loadQuotes(div: Div): Promise<Quote[] | null> {
  const db = createClient() as any
  const { data, error } = await db.from('home_quotes').select(QUOTE_COLS).eq('division', div)
  if (error) return null
  return (data as QuoteRow[]).map(quoteOf).sort((a, b) => (a.ref < b.ref ? 1 : -1))
}

export async function loadQuote(id: string, div?: Div): Promise<Quote | null | 'missing'> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return 'missing'
  const db = createClient() as any
  const { data, error } = await db.from('home_quotes').select(QUOTE_COLS).eq('id', id).maybeSingle()
  if (error) return null
  return data && (!div || (data as any).division === div) ? quoteOf(data as QuoteRow) : 'missing'
}

export function toDoCount(list: Quote[]): number { return list.filter(q => q.status === 'draft' || q.status === 'changes').length }

/** Quotes for one client: started from their page, or the quote they accepted. Null if the hub can't be reached. */
export async function loadHomeQuotes(homeId: string): Promise<Quote[] | null> {
  if (!/^[0-9a-f-]{36}$/.test(homeId)) return []
  const db = createClient() as any
  const [a, b] = await Promise.all([
    db.from('home_quotes').select(QUOTE_COLS).eq('home_id', homeId),
    db.from('home_quotes').select(QUOTE_COLS).eq('body->>forHome', homeId),
  ])
  if (a.error || b.error) return null
  const seen = new Set<string>()
  return ([...a.data, ...b.data] as QuoteRow[]).filter(r => !seen.has(r.id) && !!seen.add(r.id)).map(quoteOf).sort((x, y) => (x.ref < y.ref ? 1 : -1))
}
