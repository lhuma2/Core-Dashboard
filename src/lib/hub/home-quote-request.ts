import { brisbaneToday } from './figures'
import { bodyOf, quoteFromRequest, quoteRef, requestRoute, webReqFrom } from './home-quotes'
import type { QuoteRequest } from '@/lib/documents/quote-request'

/**
 * A residential website request becomes a draft quote under Residential › Quotes, filled in from their form.
 * Returns null when the request isn't residential (End of Lease and Commercial keep their own path for now).
 */
export async function draftHomeQuote(db: any, req: QuoteRequest): Promise<null | { error: string } | { id: string; ref: string; kind: string }> {
  const w = webReqFrom(req)
  const route = requestRoute(w)
  if (route.tab !== 'residential' || !/residential/i.test(req.service || '')) return null
  const today = brisbaneToday()
  const { data: n, error: nErr } = await db.rpc('hub_next_number', { p_key: 'quote_res' })
  if (nErr || !n) return { error: nErr?.message ?? 'Could not number the quote' }
  const q = quoteFromRequest(w, quoteRef(n), today)
  const { data, error } = await db.from('home_quotes').insert({
    division: 'res', ref: q.ref, source: 'website', status: 'draft', created_on: today,
    name: q.name || 'No name given', email: q.email || null, phone: q.phone || null, body: bodyOf(q), request: w,
  }).select('id').single()
  if (error) return { error: error.message }
  return { id: data.id, ref: q.ref, kind: q.type === 'deep' ? 'Deep-Clean' : 'General Maintenance' }
}
