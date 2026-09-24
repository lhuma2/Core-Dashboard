import { isRelevantTender, isSeqLocation, classifyNoticeType, stripHtml, extractEmail, extractPhone, truncate } from '../relevance'
import type { TenderCandidate } from '../types'

const RSS_URL = 'https://www.tenders.gov.au/public_data/rss/rss.xml'
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
}

interface RssItem { title: string; link: string; description: string }

function parseRss(xml: string): RssItem[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? []
  return items.map((item) => {
    const title = decodeXml(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
    const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? ''
    const description = decodeXml(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '')
    return { title, link, description: stripHtml(description) }
  })
}

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

function field(text: string, label: string): string | null {
  const re = new RegExp(`${label}\\s*:\\s*\\n?\\s*([^\\n]+)`, 'i')
  return text.match(re)?.[1]?.trim() || null
}

function parseAustenderDate(raw: string | null): string | null {
  if (!raw) return null
  // e.g. "2-Oct-2026 3:00 pm (ACT Local Time)" or "31-Aug-2026"
  const m = raw.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/)
  if (!m) return null
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
  }
  const month = months[m[2]]
  if (!month) return null
  return `${m[3]}-${month}-${m[1].padStart(2, '0')}`
}

async function fetchDetail(url: string): Promise<TenderCandidate | null> {
  const res = await fetch(url, { headers: BROWSER_HEADERS })
  if (!res.ok) return null
  const html = await res.text()
  const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html
  const text = stripHtml(main.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, ''))

  const atmId = field(text, 'ATM ID')
  if (!atmId) return null

  const agency = field(text, 'Agency')
  const category = field(text, 'Category')
  const closeRaw = field(text, 'Close Date & Time')
  const description = text.match(/Description\s*:\s*([\s\S]*?)\s*(?:Other Instructions|Conditions for Participation|Timeframe for Delivery|Address for Lodgement|Contact Details)\s*:?/i)?.[1]?.trim() ?? ''
  const location = field(text, 'Location')

  const contactBlock = text.match(/Contact Details\s*\n([\s\S]*?)(?:ATM Documents|$)/i)?.[1] ?? text
  const contactName = contactBlock.split('\n').map((l) => l.trim()).find((l) =>
    l && !/^(Email Address|Web Address|Phone|Fax)\s*:/i.test(l) && !EMAIL_LIKE.test(l)
  ) ?? null

  const titleLine = text.split('\n').map((l) => l.trim()).find((l) =>
    l.startsWith(atmId + ' ') && l !== `Current ATM View - ${atmId}`
  )
  const title = titleLine ? titleLine.slice(atmId.length).trim() : atmId

  if (!isRelevantTender(title, `${category ?? ''} ${description}`)) return null
  if (!isSeqLocation(location)) return null

  return {
    source: 'austender',
    external_id: atmId,
    title,
    notice_type: classifyNoticeType(title, `${category ?? ''} ${description}`),
    issuer: agency,
    category,
    summary: truncate(description || text),
    location,
    open_date: parseAustenderDate(field(text, 'Publish Date')),
    close_date: parseAustenderDate(closeRaw),
    contact_name: contactName,
    contact_email: extractEmail(contactBlock),
    contact_phone: extractPhone(contactBlock),
    url,
  }
}

const EMAIL_LIKE = /@/

export async function fetchAustenderCandidates(limit = 8): Promise<TenderCandidate[]> {
  const res = await fetch(RSS_URL, { headers: BROWSER_HEADERS })
  if (!res.ok) return []
  const xml = await res.text()
  const items = parseRss(xml)

  const shortlisted = items.filter((i) => isRelevantTender(i.title, i.description)).slice(0, limit)

  const results: TenderCandidate[] = []
  for (const item of shortlisted) {
    try {
      const candidate = await fetchDetail(item.link)
      if (candidate) results.push(candidate)
    } catch {
      // skip a detail page that fails to load — not worth failing the whole refresh
    }
  }
  return results
}
