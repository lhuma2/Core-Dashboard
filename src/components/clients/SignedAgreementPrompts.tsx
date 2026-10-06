import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAgreementDefaults } from '@/lib/documents/agreement'
import { CLIENT_TYPE_LABELS, clientTypeOf } from '@/lib/documents/quote'
import { FileSignature, Sparkles, ChevronRight } from 'lucide-react'
import { CreateClientFromAgreementButton, DismissAgreementPromptButton } from './SignedAgreementPromptButtons'

// Clients tab: signed agreements that still need the owner. Commercial profiles
// created automatically on signing wait to be reviewed; residential and end-of-lease
// agreements wait to be added (prefilled) in their own tabs.
export async function SignedAgreementPrompts() {
  const db = createAdminClient() as any
  const [{ data: review }, { data: pending }] = await Promise.all([
    db.from('clients').select('id, business_name, created_at').eq('needs_review', true).order('created_at', { ascending: false }),
    db.from('proposal_documents')
      .select('id, data, signed_at, signed_name')
      .eq('kind', 'agreement').eq('status', 'signed').is('client_id', null).is('client_added_at', null)
      // Only agreements from the quote flow (older ones predate these prompts).
      .not('data->>clientType', 'is', null)
      .order('signed_at', { ascending: false }).limit(20),
  ])
  const reviewRows: any[] = review ?? []
  const pendingRows: any[] = pending ?? []
  if (!reviewRows.length && !pendingRows.length) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 divide-y divide-amber-100 overflow-hidden">
      <p className="px-4 py-2.5 text-xs font-semibold text-amber-800 flex items-center gap-1.5">
        <FileSignature className="w-3.5 h-3.5" /> New from signed agreements · {reviewRows.length + pendingRows.length}
      </p>
      {reviewRows.map((c) => (
        <Link key={c.id} href={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 bg-white/70 hover:bg-white transition-colors">
          <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{c.business_name}</p>
            <p className="text-xs text-gray-500">Commercial · profile created from their agreement. Review it, set their login and send the welcome page.</p>
          </div>
          <span className="text-xs font-semibold text-[#00250e] flex-shrink-0 inline-flex items-center">Review <ChevronRight className="w-3.5 h-3.5" /></span>
        </Link>
      ))}
      {pendingRows.map((d) => {
        const a = withAgreementDefaults(d.data)
        const type = clientTypeOf(d.data)
        const href = type === 'residential' ? `/clients/residential/new?from=${d.id}`
          : type === 'end_of_lease' ? `/clients/bond/new?from=${d.id}` : null
        return (
          <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white/70">
            <FileSignature className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{a.clientName}</p>
              <p className="text-xs text-gray-500">
                {CLIENT_TYPE_LABELS[type]} · signed by {d.signed_name}{a.commencementDate ? ` · starts ${a.commencementDate}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link href={`/documents/${d.id}`} className="text-xs font-medium text-gray-500 hover:text-gray-800">Agreement</Link>
              {href
                ? <Link href={href} className="text-xs font-semibold bg-[#003314] hover:bg-[#00250e] text-white rounded-lg px-3 py-1.5">Add client</Link>
                : <CreateClientFromAgreementButton docId={d.id} />}
              <DismissAgreementPromptButton docId={d.id} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
