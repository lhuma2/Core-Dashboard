'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Printer, Edit } from 'lucide-react'
import { formatDate, formatAUD } from '@/lib/formatters'
import type { Lead } from '@/types/app'

interface Props {
  lead: Lead
  type: 'proposal' | 'agreement'
}

export function LeadDocumentPreview({ lead, type }: Props) {
  const router = useRouter()
  const data = type === 'proposal'
    ? (lead.proposal_data || {})
    : (lead.agreement_data || {})

  const isEmpty = !data || Object.keys(data).length === 0

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Toolbar — not printed */}
      <div className="print:hidden sticky top-0 z-10 bg-slate-900 border-b border-slate-800 px-6 py-3 flex items-center justify-between gap-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-slate-100 hover:border-slate-600 transition-all"
          >
            <Edit className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-1.5 rounded-lg bg-[#1e3a5f] hover:bg-[#162d4a] text-white font-medium transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Document — white page, printable */}
      <div className="max-w-3xl mx-auto py-10 px-6 print:py-0 print:px-0">
        <div
          className="bg-white text-gray-900 rounded-xl shadow-2xl print:shadow-none print:rounded-none"
          style={{ minHeight: '1056px' }}
        >
          {isEmpty ? (
            <div className="flex flex-col items-center justify-center h-96 text-gray-400">
              <p className="text-lg font-medium">No {type} data yet</p>
              <p className="text-sm mt-1">Go back and fill in the {type} form first</p>
            </div>
          ) : type === 'proposal' ? (
            <ProposalDocument data={data} lead={lead} />
          ) : (
            <AgreementDocument data={data} lead={lead} />
          )}
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white; }
          @page { margin: 20mm; }
        }
      `}</style>
    </div>
  )
}

/* ─── Proposal Document ──────────────────────────────────────────────────── */

function ProposalDocument({ data, lead }: { data: any; lead: Lead }) {
  return (
    <div className="p-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-10 pb-8 border-b-2 border-gray-900">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Core Cleaning</h1>
          <p className="text-sm text-gray-500 mt-1">Commercial Cleaning Services</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">PROPOSAL</p>
          <p className="text-sm text-gray-500 mt-1">
            {data.generatedDate ? formatDate(data.generatedDate) : formatDate(new Date().toISOString())}
          </p>
          {data.validUntil && (
            <p className="text-xs text-gray-400 mt-0.5">Valid until {formatDate(data.validUntil)}</p>
          )}
        </div>
      </div>

      {/* To */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Prepared For</p>
        <p className="text-lg font-semibold text-gray-900">{data.businessName || lead.business_name}</p>
        {data.contactName && <p className="text-sm text-gray-600 mt-0.5">Attn: {data.contactName}</p>}
        {data.address && <p className="text-sm text-gray-500 mt-0.5">{data.address}</p>}
      </div>

      {/* Service summary */}
      <div className="bg-gray-50 rounded-xl p-6 mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Service Summary</p>
        <div className="grid grid-cols-3 gap-6">
          {data.serviceTypes && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Services</p>
              <p className="text-sm font-medium text-gray-900">{data.serviceTypes}</p>
            </div>
          )}
          {data.frequency && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Frequency</p>
              <p className="text-sm font-medium text-gray-900">{data.frequency}</p>
            </div>
          )}
          {data.ratePerVisit && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Rate per Visit</p>
              <p className="text-sm font-bold text-gray-900">
                {isNaN(Number(data.ratePerVisit))
                  ? data.ratePerVisit
                  : formatAUD(Number(data.ratePerVisit))}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Scope */}
      {data.scopeOfWork && (
        <Section title="Scope of Work">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.scopeOfWork}</p>
        </Section>
      )}

      {/* Inclusions / Exclusions */}
      {(data.inclusions || data.exclusions) && (
        <div className="grid grid-cols-2 gap-6 mb-8">
          {data.inclusions && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Inclusions</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.inclusions}</p>
            </div>
          )}
          {data.exclusions && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Exclusions</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.exclusions}</p>
            </div>
          )}
        </div>
      )}

      {/* Terms */}
      {data.termsAndConditions && (
        <Section title="Terms & Conditions">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{data.termsAndConditions}</p>
        </Section>
      )}

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400">
          Thank you for considering Core Cleaning. We look forward to working with you.
        </p>
        <p className="text-xs text-gray-300 mt-1">Core Cleaning · Brisbane, QLD</p>
      </div>
    </div>
  )
}

/* ─── Agreement Document ─────────────────────────────────────────────────── */

function AgreementDocument({ data, lead }: { data: any; lead: Lead }) {
  return (
    <div className="p-12">
      {/* Header */}
      <div className="flex items-start justify-between mb-10 pb-8 border-b-2 border-gray-900">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Core Cleaning</h1>
          <p className="text-sm text-gray-500 mt-1">Commercial Cleaning Services</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900">CLEANING AGREEMENT</p>
          <p className="text-sm text-gray-500 mt-1">
            {data.generatedDate ? formatDate(data.generatedDate) : formatDate(new Date().toISOString())}
          </p>
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Service Provider</p>
          <p className="text-sm font-semibold text-gray-900">Core Cleaning</p>
          <p className="text-sm text-gray-500">Brisbane, QLD</p>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Client</p>
          <p className="text-sm font-semibold text-gray-900">{data.businessName || lead.business_name}</p>
          {data.contactName && <p className="text-sm text-gray-600">{data.contactName}</p>}
          {data.address && <p className="text-sm text-gray-500">{data.address}</p>}
        </div>
      </div>

      {/* Service details */}
      <div className="bg-gray-50 rounded-xl p-6 mb-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Service Details</p>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3">
          {data.serviceTypes && <Field label="Services" value={data.serviceTypes} />}
          {data.frequency && <Field label="Frequency" value={data.frequency} />}
          {data.ratePerVisit && (
            <Field
              label="Rate per Visit"
              value={isNaN(Number(data.ratePerVisit)) ? data.ratePerVisit : formatAUD(Number(data.ratePerVisit))}
            />
          )}
          {data.commencementDate && <Field label="Commencement Date" value={formatDate(data.commencementDate)} />}
          {data.contractLength && <Field label="Contract Length" value={data.contractLength} />}
          {data.noticePeriod && <Field label="Notice Period" value={data.noticePeriod} />}
          {data.paymentTerms && <Field label="Payment Terms" value={data.paymentTerms} />}
        </div>
      </div>

      {/* Special instructions */}
      {data.specialInstructions && (
        <Section title="Special Instructions">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{data.specialInstructions}</p>
        </Section>
      )}

      {/* Termination */}
      {data.terminationClause && (
        <Section title="Termination">
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{data.terminationClause}</p>
        </Section>
      )}

      {/* Signatures */}
      <div className="mt-12 pt-8 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">Signatures</p>
        <div className="grid grid-cols-2 gap-12">
          {/* Provider sig */}
          <div>
            <div className="h-14 border-b border-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-900">Core Cleaning</p>
            <p className="text-xs text-gray-400">Authorised Representative</p>
            <p className="text-xs text-gray-400 mt-1">Date: _______________</p>
          </div>
          {/* Client sig */}
          <div>
            <div className="h-14 border-b border-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-900">{data.signatoryName || data.contactName || data.businessName}</p>
            {data.signatoryTitle && <p className="text-xs text-gray-400">{data.signatoryTitle}</p>}
            <p className="text-xs text-gray-400 mt-1">Date: _______________</p>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">{title}</p>
      {children}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  )
}
