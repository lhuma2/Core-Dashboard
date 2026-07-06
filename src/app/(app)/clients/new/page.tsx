import { createClientAction } from '@/actions/clients'
import { ClientForm } from '@/components/clients/ClientForm'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function NewClientPage() {
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

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Add New Client</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Create a new client record for Core Cleaning
        </p>
      </div>

      <Card>
        <ClientForm action={createClientAction} submitLabel="Create Client" cleaners={cleaners} />
      </Card>
    </div>
  )
}
