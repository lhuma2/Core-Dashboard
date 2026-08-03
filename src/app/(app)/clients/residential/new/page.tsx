import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createResidentialJobAction } from '@/actions/residentialJobs'
import { ResidentialJobForm } from '@/components/clients/ResidentialJobForm'
import { Card } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function NewResidentialJobPage() {
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
          href="/clients?tab=residential"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Residential Clients
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Add Residential Clean</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          A standalone home clean. This will appear on the assigned cleaner&apos;s timetable.
        </p>
      </div>

      <Card>
        <ResidentialJobForm action={createResidentialJobAction} cleaners={cleaners} />
      </Card>
    </div>
  )
}
