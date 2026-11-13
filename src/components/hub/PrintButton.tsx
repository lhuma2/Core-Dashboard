'use client'

import { useEffect } from 'react'

/** Download PDF: the browser's print (Save as PDF), laid out page by page by the print rules in hub.css.
 *  With auto, the print dialog opens by itself once the page has loaded (the list's Download PDF links). */
export function PrintButton({ label = 'Download PDF', auto = false }: { label?: string; auto?: boolean }) {
  useEffect(() => { if (!auto) return; const t = setTimeout(() => window.print(), 700); return () => clearTimeout(t) }, [auto])
  return <button type="button" className="btn log" onClick={() => window.print()}>{label}</button>
}
