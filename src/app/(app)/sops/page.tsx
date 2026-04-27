import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SOPTable } from '@/components/sops/SOPTable'
import { SOPCategoryFilter } from '@/components/sops/SOPCategoryFilter'
import { SearchInput } from '@/components/ui/SearchInput'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Plus } from 'lucide-react'

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
    </div>
  )
}
