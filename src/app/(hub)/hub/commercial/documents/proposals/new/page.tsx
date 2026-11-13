import { ProposalForm } from '@/components/hub/ProposalForm'
import { brisbaneToday } from '@/lib/hub/figures'
import { loadFillFrom, loadOpenQuoteReqs, loadPresets, peekQuoteRef } from '@/lib/hub/documents-data'
import { SPEC_METHODS, blankPf, tidy } from '@/lib/hub/proposals'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function NewProposalPage({ searchParams }: { searchParams: { type?: string; request?: string } }) {
  const today = brisbaneToday()
  const [presets, fill, requests, ref] = await Promise.all([loadPresets(), loadFillFrom(), loadOpenQuoteReqs(), peekQuoteRef(today.slice(0, 4))])
  const rq = searchParams.request ? requests.find(r => r.id === searchParams.request) : null
  const pf = blankPf(rq || searchParams.type === 'spec' ? 'spec' : 'comm', ref, today)
  if (rq) {
    // Start quote from a client's request (mock-up startQuote): the job, the site and the day they asked for
    const c = fill.clients.find(x => x.id === rq.clientId)
    const db = createClient() as any
    const { data: r } = await db.from('client_requests').select('service, details, want_date, site_id, client_sites(site_name, address, suburb, postcode)').eq('id', rq.id).maybeSingle()
    const site = r?.client_sites || null
    const svc = r?.service === 'Window cleaning' ? 'Internal & external windows' : String(r?.service || '')
    const known = !!SPEC_METHODS[svc]
    Object.assign(pf, {
      requestId: rq.id, clientId: rq.clientId, biz: c?.name || rq.client, contact: c?.contact || '', email: c?.email || '',
      address: site?.address ? [site.address, [site.suburb, site.postcode].filter(Boolean).join(' ')].filter(Boolean).join(', ') : c?.address || '',
      jobs: [{ kind: known ? svc : 'Custom', custom: known ? '' : (svc && svc !== 'Something else' ? svc : ''), area: tidy((site?.site_name ? site.site_name + ': ' : '') + (r?.details || '')).slice(0, 300), included: known ? SPEC_METHODS[svc].join('\n') : '', price: '' }],
      date2: r?.want_date && String(r.want_date).slice(0, 10) >= today ? String(r.want_date).slice(0, 10) : '',
    })
  }
  const fromReq = !!rq
  return (
    <ProposalForm initial={pf} presets={presets} leads={fill.leads} clients={fill.clients} requests={requests} today={today}
      backHref={fromReq ? '/hub/commercial/requests' : '/hub/commercial/documents'} backLabel={fromReq ? 'Requests' : 'Documents'}
      heading={pf.ptype === 'comm' ? 'New proposal' : 'New specialist proposal'} />
  )
}
