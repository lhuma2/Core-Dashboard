export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { NewProposalButton } from '@/components/documents/NewProposalButton'
import { DeleteDocButton } from '@/components/documents/DeleteDocButton'
import { UploadCompanyDocButton } from '@/components/documents/UploadCompanyDocButton'
import { DeleteCompanyDocButton } from '@/components/documents/DeleteCompanyDocButton'
import { FileText, FilePen, ChevronRight, FileDown } from 'lucide-react'

// The company's own reviewed/branded PDFs, bundled in /public/documents.
const COMPANY_DOCS = [
  { name: 'Capability Statement',          file: '/documents/capability-statement.pdf' },
  { name: 'Bond Cleaning Service Proposal', file: '/documents/bond-cleaning-service-proposal.pdf' },
  { name: 'Bond Cleaning Service Agreement', file: '/documents/bond-cleaning-service-agreement.pdf' },
  { name: 'Residential Service Agreement',  file: '/documents/residential-service-agreement.pdf' },
  { name: 'Subcontractor Agreement',        file: '/documents/subcontractor-agreement.pdf' },
]

const KIND_LABEL: Record<string, string> = {
  proposal: 'Proposal', agreement: 'Service Agreement', one_off: 'One-Off Agreement', capability: 'Capability Statement',
}
const STATUS_STYLE: Record<string, string> = {
  draft:             'bg-gray-100 text-gray-600 border-gray-200',
  sent:              'bg-blue-50 text-blue-700 border-blue-200',
  accepted:          'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined:          'bg-red-50 text-red-600 border-red-200',
  out_for_signature: 'bg-amber-50 text-amber-700 border-amber-200',
  signed:            'bg-[#00250e] text-white border-[#00250e]',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined',
  out_for_signature: 'Out for signature', signed: 'Signed',
}

export default async function DocumentsPage() {
  const db = createAdminClient() as any
  const { data: docs } = await db
    .from('proposal_documents')
    .select('id, kind, status, ref_number, client_name, updated_at')
    .order('updated_at', { ascending: false })

  const list: any[] = docs ?? []

  // All saved contract PDFs across clients (stored per client, surfaced here too).
  const { data: contractRows } = await db
    .from('compliance_documents')
    .select('id, name, file_url, client_id, created_at')
    .eq('type', 'contract')
    .order('created_at', { ascending: false })
  const contracts: any[] = contractRows ?? []
  const contractClientIds = Array.from(new Set(contracts.map((c) => c.client_id).filter(Boolean)))
  const { data: contractClients } = contractClientIds.length
    ? await db.from('clients').select('id, business_name, ref_number').in('id', contractClientIds)
    : { data: [] }
  const clientMap = new Map((contractClients ?? []).map((c: any) => [c.id, c]))

  // Admin-uploaded company documents
  const { data: uploadedRows } = await db
    .from('company_documents')
    .select('id, name, file_url, created_at')
    .order('created_at', { ascending: false })
  const uploadedDocs: any[] = uploadedRows ?? []

  // Options for the "New proposal" picker: bundled + uploaded company documents.
  const proposalDocOptions = [
    ...COMPANY_DOCS.map((d) => ({ name: d.name, url: d.file })),
    ...uploadedDocs.map((d) => ({ name: d.name, url: d.file_url })),
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-gray-900">Documents</h2>
          <p className="text-sm text-gray-400 mt-0.5">Proposals and service agreements · {list.length}</p>
        </div>
        <NewProposalButton docs={proposalDocOptions} />
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-16 text-center">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-500">No documents yet</p>
          <p className="text-xs text-gray-400 mt-1">Create your first proposal to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden divide-y divide-gray-100">
          {list.map((d) => {
            const Icon = d.kind === 'proposal' ? FileText : FilePen
            return (
              <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <Link href={`/documents/${d.id}`} className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="w-9 h-9 rounded-lg bg-[#00250e]/5 border border-[#00250e]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-[#00250e]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.client_name || 'Untitled'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{KIND_LABEL[d.kind] ?? d.kind} · {d.ref_number}</p>
                  </div>
                  <span className={`text-[11px] font-semibold border rounded-full px-2.5 py-0.5 ${STATUS_STYLE[d.status] ?? STATUS_STYLE.draft}`}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </Link>
                <DeleteDocButton id={d.id} />
              </div>
            )
          })}
        </div>
      )}

      <div className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">Company documents · {COMPANY_DOCS.length + uploadedDocs.length}</p>
          <UploadCompanyDocButton />
        </div>
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden divide-y divide-gray-100">
          {COMPANY_DOCS.map((d) => (
            <div key={d.file} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-[#00250e]/5 border border-[#00250e]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#00250e]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF · standard document</p>
              </div>
              <a href={d.file} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00250e] border border-[#00250e]/20 rounded-full px-4 py-1.5 hover:bg-[#00250e] hover:text-white transition-colors flex-shrink-0">
                <FileDown className="w-3.5 h-3.5" /> View
              </a>
            </div>
          ))}
          {uploadedDocs.map((d) => (
            <div key={d.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-[#00250e]/5 border border-[#00250e]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#00250e]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Uploaded document</p>
              </div>
              <a href={d.file_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#00250e] border border-[#00250e]/20 rounded-full px-4 py-1.5 hover:bg-[#00250e] hover:text-white transition-colors flex-shrink-0">
                <FileDown className="w-3.5 h-3.5" /> View
              </a>
              <DeleteCompanyDocButton id={d.id} />
            </div>
          ))}
        </div>
      </div>

      {contracts.length > 0 && (
        <div className="pt-2">
          <p className="text-sm text-gray-500 mb-3">Signed contracts on file · {contracts.length}</p>
          <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden divide-y divide-gray-100">
            {contracts.map((c) => {
              const client = clientMap.get(c.client_id) as any
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-[#00250e]/5 border border-[#00250e]/10 flex items-center justify-center flex-shrink-0">
                    <FilePen className="w-4 h-4 text-[#00250e]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{client?.business_name ?? 'Unknown client'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.name}{client?.ref_number ? ` · ${client.ref_number}` : ''}</p>
                  </div>
                  {c.file_url && (
                    <a href={`/api/file?url=${Buffer.from(c.file_url).toString('base64url')}`} target="_blank" rel="noreferrer"
                      className="text-[11px] font-semibold text-[#00250e] border border-[#00250e]/20 rounded-full px-4 py-1.5 hover:bg-[#00250e] hover:text-white transition-colors flex-shrink-0">
                      View
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
