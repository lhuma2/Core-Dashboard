export const dynamic = 'force-dynamic'
export const revalidate = 0

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ClientShell } from '@/components/portal/ClientShell'
import { SWMS_LIST, POLICIES, MODERN_SLAVERY } from '@/lib/documents/safety'
import { FileText, Download, Shield, ClipboardCheck, Phone, Mail, User, Globe, HardHat, ChevronRight } from 'lucide-react'

// Delta's client-facing compliance library — the unsigned SWMS + policies, shown
// in every client portal (and auto-included for new clients) so clients can see
// our compliance. Rendered from code, always current; each links to the public
// /compliance/<slug> print view. Internal signed docs are never listed here.
const SAFETY_DOCS = [
  ...SWMS_LIST.map((s) => ({ slug: s.code.replace(/\s+/g, '-').toLowerCase(), title: s.title, sub: `Safe Work Method Statement · ${s.code}` })),
  ...POLICIES.map((p) => ({ slug: p.slug, title: p.title, sub: `Policy · ${p.code}` })),
  { slug: 'modern-slavery', title: MODERN_SLAVERY.title, sub: 'Policy statement' },
]

const TYPE_LABELS: Record<string, string> = {
  sds:       'Safety Data Sheet',
  insurance: 'Insurance Certificate',
  contract:  'Client Contract',
  other:     'Document',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  proposal:             'Proposal',
  cleaning_agreement:   'Cleaning Agreement',
  specialist_agreement: 'Specialist Agreement',
}

