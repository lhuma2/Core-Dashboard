import { brisbaneToday } from './figures'
import { bodyOf, eolQuoteFromRequest, eolWebReqFrom, quoteFromRequest, quoteRef, requestRoute, webReqFrom } from './home-quotes'
import type { QuoteRequest } from '@/lib/documents/quote-request'

/**
 * A Residential or End of Lease website request becomes a draft quote under that division's Quotes tab, filled in
 * from their form. Returns null for anything else (Commercial keeps its own path for now).
 */
export async function draftHomeQuote(db: any, req: QuoteRequest): Promise<null | { error: string } | { id: string; ref: string; kind: string; div: 'res' | 'eol' }> {
  const route = requestRoute({ service: req.service })
  const eol = route.tab === 'eol'
  if (!eol && (route.tab !== 'residential' || !/residential/i.test(req.service || ''))) return null
  const div = eol ? 'eol' : 'res'
  const w = eol ? eolWebReqFrom(req) : webReqFrom(req)
  const today = brisbaneToday()
  const { data: n, error: nErr } = await db.rpc('hub_next_number', { p_key: 'quote_' + div })
  if (nErr || !n) return { error: nErr?.message ?? 'Could not number the quote' }
  const q = eol ? eolQuoteFromRequest(w, quoteRef(n, div), today) : quoteFromRequest(w, quoteRef(n), today)
  const { data, error } = await db.from('home_quotes').insert({
    division: div, ref: q.ref, source: 'website', status: 'draft', created_on: today,
    name: q.name || 'No name given', email: q.email || null, phone: q.phone || null, body: bodyOf(q), request: w,
  }).select('id').single()
  if (error) return { error: error.message }
  return { id: data.id, ref: q.ref, div, kind: eol ? 'End of Lease' : 'Residential, ' + (q.type === 'deep' ? 'Deep-Clean' : 'General Maintenance') }
}
