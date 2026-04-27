import type { HealthStatus, ClientHealth, DashboardAlert } from '@/types/app'
import type { AppSettings } from '@/types/app'

interface ClientRow {
  id: string
  business_name: string
  active: boolean
  margin_pct: number | null
  profile_complete: boolean
  contract_expiry_date: string | null
}

interface SurveyAvg {
  clientId: string
  avg: number | null
}

/**
 * Compute health status for a single client.
 */
export function computeClientHealth(
  client: ClientRow,
  latestSurveyAvg: number | null,
  thresholds: { red: number; yellow: number }
): ClientHealth {
  const reasons: string[] = []

  if (!client.profile_complete) {
    return { status: 'incomplete', reasons: ['Cost data missing — profit cannot be calculated'] }
  }

  const m = client.margin_pct
  let status: HealthStatus = 'healthy'

  if (m != null && m < thresholds.red) {
    status = 'at_risk'
    reasons.push(`Margin ${m.toFixed(0)}% is critically low (< ${thresholds.red}%)`)
  } else if (m != null && m < thresholds.yellow) {
    if (status === 'healthy') status = 'watch'
    reasons.push(`Margin ${m.toFixed(0)}% is below target (< ${thresholds.yellow}%)`)
  }

  if (latestSurveyAvg != null && latestSurveyAvg < 6) {
    status = 'at_risk'
    reasons.push(`Survey average ${latestSurveyAvg.toFixed(1)}/10 is very low`)
  } else if (latestSurveyAvg != null && latestSurveyAvg < 7.5) {
    if (status === 'healthy') status = 'watch'
    reasons.push(`Survey average ${latestSurveyAvg.toFixed(1)}/10 needs attention`)
  }

  if (client.contract_expiry_date) {
    const daysToExpiry = Math.ceil(
      (new Date(client.contract_expiry_date).getTime() - Date.now()) / 86_400_000
    )
    if (daysToExpiry <= 14) {
      status = 'at_risk'
      reasons.push(`Contract expires in ${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'}`)
    } else if (daysToExpiry <= 60) {
      if (status === 'healthy') status = 'watch'
      reasons.push(`Contract renewal due in ${daysToExpiry} days`)
    }
  }

  return { status, reasons }
}

// ─── Dashboard alerts builder ─────────────────────────────────────────────────

interface AlertInput {
  clients: Array<{
    id: string
    business_name: string
    active: boolean
    margin_pct: number | null
    profile_complete: boolean
    contract_expiry_date: string | null
  }>
  surveyAvgs: Record<string, number | null>  // clientId → avg
  lastSurveyDates: Record<string, string | null> // clientId → ISO date
  unsignedDocs: Array<{ id: string; title: string | null; sent_at: string | null; clients: { business_name: string } | null }>
  leads: Array<{ id: string; business_name: string; last_contact_date: string | null }>
  settings: AppSettings
}

