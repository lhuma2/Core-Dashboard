import 'server-only'
import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { ComplianceDoc } from './compliance-docs'

// Compliance documents as A4 PDFs, laid out like the hub's document view. The certificate of currency and ABN
// printout are their original PDFs, put in as they are.

const s = StyleSheet.create({
  page: { paddingTop: 0, paddingBottom: 48, paddingHorizontal: 0, fontSize: 10.5, fontFamily: 'Helvetica', color: '#13201a', lineHeight: 1.45 },
  head: { backgroundColor: '#00250e', color: '#fff', flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 40, marginBottom: 16 },
  logo: { height: 30, marginRight: 18 },
  code: { fontSize: 9, color: '#9fe5cc', letterSpacing: 0.6 },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  body: { paddingHorizontal: 40 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  metaItem: { fontSize: 8.5, color: '#3d4b45', backgroundColor: '#eef1ef', borderRadius: 8, paddingVertical: 2, paddingHorizontal: 6, marginRight: 5, marginBottom: 4 },
  h: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#00250e', marginTop: 12, marginBottom: 3 },
  label: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#5d6b65', letterSpacing: 0.6, marginTop: 6, marginBottom: 1 },
  p: { marginVertical: 3 },
  li: { flexDirection: 'row', marginVertical: 1.5, paddingLeft: 4 },
  dot: { width: 10 },
  liText: { flex: 1 },
  // a fixed Text, not a fixed row: react-pdf drops a fixed absolute View with children. Page numbers go on after (see stampPages).
  footL: { position: 'absolute', bottom: 20, left: 40, fontSize: 8, color: '#8a9893' },
})

function DocPages({ d, logo }: { d: ComplianceDoc; logo: Buffer | null }) {
  return (
    <Page size="A4" style={s.page}>
      <View style={s.head} fixed={false}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {logo && <Image style={s.logo} src={logo} />}
        <View style={{ flex: 1 }}><Text style={s.code}>{d.code}</Text><Text style={s.title}>{d.title}</Text></View>
      </View>
      <View style={s.body}>
        {d.blocks.map((b, i) => {
          if (b.k === 'meta') return <View key={i} style={s.meta}>{b.items.map((t, j) => <Text key={j} style={s.metaItem}>{t}</Text>)}</View>
          if (b.k === 'ul') return <View key={i}>{b.items.map((t, j) => <View key={j} style={s.li} wrap={false}><Text style={s.dot}>•</Text><Text style={s.liText}>{t}</Text></View>)}</View>
          if (b.k === 'h') return <Text key={i} style={s.h} minPresenceAhead={40}>{b.text}</Text>
          if (b.k === 'label') return <Text key={i} style={s.label} minPresenceAhead={20}>{b.text.toUpperCase()}</Text>
          return <Text key={i} style={s.p}>{'text' in b ? b.text : ''}</Text>
        })}
      </View>
      <Text style={s.footL} fixed>Core Cleaning · ABN 45 344 135 153 · 0407 026 360 · contact@corecleaning.services</Text>
    </Page>
  )
}

/** The logo and the original PDFs, bundled with the server code (next.config traces src/lib/documents/assets). */
async function asset(name: string): Promise<Buffer | null> {
  try {
    const { readFile } = await import('node:fs/promises')
    const path = await import('node:path')
    return await readFile(path.join(process.cwd(), 'src/lib/documents/assets/compliance', name))
  } catch { return null }
}
export const originalPdf = (d: ComplianceDoc) => (d.pdf ? asset(d.pdf.split('/').pop()!) : Promise.resolve(null))

/** "SWMS 002 · page 1 of 2" at the bottom right of each page of a rendered document. */
async function stampPages(src: PDFDocument, code: string) {
  const font = await src.embedFont(StandardFonts.Helvetica)
  const pages = src.getPages()
  pages.forEach((pg, i) => {
    const t = `${code} · page ${i + 1} of ${pages.length}`
    pg.drawText(t, { x: pg.getWidth() - 40 - font.widthOfTextAtSize(t, 8), y: 28.2, size: 8, font, color: rgb(0x8a / 255, 0x98 / 255, 0x93 / 255) })
  })
}

/** One PDF with every document in order. */
export async function compliancePdf(docs: ComplianceDoc[]): Promise<Buffer> {
  const logo = await asset('hub-logo-white.png')
  const out = await PDFDocument.create()
  for (const d of docs) {
    const orig = await originalPdf(d)
    const src = await PDFDocument.load(orig || await renderToBuffer(<Document title={`${d.code} ${d.title}`} author="Core Cleaning"><DocPages d={d} logo={logo} /></Document>))
    if (!orig) await stampPages(src, d.code)
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach(p => out.addPage(p))
  }
  out.setTitle(docs.length === 1 ? `${docs[0].code} ${docs[0].title}` : 'Core Cleaning compliance documents')
  out.setAuthor('Core Cleaning')
  return Buffer.from(await out.save())
}

/** Response headers for a PDF download (a plain name for old browsers, the exact name for the rest). */
export function pdfHeaders(name: string, inline = false): Record<string, string> {
  const plain = name.replace(/[^\x20-\x7E]/g, '').replace(/["\\]/g, '') || 'document.pdf'
  return { 'content-type': 'application/pdf', 'content-disposition': `${inline ? 'inline' : 'attachment'}; filename="${plain}"; filename*=UTF-8''${encodeURIComponent(name)}`, 'cache-control': 'private, no-store' }
}
