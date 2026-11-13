import { CommercialHead } from '@/components/hub/CommercialHead'
import { ProspectList } from '@/components/hub/ProspectList'
import { requireStaff } from '@/lib/require-staff'
import { loadLeads } from '@/lib/hub/prospecting-data'
import { LEAD_CHIPS, type LeadF } from '@/lib/hub/prospecting'

export const dynamic = 'force-dynamic'

export default async function ProspectingPage({ searchParams }: { searchParams: { show?: string } }) {
  const denied = await requireStaff()
  const leads = denied ? null : await loadLeads()
  const f = LEAD_CHIPS.some(([id]) => id === searchParams.show) ? (searchParams.show as LeadF) : 'all'
  return (
    <>
      <CommercialHead tab="prospecting" />
      {leads
        ? <ProspectList leads={leads} initial={f} />
        : <p className="err" role="alert">{denied || 'The leads couldn’t load just now. Refresh the page to try again.'}</p>}
    </>
  )
}
