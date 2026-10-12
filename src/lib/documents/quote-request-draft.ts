import { hasTemplate, type TemplateDocData } from './template'
import {
  CLIENT_TYPE_FOR_KIND, QUOTE_REQUEST_KIND_LABELS, kindOfRequest, pickTemplate, valuesFromRequest,
  type QuoteRequest, type QuoteRequestKind,
} from './quote-request'

export type DraftResult =
  | { id: string; template: string; kind: QuoteRequestKind }
  | { skipped: string }
  | { error: string }

/** Makes a draft proposal for a website quote request from the matching quote template. */
export async function draftFromRequest(db: any, req: QuoteRequest): Promise<DraftResult> {
  const kind = kindOfRequest(req)
  if (!kind) return { skipped: `"${req.service || 'No service'}" isn't a service the hub drafts quotes for` }

  const { data: docs, error: docsErr } = await db.from('company_documents').select('id, name, file_url, template')
  if (docsErr) return { error: docsErr.message }
  const cd = pickTemplate<{ id: string; name: string; file_url: string; template: any }>(docs ?? [], kind)
  if (!cd) {
    const names = (docs ?? []).filter((d: any) => hasTemplate(d.template)).map((d: any) => d.name)
    return {
      skipped: `No quote template is set for ${QUOTE_REQUEST_KIND_LABELS[kind]} requests. `
        + (names.length ? `Templates found: ${names.join(', ')}. Choose one under "Website quote requests" on its setup screen.` : 'No company documents have template fields yet.'),
    }
  }

  const ref = `DC-PROP-${Math.floor(1000 + Math.random() * 8999)}`
  const data: TemplateDocData = {
    clientName: req.name,
    refNumber: ref,
    templateId: cd.id,
    templateName: cd.name,
    template: cd.template,
    values: valuesFromRequest(cd.template, req, ref),
    clientType: CLIENT_TYPE_FOR_KIND[kind],
    quoteRequest: { ...req, kind },
  }
  const { data: row, error } = await db.from('proposal_documents').insert({
    kind: 'proposal',
    status: 'draft',
    ref_number: ref,
    client_name: req.name,
    pdf_url: cd.file_url,
    signer_email: req.email,
    data,
  }).select('id').single()
  if (error) return { error: error.message }
  return { id: row.id, template: cd.name, kind }
}
