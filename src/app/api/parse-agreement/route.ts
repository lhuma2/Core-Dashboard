import { NextRequest, NextResponse } from 'next/server'

const EXTRACTION_PROMPT = `You are extracting structured data from a commercial cleaning service contract or proposal.

Extract the following fields from the text.
If a field is not found, use null for that field.

Fields to extract:
- business_name: string — the client's business or company name
- contact_name: string — the primary contact person's full name
- contact_email: string — email address
- contact_phone: string — Australian phone number
- address: string — street address only (no suburb/state/postcode)
- suburb: string — suburb or city name
- state: string — Australian state abbreviation (QLD, NSW, VIC, SA, WA, TAS, NT, ACT)
- postcode: string — 4-digit Australian postcode
- service_type: array of strings — one or more of: general_cleaning, pressure_washing, window_cleaning, floor_care
- frequency: string — one of: daily, weekly, fortnightly, monthly, quarterly, annual, one_off
- rate_per_visit: number — dollar amount per visit (no $ symbol, just the number)
- contract_start_date: string — ISO format YYYY-MM-DD if found, otherwise null
- contract_expiry_date: string — ISO format YYYY-MM-DD if found (look for contract end date, expiry, or duration), otherwise null

CONTRACT TEXT:
`

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text from PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfParseModule = await import('pdf-parse') as any
    const pdfParse = pdfParseModule.default ?? pdfParseModule
    const parsed = await pdfParse(buffer)
    const text = parsed.text

    // Try AI extraction first if ANTHROPIC_API_KEY is available
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (apiKey) {
      try {
        const aiResult = await extractWithClaude(text, apiKey)
        if (aiResult) {
          return NextResponse.json({
            ...aiResult,
            raw_text_preview: text.substring(0, 500),
            extraction_method: 'ai',
          })
        }
      } catch (aiErr) {
        console.error('AI extraction failed, falling back to regex:', aiErr)
      }
    }

    // Fallback: regex extraction
    const regexResult = extractWithRegex(text)
    return NextResponse.json({
      ...regexResult,
      raw_text_preview: text.substring(0, 500),
      extraction_method: 'regex',
    })
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to parse PDF: ${err?.message || String(err)}` }, { status: 500 })
  }
}

// ─── AI extraction via Claude ─────────────────────────────────────────────────

async function extractWithClaude(text: string, apiKey: string): Promise<Record<string, unknown> | null> {
  // Truncate text to avoid token limits
  const truncatedText = text.length > 8000 ? text.substring(0, 8000) + '\n[... truncated ...]' : text

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              business_name: { type: ['string', 'null'] },
              contact_name: { type: ['string', 'null'] },
              contact_email: { type: ['string', 'null'] },
              contact_phone: { type: ['string', 'null'] },
              address: { type: ['string', 'null'] },
              suburb: { type: ['string', 'null'] },
              state: { type: ['string', 'null'] },
              postcode: { type: ['string', 'null'] },
              service_type: { type: 'array', items: { type: 'string' } },
              frequency: { type: ['string', 'null'] },
              rate_per_visit: { type: ['number', 'null'] },
              contract_start_date: { type: ['string', 'null'] },
              contract_expiry_date: { type: ['string', 'null'] },
            },
            required: [
              'business_name', 'contact_name', 'contact_email', 'contact_phone',
              'address', 'suburb', 'state', 'postcode', 'service_type',
              'frequency', 'rate_per_visit', 'contract_start_date', 'contract_expiry_date',
            ],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: EXTRACTION_PROMPT + truncatedText,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content?.[0]?.text ?? ''

  // output_config.format guarantees the text block is valid JSON matching the schema
  const extracted = JSON.parse(content)

  // Normalise service_type to ensure it's an array
  if (!Array.isArray(extracted.service_type)) {
    extracted.service_type = extracted.service_type ? [extracted.service_type] : ['general_cleaning']
  }
  if (extracted.service_type.length === 0) {
    extracted.service_type = ['general_cleaning']
  }

  // Normalise frequency
  const validFreqs = ['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annual', 'one_off']
  if (!validFreqs.includes(extracted.frequency)) {
    extracted.frequency = 'monthly'
  }

  return extracted
}

// ─── Regex fallback ───────────────────────────────────────────────────────────

function extractWithRegex(text: string): Record<string, unknown> {
  const extract = (patterns: RegExp[]): string => {
    for (const p of patterns) {
      const m = text.match(p)
      if (m?.[1]) return m[1].trim()
    }
    return ''
  }

  const business_name = extract([
    /(?:between|for|client[:\s]+|company[:\s]+|business[:\s]+)\s*([A-Z][A-Za-z\s&'.,-]+(?:Pty|Ltd|Inc|Group|Centre|Center|Clinic|Medical|Dental|Legal|Co)?\.?\s*(?:Pty\.?\s*Ltd\.?)?)/,
    /^([A-Z][A-Za-z\s&'.,]+(?:Pty|Ltd|Group|Centre|Clinic|Medical|Dental)?(?:\s+(?:Pty\.?\s*Ltd\.?))?)\s*$/m,
  ])

  const contact_name = extract([
    /contact[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /attention[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
    /(?:name|authorised|authorized)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
  ])

  const contact_email = extract([/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/])
  const contact_phone = extract([/((?:\+?61|0)[2-9]\d{8}|\+?61\s*\d{9}|0[2-9]\s*\d{4}\s*\d{4})/])

  const address = extract([
    /(?:address|site|location|premises)[:\s]+(\d+[A-Za-z]?\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Court|Ct|Place|Pl|Way|Circuit|Cct|Crescent|Cres|Terrace|Tce)(?:\s+[A-Za-z]+)*)/i,
  ])

  const suburb = extract([
    /(?:suburb|city)[:\s]+([A-Za-z\s]+),?\s*(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)/i,
    /([A-Za-z\s]+),?\s*(?:QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4}/,
  ])

  const stateMatch = text.match(/\b(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\b/)
  const state = stateMatch?.[1] || 'QLD'

  const postcode = extract([/\b(\d{4})\b/])

  // Frequency
  let frequency = 'monthly'
  const freqMap: [string, string][] = [
    ['daily', 'daily'], ['weekly', 'weekly'], ['fortnightly', 'fortnightly'],
    ['monthly', 'monthly'], ['quarterly', 'quarterly'], ['annual', 'annual'],
    ['one.?off|one off|once off', 'one_off'],
  ]
  for (const [pat, val] of freqMap) {
    if (new RegExp(pat, 'i').test(text)) { frequency = val; break }
  }

  // Rate per visit
  const rateMatch = text.match(/\$\s*([\d,]+(?:\.\d{2})?)\s*(?:per|\/)\s*(?:visit|clean|service)/i)
  const rate_per_visit = rateMatch ? parseFloat(rateMatch[1].replace(',', '')) : null

  // Service types
  const service_type: string[] = []
  if (/general.?clean|office.?clean|commercial.?clean/i.test(text)) service_type.push('general_cleaning')
  if (/pressure.?wash|high.?pressure/i.test(text)) service_type.push('pressure_washing')
  if (/window.?clean|glass.?clean/i.test(text)) service_type.push('window_cleaning')
  if (/floor.?care|carpet|vinyl|strip.?seal/i.test(text)) service_type.push('floor_care')
  if (service_type.length === 0) service_type.push('general_cleaning')

  // Start date
  const startDateMatch = text.match(/(?:commenc(?:e|ing)|start(?:ing)?|from)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i)
  let contract_start_date: string | null = null
  if (startDateMatch?.[1]) {
    try {
      const d = new Date(startDateMatch[1])
      if (!isNaN(d.getTime())) contract_start_date = d.toISOString().split('T')[0]
    } catch {}
  }

  // Expiry date
  const expiryMatch = text.match(/(?:expir(?:y|es|ing)|end.?date|term(?:inate)?s?)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})/i)
  let contract_expiry_date: string | null = null
  if (expiryMatch?.[1]) {
    try {
      const d = new Date(expiryMatch[1])
      if (!isNaN(d.getTime())) contract_expiry_date = d.toISOString().split('T')[0]
    } catch {}
  }

  return {
    business_name,
    contact_name,
    contact_email,
    contact_phone,
    address,
    suburb,
    state,
    postcode,
    frequency,
    rate_per_visit,
    service_type,
    contract_start_date,
    contract_expiry_date,
  }
}