export default async function ClientCompliancePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!profile) redirect('/login')

  const clientId = profile.linked_client_id

  const { data: client } = clientId
    ? await (supabase as any).from('clients').select('*').eq('id', clientId).single()
    : { data: null }

  const abn = '83 303 026 478'
  const insurancePolicyNumber = 'SPD015763734'

  // The client's own signed agreements (from the in-app signing flow). These live
  // in proposal_documents, which the client can't read under RLS, so fetch via an
  // admin client scoped strictly to their own linked client id.
  const { data: signedContracts } = clientId
    ? await (createAdminClient() as any)
        .from('proposal_documents')
        .select('id, ref_number, kind, data, sign_code, signed_at')
        .eq('client_id', clientId)
        .eq('status', 'signed')
        .not('signed_at', 'is', null)
        .order('signed_at', { ascending: false })
    : { data: [] }

  // Fetch global + client-specific compliance docs
  const { data: docs } = await (supabase as any)
    .from('compliance_documents')
    .select('*')
    .or(clientId ? `client_id.is.null,client_id.eq.${clientId}` : 'client_id.is.null')
    .order('type')
    .order('created_at', { ascending: false })

  const allDocs: any[] = docs ?? []
  const contractDocs = allDocs.filter((d) => d.type === 'contract')
  const sdsDocs      = allDocs.filter((d) => d.type === 'sds')
  const insureDocs   = allDocs.filter((d) => d.type === 'insurance')
  const otherDocs    = allDocs.filter((d) => d.type === 'other')

  const sections = [
    { title: 'Your Contract',      docs: contractDocs },
    { title: 'Safety Data Sheets', docs: sdsDocs },
    { title: 'Insurance',          docs: insureDocs },
    { title: 'Other Documents',    docs: otherDocs },
  ].filter((s) => s.docs.length > 0)

  const hasAnything =
    SAFETY_DOCS.length > 0 || sections.length > 0 || (signedContracts && signedContracts.length > 0)

  return (
    <ClientShell
      clientName={client?.business_name}
      userName={profile.full_name}
      activePath="/client/compliance"
    >
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-6 h-6 text-black" />
          <h1 className="text-3xl font-bold text-black tracking-tight">Compliance & Documents</h1>
        </div>
        <p className="text-gray-500 text-sm">Your contracts, safety data sheets, and insurance certificates.</p>
      </div>

      {/* Cleaner assurance */}
      <section className="mb-8">
        <div className="bg-white rounded-2xl px-6 py-5 border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <p className="text-sm text-gray-700 leading-relaxed">
            All of our cleaners are fully checked, trained, and approved before working on any site.
          </p>
        </div>
      </section>

      {/* Safety & Method Statements — Delta's compliance library (client-facing) */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <HardHat className="w-4 h-4 text-gray-400" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Safety &amp; Method Statements</p>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Our current Safe Work Method Statements and policies — the same procedures our cleaners follow on your site. Tap any document to view it.
        </p>
        <div className="space-y-2">
          {SAFETY_DOCS.map((d) => (
            <a
              key={d.slug}
              href={`/compliance/${d.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-white rounded-2xl px-6 py-5 border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-gray-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-black truncate">{d.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{d.sub}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 ml-4" />
            </a>
          ))}
        </div>
      </section>

      {/* Signed Contracts (from document builder) */}
      {signedContracts && signedContracts.length > 0 && (
        <section className="mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Signed Agreements</p>
          <div className="space-y-2">
            {(signedContracts as any[]).map((doc: any) => (
              <div
                key={doc.id}
                className="flex items-center justify-between bg-white rounded-2xl px-6 py-5 border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)]"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                    <ClipboardCheck className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-black">
                      {doc.data?.documentTitle ?? DOC_TYPE_LABELS[doc.kind] ?? 'Service Agreement'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {doc.ref_number ? `${doc.ref_number} · ` : ''}Signed {new Date(doc.signed_at).toLocaleDateString('en-AU', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                {doc.sign_code && (
                  <a
                    href={`/sign/${doc.sign_code}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-black border border-black px-4 py-2 rounded-full hover:bg-black hover:text-white transition-all flex-shrink-0 ml-4"
                  >
                    View
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* No documents state */}
      {!hasAnything && (
        <div className="bg-white rounded-2xl p-10 border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] text-center mb-8">
          <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No documents uploaded yet.</p>
          <p className="text-gray-400 text-xs mt-1">Contact Delta Cleaning for support documents.</p>
        </div>
      )}

      {/* Document sections */}
      <div className="space-y-8 mb-10">
        {sections.map((section) => (
          <section key={section.title}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
              {section.title}
            </p>
            <div className="space-y-2">
              {section.docs.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between bg-white rounded-2xl px-6 py-5 border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-black">{doc.name}</p>
                      {doc.description ? (
                        <p className="text-xs text-gray-400 mt-0.5">{doc.description}</p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {TYPE_LABELS[doc.type] ?? doc.type} · Added {new Date(doc.created_at).toLocaleDateString('en-AU', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <a
                      href={`/api/file?url=${Buffer.from(doc.file_url).toString('base64url')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-black border border-black px-4 py-2 rounded-full hover:bg-black hover:text-white transition-all"
                    >
                      View
                    </a>
                    <a
                      href={`/api/file?url=${Buffer.from(doc.file_url).toString('base64url')}&dl=1`}
                      download
                      className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:border-gray-400 transition-colors"
                    >
                      <Download className="w-4 h-4 text-gray-400" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Key Contact + Business Information */}
      <div className="border-t border-gray-200 pt-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Contact & Business Details</p>
        <div className="bg-white rounded-2xl px-6 py-5 border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] space-y-4">
          {/* Contact */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-black">Jackson Jaillet</p>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a href="mailto:hello@deltacleaning.com.au" className="text-sm text-black hover:underline">
                hello@deltacleaning.com.au
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a href="tel:0412844238" className="text-sm text-black hover:underline">
                0412 844 238
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <a href="https://deltacleaning.com.au" className="text-sm text-black hover:underline">
                deltacleaning.com.au
              </a>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Business info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">ABN</p>
              <p className="text-sm font-semibold text-black">{abn}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Insurance Policy</p>
              <p className="text-sm font-semibold text-black">{insurancePolicyNumber}</p>
            </div>
          </div>
        </div>
      </div>
    </ClientShell>
  )
}
