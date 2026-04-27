import { NextRequest, NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedInvoiceLine {
  line_number: number
  description: string | null
  client_name_raw: string | null
  hours: number | null
  rate_per_hour: number | null
  cost_ex_gst: number | null
  gst: number | null
  cost_incl_gst: number | null
}

export interface ParsedInvoice {
  invoice_number: string | null
  invoice_date: string | null
  billing_month: string | null     // "YYYY-MM"
  lines: ParsedInvoiceLine[]
  total_ex_gst: number | null
  total_gst: number | null
  total_incl_gst: number | null
  raw_text_preview: string
  extraction_method: 'ai' | 'fallback'
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not set — required for PDF parsing' }, { status: 500 })
    }

    // Send the PDF directly to Claude — no text extraction library needed.
    // Claude natively reads PDFs and extracts structured data far more accurately
    // than any regex or text-extraction approach.
    const result = await extractWithClaude(base64, apiKey)
    return NextResponse.json({ ...result, extraction_method: 'ai' } as ParsedInvoice)

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Failed to parse PDF: ${msg}` }, { status: 500 })
  }
}

// ─── AI extraction (Claude reads PDF natively) ────────────────────────────────

const AI_PROMPT = `You are extracting structured data from a commercial cleaning subcontractor invoice.
The invoice lists hours worked at each client/site for a given month.

Extract the following and return ONLY valid JSON, no explanation:

{
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "billing_month": "YYYY-MM — the month the services were performed, not the invoice date",
  "total_ex_gst": number or null,
  "total_gst": number or null,
  "total_incl_gst": number or null,
  "raw_text_preview": "first 300 chars of any text you can read from the invoice",
  "lines": [
    {
      "line_number": 1,
      "description": "full line description",
      "client_name_raw": "exact client/site name as written on invoice",
      "hours": number or null,
      "rate_per_hour": number or null,
      "cost_ex_gst": number or null,
      "gst": number or null,
      "cost_incl_gst": number or null
    }
  ]
}

Rules for billing_month (critical):
- Look for text like "Monthly Invoice - March", "Invoice for March 2025", "Reference: Monthly Invoice - March", "For the month of April", "Billing period: May 2025".
- billing_month is the month services were PERFORMED, not when the invoice was issued.
- If only a month name appears without a year (e.g. "Monthly Invoice - March"), infer the year from the invoice date or any other date context in the document.
- Format must be "YYYY-MM" (e.g. "2025-03").

Other rules:
- cost_ex_gst = hours × rate_per_hour (amount before 10% GST)
- gst = cost_ex_gst × 0.10
- cost_incl_gst = cost_ex_gst + gst
- If amounts shown are GST-inclusive, back-calculate: ex_gst = incl ÷ 1.1
- client_name_raw must be the EXACT name as printed on the invoice`

async function extractWithClaude(base64Pdf: string, apiKey: string): Promise<ParsedInvoice> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64Pdf,
              },
            },
            {
              type: 'text',
              text: AI_PROMPT,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Claude API error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const content: string = data.content?.[0]?.text ?? ''

  // Extract JSON from the response
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude did not return valid JSON')

  const extracted = JSON.parse(jsonMatch[0])

  // Normalise and type-check lines
  if (!Array.isArray(extracted.lines)) extracted.lines = []
  extracted.lines = extracted.lines.map((l: Record<string, unknown>, i: number) => ({
    line_number:     (l.line_number as number) ?? i + 1,
    description:     (l.description as string) ?? null,
    client_name_raw: (l.client_name_raw as string) ?? null,
    hours:           toNum(l.hours),
    rate_per_hour:   toNum(l.rate_per_hour),
    cost_ex_gst:     toNum(l.cost_ex_gst),
    gst:             toNum(l.gst),
    cost_incl_gst:   toNum(l.cost_incl_gst),
  }))

  return {
    invoice_number:  extracted.invoice_number  ?? null,
    invoice_date:    extracted.invoice_date    ?? null,
    billing_month:   extracted.billing_month   ?? null,
    lines:           extracted.lines,
    total_ex_gst:    toNum(extracted.total_ex_gst),
    total_gst:       toNum(extracted.total_gst),
    total_incl_gst:  toNum(extracted.total_incl_gst),
    raw_text_preview: extracted.raw_text_preview ?? '',
    extraction_method: 'ai',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/,/g, ''))
  return isNaN(n) ? null : n
}
