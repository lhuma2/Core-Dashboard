import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateClientAction } from '@/actions/clients'
import { ClientForm } from '@/components/clients/ClientForm'
import { Card } from '@/components/ui/Card'
import { ArrowLeft } from 'lucide-react'

export default async function EditClientPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!client) notFound()

  const admin = createAdminClient()
  const { data: cleanerProfiles } = await (admin as any)
    .from('profiles')
    .select('id, full_name')
    .eq('role', 'cleaner')
    .order('full_name', { ascending: true })

  const cleaners = (cleanerProfiles ?? []).map((p: any) => ({
    id: p.id,
    fullName: p.full_name ?? 'Unknown',
  }))

  async function action(formData: FormData) {
    'use server'
    return updateClientAction(params.id, formData)
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href={`/clients/${params.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {client.business_name}
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Edit Client</h2>
        <p className="text-sm text-gray-500 mt-0.5">{client.ref_number}</p>
      </div>

      <Card>
        <ClientForm
          defaultValues={client}
          action={action}
          submitLabel="Save Changes"
          cleaners={cleaners}
        />
      </Card>
    </div>
  )
}
