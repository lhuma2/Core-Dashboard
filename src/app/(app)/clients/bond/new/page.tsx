import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBondJobAction } from '@/actions/bondJobs'
import { BondJobForm } from '@/components/clients/BondJobForm'
import { Card } from '@/components/ui/Card'

export default async function NewBondJobPage() {
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
          href="/clients?tab=bond"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Bond Clients
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Add Bond Clean</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          One-off bond / end-of-lease clean. This will appear on the assigned cleaner&apos;s timetable.
        </p>
      </div>

      <Card>
        <BondJobForm action={createBondJobAction} cleaners={cleaners} />
      </Card>
    </div>
  )
}
