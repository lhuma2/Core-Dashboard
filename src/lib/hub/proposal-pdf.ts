import 'server-only'
import { createElement } from 'react'
import type { PropDocView } from './proposals'

/**
 * The proposal as a PDF file for the email, made from the same page as the preview (each section on its own A4 page)
 * through the PDF service the old hub already uses (PDFSHIFT_API_KEY). Null when that isn't set up (the test site) or
 * the service fails: the email then goes without the attachment, and the link still has the full proposal.
 */
export async function proposalPdf(d: PropDocView, site: string): Promise<Buffer | null> {
  const key = process.env.PDFSHIFT_API_KEY?.trim()
  if (!key) return null
  try {
    const [{ renderToStaticMarkup }, { readFile }, path, { ProposalDoc }] = await Promise.all([
      import('react-dom/server'), import('node:fs/promises'), import('node:path'), import('@/components/hub/ProposalDoc'),
    ])
    const css = await readFile(path.join(process.cwd(), 'src/app/(hub)/hub/hub.css'), 'utf8')
    const body = renderToStaticMarkup(createElement(ProposalDoc, { d }))
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><base href="${site}/"><style>${css}
@page{size:A4;margin:0} html,body{margin:0;background:#fff} body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.hub .pdoc{gap:0;max-width:none}.hub .pcover,.hub .ppage{break-after:page;page-break-after:always;border-radius:0;border:0;min-height:297mm;box-sizing:border-box}
.hub .ppage:last-child{break-after:auto;page-break-after:auto}</style></head><body><div class="hub">${body}</div></body></html>`
    const res = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from('api:' + key).toString('base64'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: html, use_print: true, format: 'A4', margin: '0', delay: 400 }),
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch { return null }
}
