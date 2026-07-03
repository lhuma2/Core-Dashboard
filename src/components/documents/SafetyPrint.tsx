'use client'

import { SwmsDocument, ModernSlaveryDocument, SdsRegisterDocument, PolicyDocument, SubcontractorAgreementDocument, InductionDocument } from '@/components/documents/render/SwmsDocument'
import type { Swms, Policy } from '@/lib/documents/safety'

// Printable view for any Safety & Compliance document — A4 rules + a screen-only
// "Download PDF" button (browser print-to-PDF).
export function SafetyPrint({ swms, policy, sds, agreement, induction }: { swms?: Swms; policy?: Policy; sds?: boolean; agreement?: boolean; induction?: boolean }) {
  return (
    <>
      <style>{`
        @page { size: A4; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        [data-sheet] { box-shadow: none !important; }
        @media print {
          [data-screen-only] { display: none !important; }
          html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <div data-screen-only style={{ position: 'fixed', top: 18, right: 18, zIndex: 60 }}>
        <button
          onClick={() => window.print()}
          style={{ fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 12, fontWeight: 600, letterSpacing: '.04em', background: '#0F172A', color: '#fff', border: 'none', borderRadius: 999, padding: '11px 22px', cursor: 'pointer', boxShadow: '0 6px 18px rgba(15,23,42,.28)' }}
        >
          Download PDF
        </button>
      </div>
      <div style={{ background: '#E6E8EB', minHeight: '100vh', padding: '24px 0' }}>
        {swms ? <SwmsDocument swms={swms} />
          : policy ? <PolicyDocument policy={policy} />
          : agreement ? <SubcontractorAgreementDocument />
          : induction ? <InductionDocument />
          : sds ? <SdsRegisterDocument />
          : <ModernSlaveryDocument />}
      </div>
    </>
  )
}
