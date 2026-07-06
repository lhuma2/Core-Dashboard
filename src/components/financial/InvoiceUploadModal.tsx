'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, X, Check, AlertCircle, Loader2, ChevronDown, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { saveInvoiceAction, type ConfirmedLine, type SaveInvoiceInput } from '@/actions/invoices'
import { formatAUD } from '@/lib/formatters'
import type { Client } from '@/types/app'

interface ParsedLine {
  line_number: number
  description: string | null
  client_name_raw: string | null
  hours: number | null
  rate_per_hour: number | null
  cost_ex_gst: number | null
  gst: number | null
  cost_incl_gst: number | null
}

interface ParsedInvoice {
  invoice_number: string | null
  invoice_date: string | null
  billing_month: string | null
  lines: ParsedLine[]
  total_ex_gst: number | null
  total_gst: number | null
  total_incl_gst: number | null
  raw_text_preview: string
  extraction_method: 'ai' | 'regex'
}

type Step = 'upload' | 'review' | 'confirm'

const inputCls = 'w-full bg-white border border-gray-200 text-gray-900 placeholder-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00250e]/20 focus:border-[#00250e]/50'
const labelCls = 'text-xs font-medium text-gray-500 block mb-1.5'

export function InvoiceUploadModal({
  open,
  onOpenChange,
  clients,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  clients: Client[]
  onSuccess: () => void
}) {
  const [step,          setStep]          = useState<Step>('upload')
  const [uploading,     setUploading]     = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [parsed,        setParsed]        = useState<ParsedInvoice | null>(null)
  const [fileName,      setFileName]      = useState<string>('')
  const [dragOver,      setDragOver]      = useState(false)
  const [billingMonth,  setBillingMonth]  = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoiceDate,   setInvoiceDate]   = useState('')
  const [lineMatches,   setLineMatches]   = useState<Record<number, string | null>>({}) // line_number → client_id
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setStep('upload'); setParsed(null); setError(null); setFileName('')
    setBillingMonth(''); setInvoiceNumber(''); setInvoiceDate(''); setLineMatches({})
    setDragOver(false)
  }

  function handleClose() {
    reset()
    onOpenChange(false)
  }

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('File must be a PDF')
      return
    }
    setFileName(file.name)
    setUploading(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload-invoice', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      const inv = data as ParsedInvoice
      setParsed(inv)
      setInvoiceNumber(inv.invoice_number ?? '')
      setInvoiceDate(inv.invoice_date ?? '')
      setBillingMonth(inv.billing_month ?? '')

      // Auto-match lines to clients — fuzzy: exact first, then "starts with" / "contains"
      const matches: Record<number, string | null> = {}
      for (const line of inv.lines) {
        if (!line.client_name_raw) { matches[line.line_number] = null; continue }
        const raw = line.client_name_raw.toLowerCase().trim()

        // 1. Exact match
        let found = clients.find(c => c.business_name.toLowerCase().trim() === raw)

        // 2. Invoice name starts with client name (e.g. "Seam Spatial Banyo" → "Seam Spatial")
        if (!found) found = clients.find(c => raw.startsWith(c.business_name.toLowerCase().trim()))

        // 3. Client name starts with invoice name
        if (!found) found = clients.find(c => c.business_name.toLowerCase().trim().startsWith(raw))

        // 4. Invoice name contains client name (e.g. "ABC - Seam Spatial" → "Seam Spatial")
        if (!found) found = clients.find(c => raw.includes(c.business_name.toLowerCase().trim()))

        // 5. Client name contains invoice name
        if (!found) found = clients.find(c => c.business_name.toLowerCase().trim().includes(raw))

        // 6. Word overlap — score by shared words, pick best if >50% overlap
        if (!found) {
          const rawWords = raw.split(/\s+/).filter(w => w.length > 2)
          let bestScore = 0
          let bestClient = null
          for (const c of clients) {
            const cWords = c.business_name.toLowerCase().trim().split(/\s+/).filter((w: string) => w.length > 2)
            const shared = rawWords.filter(w => cWords.includes(w)).length
            const score = shared / Math.max(rawWords.length, cWords.length)
            if (score > bestScore && score >= 0.5) { bestScore = score; bestClient = c }
          }
          found = bestClient ?? undefined
        }

        matches[line.line_number] = found?.id ?? null
      }
      setLineMatches(matches)
      setStep('review')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  async function handleSave() {
    if (!parsed) return
    if (!billingMonth) { setError('Please set a billing month'); return }

    setSaving(true)
    setError(null)

    const lines: ConfirmedLine[] = parsed.lines.map(l => {
      const clientId = lineMatches[l.line_number] ?? null
      return {
        line_number:     l.line_number,
        description:     l.description,
        client_name_raw: l.client_name_raw,
        client_id:       clientId,
        hours:           l.hours,
        rate_per_hour:   l.rate_per_hour,
        cost_ex_gst:     l.cost_ex_gst,
        gst:             l.gst,
        cost_incl_gst:   l.cost_incl_gst,
        match_status:    clientId
          ? (lineMatches[l.line_number] !== null ? 'matched' : 'unmatched')
          : 'unmatched',
      }
    })

    const input: SaveInvoiceInput = {
      invoice_number:  invoiceNumber || null,
      invoice_date:    invoiceDate || null,
      billing_month:   billingMonth,
      lines,
      total_ex_gst:    parsed.total_ex_gst,
      total_gst:       parsed.total_gst,
      total_incl_gst:  parsed.total_incl_gst,
    }

    const result = await saveInvoiceAction(input) as any
    setSaving(false)
    if (result?.error) { setError(result.error); return }
    handleClose()
    onSuccess()
  }

  const unmatchedCount = parsed
    ? parsed.lines.filter(l => !lineMatches[l.line_number]).length
    : 0

  return (
    <Modal open={open} onOpenChange={handleClose} title="Upload Cleaner Invoice" className="max-w-2xl">

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-6">
        {(['upload', 'review', 'confirm'] as Step[]).map((s, i) => {
          const done    = step === 'review' && s === 'upload'
            || step === 'confirm' && (s === 'upload' || s === 'review')
          const active  = step === s
          const labels  = ['Upload', 'Match Clients', 'Save']
          return (
            <div key={s} className="flex items-center gap-1">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? 'text-[#00250e]' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${active ? 'border-[#00250e] text-[#00250e]' : done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-gray-400'}`}>
                  {done ? <Check className="w-3 h-3" /> : i + 1}
                </div>
                {labels[i]}
              </div>
              {i < 2 && <ArrowRight className="w-3 h-3 text-gray-300 mx-1" />}
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* ── STEP 1: Upload ────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div>
          <label
            htmlFor="invoice-file"
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              uploading
                ? 'border-[#00250e]/30 bg-[#00250e]/5'
                : dragOver
                ? 'border-[#00250e] bg-[#00250e]/5'
                : 'border-gray-200 hover:border-[#00250e]/40 hover:bg-gray-50'
            }`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#00250e] animate-spin" />
                <p className="text-sm text-gray-500">Parsing invoice…</p>
              </div>
            ) : dragOver ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#00250e]/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-[#00250e]" />
                </div>
                <p className="text-sm font-medium text-[#00250e]">Drop your PDF here</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-gray-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Click to upload or drag &amp; drop</p>
                  <p className="text-xs text-gray-400 mt-1">PDF invoice from your cleaner</p>
                </div>
              </div>
            )}
          </label>
          <input
            ref={fileRef}
            id="invoice-file"
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <p className="text-xs text-gray-400 mt-3 text-center">
            The system will extract line items and auto-match them to your clients
          </p>
        </div>
      )}

      {/* ── STEP 2: Review + match ────────────────────────────────────────── */}
      {step === 'review' && parsed && (
        <div className="space-y-5">
          {/* Invoice metadata */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Invoice Details</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Invoice #</label>
                <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} className={inputCls} placeholder="INV-001" />
              </div>
              <div>
                <label className={labelCls}>Invoice Date</label>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Billing Month *</label>
                <input type="month" value={billingMonth} onChange={e => setBillingMonth(e.target.value)} className={inputCls} />
              </div>
            </div>
            {parsed.extraction_method === 'regex' && (
              <p className="text-xs text-amber-600">⚠ Extracted via pattern matching — please verify the line items below</p>
            )}
          </div>

          {/* Line items + client matching */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Invoice Lines ({parsed.lines.length})
              </p>
              {unmatchedCount > 0 && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">{unmatchedCount} unmatched</span>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {parsed.lines.length === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-gray-500">No line items could be extracted automatically.</p>
                  <p className="text-xs text-gray-400 mt-1">You may need to enter them manually after saving.</p>
                </div>
              )}
              {parsed.lines.map(line => {
                const matched = lineMatches[line.line_number]
                const client  = clients.find(c => c.id === matched)
                return (
                  <div
                    key={line.line_number}
                    className={`rounded-lg border p-3 transition-colors ${
                      matched
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {line.client_name_raw || `Line ${line.line_number}`}
                        </p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                          {line.hours     && <span>{line.hours}h</span>}
                          {line.rate_per_hour && <span>@ {formatAUD(line.rate_per_hour)}/hr</span>}
                          {line.cost_ex_gst && <span className="font-semibold text-gray-700">{formatAUD(line.cost_ex_gst)}</span>}
                        </div>
                      </div>

                      {/* Client match selector */}
                      <div className="flex-shrink-0 w-48">
                        <div className="relative">
                          <select
                            value={matched ?? ''}
                            onChange={e => setLineMatches(prev => ({
                              ...prev,
                              [line.line_number]: e.target.value || null,
                            }))}
                            className={`w-full text-xs rounded-lg border px-2 py-1.5 pr-6 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#00250e]/20 ${
                              matched
                                ? 'bg-white border-emerald-300 text-emerald-800 font-medium'
                                : 'bg-white border-gray-300 text-gray-500'
                            }`}
                          >
                            <option value="">— Unmatched —</option>
                            {clients.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.business_name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${matched ? 'text-emerald-500' : 'text-gray-400'}`} />
                        </div>
                      </div>
                    </div>
                    {/* Match confirmation label */}
                    {matched && client && (
                      <div className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                        <Check className="w-3 h-3" />
                        Matched to {client.business_name}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Totals */}
          {parsed.total_ex_gst && (
            <div className="bg-gray-900 rounded-xl p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300 font-medium">Invoice Total</span>
                <span className="text-white font-bold tabular-nums text-base">
                  {formatAUD(parsed.total_ex_gst)}
                </span>
              </div>
            </div>
          )}

          {unmatchedCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
              {unmatchedCount} line{unmatchedCount > 1 ? 's' : ''} are unmatched — P&amp;L won't be calculated for them. You can match them above or proceed and fix later.
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => { setStep('upload'); setParsed(null) }}>Back</Button>
            <Button onClick={handleSave} disabled={saving || !billingMonth}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save Invoice & Calculate P&L'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
