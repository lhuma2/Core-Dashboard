import { isRelevantTender, stripHtml, extractEmail, extractPhone, truncate } from '../relevance'
import type { TenderCandidate } from '../types'

const SEARCH_URL = 'https://qtenders.hpw.qld.gov.au/api/search/tenders'
// "Cleaning Services & Equipment & Supplies" category id, from /api/search/options.
const CLEANING_CATEGORY_ID = '116'
const OPEN_STATUS_ID = '1'

interface QTenderRow {
  id: number
  title: string
  businessName: string
  vpReference: string
  opens: string | null
  closes: string | null
  details: string
  tenderPreviewUrl: string
  issuerName: string
  categories: string[]
  locations: string[]
  productsServices: string[]
  isOpen: boolean
}

function stripMarks(s: string): string {
  return s.replace(/<\/?mark[^>]*>/gi, '')
}

function toDate(iso: string | null): string | null {
  if (!iso) return null
  return iso.slice(0, 10)
}

export async function fetchQtendersCandidates(limit = 12): Promise<TenderCandidate[]> {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json' },
    body: JSON.stringify({
      keywords: '',
      agencyIds: [],
      categoryIds: [CLEANING_CATEGORY_ID],
      locationIds: [],
      productServiceIds: [],
      tenderStatusIds: [OPEN_STATUS_ID],
      pageNumber: 1,
      pageSize: 50,
      sortBy: 'Relevance',
    }),
  })
  if (!res.ok) return []
  const data = await res.json() as { tenders: QTenderRow[] }
  const rows = data.tenders ?? []

  const results: TenderCandidate[] = []
  for (const row of rows) {
    const title = stripMarks(row.title)
    const detailsText = stripHtml(stripMarks(row.details || ''))

    // categoryIds already scoped the query to "Cleaning Services & Equipment &
    // Supplies", so every row carries that tag regardless of relevance — the
    // include/exclude check has to run on title + free-text details only.
    if (!isRelevantTender(title, detailsText)) continue

    results.push({
      source: 'qtenders',
      external_id: row.vpReference,
      title,
      issuer: row.issuerName || row.businessName || null,
      category: (row.categories ?? []).map(stripMarks).join(', ') || null,
      summary: truncate(detailsText),
      location: (row.locations ?? []).join(', ') || null,
      open_date: toDate(row.opens),
      close_date: toDate(row.closes),
      contact_name: null,
      contact_email: extractEmail(detailsText),
      contact_phone: extractPhone(detailsText),
      url: row.tenderPreviewUrl,
    })
    if (results.length >= limit) break
  }
  return results
}
