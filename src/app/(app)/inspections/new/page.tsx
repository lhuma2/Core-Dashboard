import { createAdminClient } from '@/lib/supabase/admin'
import { InspectionForm } from '@/components/inspections/InspectionForm'

export const dynamic = 'force-dynamic'

export default async function NewInspectionPage() {
  const db = createAdminClient() as any
  const [{ data: clients }, { data: sites }] = await Promise.all([
    db.from('clients').select('id, business_name, is_multi_site, address, suburb').eq('active', true).order('business_name'),
    db.from('client_sites').select('id, client_id, site_name, suburb').order('sort_order', { ascending: true }).order('site_name'),
  ])

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">Walk the site and score each item. Your running score updates as you go.</p>
      <InspectionForm clients={clients ?? []} sites={sites ?? []} />
    </div>
  )
}