export function buildDashboardAlerts(input: AlertInput): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const { clients, surveyAvgs, lastSurveyDates, unsignedDocs, leads, settings } = input
  const { red, yellow } = settings.margin_thresholds

  const activeClients = clients.filter((c) => c.active)

  // 1. Low margin (critical)
  for (const c of activeClients) {
    if (!c.profile_complete) continue
    if (c.margin_pct != null && c.margin_pct < red) {
      alerts.push({
        id:           `low_margin_${c.id}`,
        type:         'low_margin',
        severity:     'critical',
        message:      `${c.business_name} — margin ${c.margin_pct.toFixed(0)}%`,
        subtext:      `Below critical threshold of ${red}%`,
        href:         `/clients/${c.id}`,
        resolveHint:  'Review cleaner costs or rate per visit',
      })
    }
  }

  // 2. Contract expiring (critical ≤14d, warning ≤60d)
  for (const c of activeClients) {
    if (!c.contract_expiry_date) continue
    const days = Math.ceil((new Date(c.contract_expiry_date).getTime() - Date.now()) / 86_400_000)
    if (days < 0) continue // already expired
    if (days <= 14) {
      alerts.push({
        id:          `contract_expiry_${c.id}`,
        type:        'contract_expiry',
        severity:    'critical',
        message:     `${c.business_name} — contract expires in ${days}d`,
        subtext:     new Date(c.contract_expiry_date).toLocaleDateString('en-AU'),
        href:        `/clients/${c.id}`,
        resolveHint: 'Contact client to renew contract',
      })
    } else if (days <= settings.contract_renewal_days) {
      alerts.push({
        id:          `contract_renewal_${c.id}`,
        type:        'contract_renewal',
        severity:    'warning',
        message:     `${c.business_name} — renewal in ${days} days`,
        subtext:     `Contract expires ${new Date(c.contract_expiry_date).toLocaleDateString('en-AU')}`,
        href:        `/clients/${c.id}`,
        resolveHint: 'Prepare renewal agreement',
      })
    }
  }

  // 3. Proposals awaiting response (sent > 7 days)
  const staleCutoff = new Date(Date.now() - 7 * 86_400_000)
  for (const doc of unsignedDocs) {
    if (!doc.sent_at) continue
    if (new Date(doc.sent_at) < staleCutoff) {
      const days = Math.ceil((Date.now() - new Date(doc.sent_at).getTime()) / 86_400_000)
      alerts.push({
        id:          `proposal_stale_${doc.id}`,
        type:        'proposal_stale',
        severity:    'warning',
        message:     `${doc.clients?.business_name ?? 'Unknown'} — proposal not signed`,
        subtext:     `Sent ${days} days ago`,
        href:        `/documents/${doc.id}`,
        resolveHint: 'Follow up with client',
      })
    }
  }

  // 4. Surveys overdue
  const surveyDueCutoff = new Date(Date.now() - settings.survey_frequency_days * 86_400_000)
  for (const c of activeClients) {
    const lastDate = lastSurveyDates[c.id]
    const isDue = !lastDate || new Date(lastDate) < surveyDueCutoff
    if (isDue) {
      const daysSince = lastDate
        ? Math.ceil((Date.now() - new Date(lastDate).getTime()) / 86_400_000)
        : null
      alerts.push({
        id:          `survey_overdue_${c.id}`,
        type:        'survey_overdue',
        severity:    'warning',
        message:     `${c.business_name} — survey overdue`,
        subtext:     daysSince ? `Last surveyed ${daysSince} days ago` : 'Never surveyed',
        href:        `/clients/${c.id}`,
        resolveHint: 'Send survey email',
      })
    }
  }

  // 5. Incomplete profiles
  for (const c of activeClients) {
    if (!c.profile_complete) {
      alerts.push({
        id:          `profile_incomplete_${c.id}`,
        type:        'profile_incomplete',
        severity:    'warning',
        message:     `${c.business_name} — profit data missing`,
        subtext:     'Add cleaner hourly rate and hours per visit',
        href:        `/clients/${c.id}/edit`,
        resolveHint: 'Complete client profile',
      })
    }
  }

  // 6. Lead follow-up overdue
  const leadCutoff = new Date(Date.now() - settings.lead_followup_days * 86_400_000)
  for (const lead of leads) {
    if (lead.last_contact_date && new Date(lead.last_contact_date) < leadCutoff) {
      const days = Math.ceil((Date.now() - new Date(lead.last_contact_date).getTime()) / 86_400_000)
      alerts.push({
        id:          `lead_followup_${lead.id}`,
        type:        'lead_followup',
        severity:    'info',
        message:     `${lead.business_name} — follow up overdue`,
        subtext:     `No contact for ${days} days`,
        href:        `/leads`,
        resolveHint: 'Update lead status',
      })
    }
  }

  // Sort: critical first, then warning, then info
  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  return alerts.sort((a, b) => order[a.severity] - order[b.severity])
}
