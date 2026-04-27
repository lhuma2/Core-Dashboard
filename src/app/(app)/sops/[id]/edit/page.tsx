import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { updateSOPAction } from '@/actions/sops'
import { SOPForm } from '@/components/sops/SOPForm'
import { Card } from '@/components/ui/Card'
import { ArrowLeft } from 'lucide-react'

export default async function EditSOPPage({
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

  async function action(formData: FormData) {
    'use server'
    return updateSOPAction(params.id, formData)
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link
          href={`/sops/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to SOP
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Edit SOP</h2>
        <p className="text-sm text-gray-400">
          Version {sop.version ?? 1} → {(sop.version ?? 1) + 1} on save
        </p>
      </div>
      <Card>
        <SOPForm defaultValues={sop} action={action} submitLabel="Save Changes" />
      </Card>
    </div>
  )
}
