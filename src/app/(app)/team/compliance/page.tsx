import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { ComplianceUploadForm } from '@/components/team/ComplianceUploadForm'
import { DeleteComplianceDocButton } from '@/components/team/DeleteComplianceDocButton'
import { ArrowLeft, FileText } from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  sds:       'SDS',
  insurance: 'Insurance',
  contract:  'Client Contract',
  other:     'Other',
}

export default async function ComplianceAdminPage() {
  const supabase = createClient()

  const [{ data: docs }, { data: clients }] = await Promise.all([
    (supabase as any)
      .from('compliance_documents')
      .select('*, clients(business_name)')
      .order('type')
      .order('created_at', { ascending: false }),
    (supabase as any)
      .from('clients').select('id, business_name').eq('active', true).order('business_name'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/team" className="text-gray-500 hover:text-gray-800 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Compliance Documents</h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Upload Document</h2>
            <ComplianceUploadForm clients={clients ?? []} />
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card padding={false}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Documents · {(docs ?? []).length}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {(docs ?? []).length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">No documents uploaded.</p>
              )}
              {(docs ?? []).map((doc: any) => (
                <div key={doc.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <a href={`/api/file?url=${Buffer.from(doc.file_url).toString('base64url')}`} target="_blank" rel="noopener noreferrer"
                        className="text-sm font-medium text-gray-800 hover:text-blue-600 transition-colors truncate block">
                        {doc.name}
                      </a>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {TYPE_LABELS[doc.type] ?? doc.type}
                        {doc.clients?.business_name ? ` · ${doc.clients.business_name}` : ' · Global'}
                      </p>
                    </div>
                  </div>
                  <DeleteComplianceDocButton docId={doc.id} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
