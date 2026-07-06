import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SOPTable } from '@/components/sops/SOPTable'
import { SOPCategoryFilter } from '@/components/sops/SOPCategoryFilter'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Plus, FileText, FileDown } from 'lucide-react'

// Company SOP documents bundled as PDFs in /public/documents.
const COMPANY_SOPS = [
  { name: 'Bond Clean SOP', file: '/documents/bond-clean-sop.pdf' },
]

export default async function SOPsPage({
  searchParams,
}: {
  searchParams: { q?: string; category?: string; archived?: string }
}) {
  const supabase = createClient()

  const { data: allSOPs } = await supabase
    .from('sops')
    .select('*')
    .order('category')
    .order('title')

  let sops = allSOPs || []

  if (!searchParams.archived) {
    sops = sops.filter((s) => s.active)
  }

  if (searchParams.category) {
    sops = sops.filter((s) => s.category === searchParams.category)
  }

  if (searchParams.q) {
    const q = searchParams.q.toLowerCase()
    sops = sops.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q) ||
        s.content?.toLowerCase().includes(q)
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">SOP Library</h2>
          <p className="text-sm text-gray-500 mt-0.5">{sops.length} procedures</p>
        </div>
        <Link href="/sops/new">
          <Button>
            <Plus className="w-4 h-4" />
            New SOP
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SOPCategoryFilter />
        <Link
          href={searchParams.archived ? '/sops' : '/sops?archived=1'}
          className="text-xs text-gray-500 hover:text-brand-navy transition"
        >
          {searchParams.archived ? 'Hide archived' : 'Show archived'}
        </Link>
      </div>

      <Card padding={false}>
        <SOPTable sops={sops} />
      </Card>

      <div className="pt-1">
        <p className="text-sm text-gray-500 mb-3">Company SOPs · {COMPANY_SOPS.length}</p>
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_2px_rgba(16,24,40,0.05)] overflow-hidden divide-y divide-gray-100">
          {COMPANY_SOPS.map((d) => (
            <div key={d.file} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-[#003314]/5 border border-[#003314]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#003314]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF · standard procedure</p>
              </div>
              <a href={d.file} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#003314] border border-[#003314]/20 rounded-full px-4 py-1.5 hover:bg-[#003314] hover:text-white transition-colors flex-shrink-0">
                <FileDown className="w-3.5 h-3.5" /> View
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
