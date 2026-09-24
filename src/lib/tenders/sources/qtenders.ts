import { isRelevantTender, classifyNoticeType, stripHtml, extractEmail, extractPhone, truncate } from '../relevance'
import type { TenderCandidate } from '../types'

const SEARCH_URL = 'https://qtenders.hpw.qld.gov.au/api/search/tenders'
// Category ids, from /api/search/options.
const CLEANING_CATEGORY_ID = '116'      // "Cleaning Services & Equipment & Supplies"
const HORTICULTURE_CATEGORY_ID = '19'   // "Horticulture & Arboriculture" — where leaf blowing lives
const OPEN_STATUS_ID = '1'
// Service area: North Brisbane to Gold Coast. Region ids "Brisbane" (3) and
// "Gold Coast" (11), from /api/search/options — the API matches a tender if
// ANY of its (often multi-region) locations is in this list, so statewide
// contracts that include Brisbane/Gold Coast still come through.
const REGION_IDS = ['3', '11']

// Cast a wide net, then let isRelevantTender() (title/details text, not the
// category tag) do the real filtering — a category alone is too coarse: the
// Cleaning category also carries waste-management tenders, and Horticulture
// carries mowing/landscaping/arboriculture work we don't do except for the
// leaf-blowing exception.
const SEARCHES: { keywords: string; categoryIds: string[] }[] = [
  { keywords: '', categoryIds: [CLEANING_CATEGORY_ID] },
  { keywords: '', categoryIds: [HORTICULTURE_CATEGORY_ID] },
  { keywords: 'leaf blowing', categoryIds: [] },
  { keywords: 'cleaning', categoryIds: [] },
]

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

async function runSearch(keywords: string, categoryIds: string[]): Promise<QTenderRow[]> {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Accept': 'application/json' },
    body: JSON.stringify({
      keywords,
      agencyIds: [],
      categoryIds,
      locationIds: REGION_IDS,
      productServiceIds: [],
      tenderStatusIds: [OPEN_STATUS_ID],
      pageNumber: 1,
      pageSize: 50,
      sortBy: 'Relevance',
    }),
  })
  if (!res.ok) return []
  const data = await res.json() as { tenders: QTenderRow[] }
  return data.tenders ?? []
}

export async function fetchQtendersCandidates(limit = 12): Promise<TenderCandidate[]> {
  const batches = await Promise.allSettled(SEARCHES.map((s) => runSearch(s.keywords, s.categoryIds)))

  const seen = new Set<string>()
  const rows: QTenderRow[] = []
  for (const batch of batches) {
    if (batch.status !== 'fulfilled') continue
    for (const row of batch.value) {
      if (seen.has(row.vpReference)) continue
      seen.add(row.vpReference)
      rows.push(row)
    }
  }

  const results: TenderCandidate[] = []
  for (const row of rows) {
    const title = stripMarks(row.title)
    const detailsText = stripHtml(stripMarks(row.details || ''))

    // categoryIds/keywords above only narrow candidates down — the real
    // include/exclude check runs on title + free-text details, never on the
    // category/tag strings (those would trivially match whatever category
    // was searched for regardless of actual relevance).
    if (!isRelevantTender(title, detailsText)) continue

    results.push({
      source: 'qtenders',
      external_id: row.vpReference,
      title,
      notice_type: classifyNoticeType(title, detailsText),
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
