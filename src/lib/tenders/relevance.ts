// Relevance filter shared by the AusTender and QTenders fetchers.
// Core Cleaning does residential, commercial and end-of-lease cleaning, plus
// pressure washing — but no other "external" cleaning (windows, gutters,
// facades, drains, tanks, etc).

const INCLUDE = /\b(clean(?:ing|er|ers)?|janitorial|janitor|bond\s*clean|vacate\s*clean|end[\s-]of[\s-]lease|move[\s-]out\s*clean|pressure\s*(?:wash|clean)|high[\s-]pressure\s*(?:wash|clean))\b/i

// Services Core Cleaning doesn't offer — a tender is rejected when one of
// these terms dominates the title (i.e. is what the tender is actually for),
// unless a pressure-wash term is also present in the title (that's the one
// external job we do take).
const EXCLUDE_TITLE = /\b(window\s*clean|facade\s*clean|roof\s*clean|gutter\s*clean|high[\s-]?rise\s*clean|external\s*(?:building\s*)?clean|drain\s*clean|sewer|sewage|grease\s*trap|pollutant\s*trap|pipe\s*clean|tank\s*clean|duct\s*clean|vessel\s*clean|car\s*clean|vehicle\s*(?:clean|wash|detail)|dry\s*clean|laundering|laundry\s*service|graffiti|road\s*sweep|street\s*sweep|waste\s*collection|garbage\s*collection|medical\s*waste|biohazard|hazmat|mining|industrial\s*degreas)/i

const PRESSURE = /\bpressure\s*(?:wash|clean)/i

// North Brisbane to Gold Coast service area. AusTender's Location field is
// only ever state/city-level text (no suburb granularity), so this is a
// best-effort gate — it lets through anything that mentions QLD/Brisbane/
// Gold Coast and rejects tenders explicitly scoped to other states/regions.
const SEQ_REGION = /\b(QLD|Queensland|Brisbane|Gold Coast|Logan|Redland(?:s)?|Moreton\s*Bay)\b/i

export function isSeqLocation(location: string | null): boolean {
  if (!location) return true // no location data — don't reject on missing info
  return SEQ_REGION.test(location)
}

export function isRelevantTender(title: string, bodyText: string): boolean {
  const combined = `${title} ${bodyText}`
  if (!INCLUDE.test(combined)) return false
  if (EXCLUDE_TITLE.test(title) && !PRESSURE.test(title)) return false
  return true
}

// A "pipeline" notice is advance warning that a tender is coming — you can't
// respond to it yet, it's just a heads-up to get ready for the real ITO/RFT.
const PIPELINE_PATTERN = /\b(forward\s*procurement\s*notice|prior\s*informat(?:ive|ion)\s*notice|notice\s*of\s*intent(?:ion)?\s*to\s*(?:tender|procure)|advance\s*notice\s*of\s*procurement|annual\s*procurement\s*plan)\b/i

export function classifyNoticeType(title: string, bodyText: string): 'tender' | 'pipeline' {
  return PIPELINE_PATTERN.test(`${title} ${bodyText}`) ? 'pipeline' : 'tender'
}

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
// Australian landline/mobile: optional +61 or 0, area/mobile prefix, 8 digits — allows spaces/dashes.
const PHONE_RE = /(?:\+?61[\s-]?|0)[2-478][\s-]?\d{4}[\s-]?\d{4}/

export function extractEmail(text: string): string | null {
  return text.match(EMAIL_RE)?.[0] ?? null
}

export function extractPhone(text: string): string | null {
  return text.match(PHONE_RE)?.[0]?.replace(/\s+/g, ' ').trim() ?? null
}

export function truncate(text: string, max = 500): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean
}
