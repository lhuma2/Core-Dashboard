import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { archiveSOPAction } from '@/actions/sops'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/formatters'
import { ArrowLeft, Edit, Archive } from 'lucide-react'

export default async function SOPViewPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: sop } = await supabase
    .from('sops')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!sop) notFound()

  async function archive() {
    'use server'
    await archiveSOPAction(params.id)
  }

  // Simple markdown-like rendering
  const renderContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('## ')) {
        return <h2 key={i} className="text-lg font-bold text-gray-900 mt-6 mb-2">{line.slice(3)}</h2>
      }
      if (line.startsWith('### ')) {
        return <h3 key={i} className="text-base font-semibold text-gray-800 mt-4 mb-1">{line.slice(4)}</h3>
      }
      if (line.startsWith('#### ')) {
        return <h4 key={i} className="text-sm font-semibold text-gray-700 mt-3 mb-1">{line.slice(5)}</h4>
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="text-sm text-gray-700 ml-4 list-disc">{line.slice(2)}</li>
      }
      if (line.trim() === '') {
        return <br key={i} />
      }
      return <p key={i} className="text-sm text-gray-700">{line}</p>
    })
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-start justify-between">
        <Link
          href="/sops"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          SOP Library
        </Link>
        <div className="flex gap-2">
          <Link href={`/sops/${params.id}/edit`}>
            <Button variant="secondary" size="sm">
              <Edit className="w-3.5 h-3.5" />
              Edit
            </Button>
          </Link>
          {sop.active && (
            <form action={archive}>
              <Button type="submit" variant="ghost" size="sm">
                <Archive className="w-3.5 h-3.5" />
                Archive
              </Button>
            </form>
          )}
        </div>
      </div>

      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{sop.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge>{sop.category}</Badge>
              <span className="font-mono text-xs text-gray-400">v{sop.version}</span>
              {!sop.active && <Badge variant="warning">Archived</Badge>}
            </div>
          </div>
          <p className="text-xs text-gray-400">Updated {formatDate(sop.updated_at)}</p>
        </div>

        <div className="prose-sm border-t border-gray-100 pt-4">
          {sop.content ? renderContent(sop.content) : (
            <p className="text-gray-400 italic">No content</p>
          )}
        </div>
      </Card>
    </div>
  )
}
