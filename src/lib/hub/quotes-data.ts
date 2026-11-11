import { createClient } from '@/lib/supabase/server'
import { quoteOf, QUOTE_COLS, type Quote, type QuoteRow } from './home-quotes'

/** All residential quotes, newest ref first. Null if the hub can't be reached. */
export async function loadQuotes(): Promise<Quote[] | null> {
  const db = createClient() as any
  const { data, error } = await db.from('home_quotes').select(QUOTE_COLS).eq('division', 'res')
  if (error) return null
  return (data as QuoteRow[]).map(quoteOf).sort((a, b) => (a.ref < b.ref ? 1 : -1))
}

export async function loadQuote(id: string): Promise<Quote | null | 'missing'> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return 'missing'
  const db = createClient() as any
  const { data, error } = await db.from('home_quotes').select(QUOTE_COLS).eq('id', id).maybeSingle()
  if (error) return null
  return data ? quoteOf(data as QuoteRow) : 'missing'
}

export function toDoCount(list: Quote[]): number { return list.filter(q => q.status === 'draft' || q.status === 'changes').length }
