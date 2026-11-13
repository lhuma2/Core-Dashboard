import type { ComplianceDoc } from '@/lib/hub/compliance-docs'

const Dl = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>
const FileIc = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>

/** One compliance document, as in the mock-up's document view. `pdfHref` downloads it as a PDF. */
export function DocArticle({ d, pdfHref, fileName }: { d: ComplianceDoc; pdfHref: string; fileName: string }) {
  return (
    <article className="doc">
      <div className="dochead">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="doclogo" src="/hub-logo-white.png" alt="Core Cleaning" />
        <div><div className="doccode">{d.code}</div><h1 className="doctitle">{d.title}</h1></div>
      </div>
      {d.pdf
        ? <div className="docpdfs">
            <a className="btn log docpdf" href={d.pdf} download={fileName} aria-label={`Download ${d.code} ${d.title} as a PDF`}><Dl />Download PDF</a>
            <a className="btn call docpdf" href={d.pdf} target="_blank" rel="noopener" aria-label={`Open ${d.pdfName || 'the PDF'} in a new tab`}><FileIc />Open the PDF</a>
            <span className="docpdfname">{d.pdfName}</span>
          </div>
        : <a className="btn call docpdf" href={pdfHref} download={fileName} aria-label={`Download ${d.code} ${d.title} as a PDF`}><Dl />Download PDF</a>}
      {d.blocks.map((b, i) => {
        if (b.k === 'meta') return <div className="docmeta" key={i}>{b.items.map((t, j) => <span key={j}>{t}</span>)}</div>
        if (b.k === 'ul') return <ul className="dul" key={i}>{b.items.map((t, j) => <li key={j}>{t}</li>)}</ul>
        if (b.k === 'h') return <h2 className="dh" key={i}>{b.text}</h2>
        if (b.k === 'label') return <div className="dlabel" key={i}>{b.text}</div>
        return <p className="dp" key={i}>{'text' in b ? b.text : ''}</p>
      })}
    </article>
  )
}
