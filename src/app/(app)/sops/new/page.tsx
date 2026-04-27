import { createSOPAction } from '@/actions/sops'
import { SOPForm } from '@/components/sops/SOPForm'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function NewSOPPage() {
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          href="/sops"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          SOP Library
        </Link>
        <h2 className="text-xl font-bold text-gray-900">New SOP</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Create a new standard operating procedure
        </p>
      </div>
      <Card>
        <SOPForm action={createSOPAction} submitLabel="Create SOP" />
      </Card>
    </div>
  )
}
