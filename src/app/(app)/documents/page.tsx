import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { DocumentTable } from '@/components/documents/DocumentTable'
import { NewDocumentDropdown } from '@/components/documents/NewDocumentDropdown'
import { Card } from '@/components/ui/Card'
import { Search } from 'lucide-react'

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string }
}) {
  const supabase = createClient()

  let query = supabase
    .from('documents')
    .select('*, clients(business_name)')
    .order('created_at', { ascending: false })

  if (searchParams.status) {
    query = query.eq('status', searchParams.status)
  }

  const { data: documents } = await query

  const docs = documents || []

  const filtered = searchParams.q
    ? docs.filter(
        (d) =>
          d.title?.toLowerCase().includes(searchParams.q!.toLowerCase()) ||
          d.ref_number?.toLowerCase().includes(searchParams.q!.toLowerCase()) ||
          (d.clients as { business_name: string } | null)?.business_name
            ?.toLowerCase()
            .includes(searchParams.q!.toLowerCase())
      )
    : docs

  const draftCount  = docs.filter((d) => d.status === 'draft').length
  const sentCount   = docs.filter((d) => d.status === 'sent').length
  const signedCount = docs.filter((d) => d.status === 'signed').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {docs.length} total · {signedCount} signed · {sentCount} awaiting signature · {draftCount} draft
        </p>
        <NewDocumentDropdown />
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          <Link href="/documents" className={`text-sm px-3 py-1.5 rounded-lg border transition ${!searchParams.status ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>All</Link>
          {['draft', 'sent', 'signed', 'expired'].map((s) => (
            <Link
              key={s}
              href={`/documents?status=${s}${searchParams.q ? `&q=${searchParams.q}` : ''}`}
              className={`text-sm px-3 py-1.5 rounded-lg border transition capitalize ${searchParams.status === s ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}
            >
              {s}
            </Link>
          ))}
        </div>
        <form method="GET" action="/documents" className="ml-auto">
          {searchParams.status && <input type="hidden" name="status" value={searchParams.status} />}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              name="q"
              defaultValue={searchParams.q || ''}
              placeholder="Search documents…"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300 w-52"
            />
          </div>
        </form>
      </div>

      <Card padding={false}>
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-gray-400">No documents found</p>
            {searchParams.q && (
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            )}
          </div>
        ) : (
          <DocumentTable documents={filtered as Parameters<typeof DocumentTable>[0]['documents']} />
        )}
      </Card>
    </div>
  )
}
