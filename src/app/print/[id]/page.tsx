'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DocumentPreview } from '@/components/documents/DocumentPreview'
import type { Document, DocumentContent } from '@/types/app'

const PRINT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    font-family: 'Inter', system-ui, sans-serif;
    background: #e0e0e0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    color-adjust: exact;
  }

  /* Screen: show pages with a shadow like a PDF viewer */
  .proposal-page {
    width: 210mm;
    min-height: 297mm;
    background: white;
    margin: 0 auto 24px;
    box-shadow: 0 2px 20px rgba(0,0,0,0.18);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .proposal-cover {
    min-height: 297mm;
    background: #161616 !important;
  }

  /* Print: exact A4 pages, no shadows, proper breaks */
  @media print {
    @page {
      size: A4 portrait;
      margin: 0;
    }

    html, body {
      background: white !important;
      margin: 0;
      padding: 0;
    }

    .no-print {
      display: none !important;
    }

    .proposal-page {
      width: 210mm !important;
      height: 297mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      margin: 0 !important;
      box-shadow: none !important;
      page-break-before: always !important;
      page-break-after: always !important;
      break-before: page !important;
      break-after: page !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
    }

    .proposal-cover {
      page-break-before: auto !important;
      break-before: auto !important;
      background: #161616 !important;
    }

    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
  }
`

export default function PrintPage() {
  const params = useParams()
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('documents')
      .select('*, clients(business_name, contact_email)')
      .eq('id', params.id as string)
      .single()
      .then(({ data }) => {
        setDocument(data)
        setLoading(false)
      })
  }, [params.id])

  // Auto-trigger print once fonts + images have loaded
  useEffect(() => {
    if (!loading && document) {
      const t = setTimeout(() => window.print(), 1200)
      return () => clearTimeout(t)
    }
  }, [loading, document])

  if (loading) {
    return (
      <>
        <style>{PRINT_CSS}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: '#777', background: '#e0e0e0' }}>
          Preparing document…
        </div>
      </>
    )
  }

  if (!document) {
    return (
      <>
        <style>{PRINT_CSS}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', color: '#777', background: '#e0e0e0' }}>
          Document not found.
        </div>
      </>
    )
  }

  const content = document.content as unknown as DocumentContent | null

  return (
    <>
      <style>{PRINT_CSS}</style>

      {/* Toolbar — hidden during print */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#1e3a5f', color: 'white', padding: '10px 20px',
        fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
      }}>
        <span style={{ fontWeight: 500 }}>{document.title}</span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => window.print()}
            style={{ background: 'white', color: '#1e3a5f', border: 'none', padding: '7px 20px', borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: 'pointer', letterSpacing: '0.05em' }}
          >
            Download PDF
          </button>
          <button
            onClick={() => window.close()}
            style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.25)', padding: '7px 14px', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Page content — padded below toolbar on screen */}
      <div className="no-print" style={{ height: 44 }} />
      <div style={{ paddingBottom: 40 }}>
        {content ? (
          <DocumentPreview document={document} content={content} />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#999', fontFamily: 'Inter, system-ui, sans-serif' }}>
            No content available.
          </div>
        )}
      </div>
    </>
  )
}
