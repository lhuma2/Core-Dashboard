import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { AddCleanerForm } from '@/components/team/AddCleanerForm'
import { ArrowLeft } from 'lucide-react'

export default function NewCleanerPage() {
  return (
    <div className="max-w-md space-y-6">
      <div>
        <Link href="/team" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> Team
        </Link>
        <h1 className="font-display text-xl font-bold text-gray-900">Add Cleaner</h1>
        <p className="text-sm text-gray-500 mt-1">Add a new cleaner with their contact details and region.</p>
      </div>

      <Card>
        <AddCleanerForm />
      </Card>
    </div>
  )
}
