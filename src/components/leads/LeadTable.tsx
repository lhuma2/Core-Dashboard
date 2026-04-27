'use client'

import { useState } from 'react'
import { formatAUD } from '@/lib/formatters'
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, LEAD_STATUS_OPTIONS } from '@/lib/constants'
import { updateLeadStatusAction, deleteLeadAction } from '@/actions/leads'
import { Modal } from '@/components/ui/Modal'
import { LeadForm } from '@/components/leads/LeadForm'
import { updateLeadAction } from '@/actions/leads'
import type { Lead, LeadStatus } from '@/types/app'
import { Edit, Trash2, Phone, Mail } from 'lucide-react'

interface LeadTableProps {
  leads: Lead[]
  followupDays: number
  onRefresh?: () => void
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
}

export function LeadTable({ leads, followupDays, onRefresh }: LeadTableProps) {
  const [editLead, setEditLead] = useState<Lead | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const active = leads.filter((l) => l.status !== 'won' && l.status !== 'lost')
  const closed = leads.filter((l) => l.status === 'won' || l.status === 'lost')

  async function handleStatusChange(id: string, status: LeadStatus, timeline: any[] = []) {
    await updateLeadStatusAction(id, status, timeline)
    onRefresh?.()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    await deleteLeadAction(id)
    setDeletingId(null)
    onRefresh?.()
  }

  async function handleEdit(formData: FormData) {
    if (!editLead) return
    const updates: Record<string, any> = {}
    formData.forEach((v, k) => { updates[k] = v || null })
    await updateLeadAction(editLead.id, updates)
    setEditLead(null)
    onRefresh?.()
  }

  function LeadRow({ lead }: { lead: Lead }) {
    const days = daysSince(lead.last_contact_date)
    const isOverdue = days != null && days > followupDays && lead.status !== 'won' && lead.status !== 'lost'
    const statusColor = LEAD_STATUS_COLORS[lead.status]

    return (
      <tr className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${isOverdue ? 'bg-red-50/20' : ''}`}>
        <td className="px-4 py-3">
          <p className="text-sm font-medium text-gray-900">{lead.business_name}</p>
          {lead.contact_name && <p className="text-xs text-gray-400 mt-0.5">{lead.contact_name}</p>}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col gap-0.5">
            {lead.contact_email && (
              <a href={`mailto:${lead.contact_email}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-navy transition-colors">
                <Mail className="w-3 h-3 flex-shrink-0" />{lead.contact_email}
              </a>
            )}
            {lead.contact_phone && (
              <a href={`tel:${lead.contact_phone}`} className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-navy transition-colors">
                <Phone className="w-3 h-3 flex-shrink-0" />{lead.contact_phone}
              </a>
            )}
            {!lead.contact_email && !lead.contact_phone && (
              <span className="text-xs text-gray-300">—</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus, (lead as any).timeline || [])}
            className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer focus:ring-2 focus:ring-offset-0 focus:ring-brand-navy/20 ${statusColor}`}
          >
            {LEAD_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-sm text-right tabular-nums">
          {lead.quote_value ? formatAUD(lead.quote_value) : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3">
          {days != null ? (
            <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
              {days}d ago{isOverdue ? ' ⚠' : ''}
            </span>
          ) : (
            <span className="text-xs text-gray-300">Never</span>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 justify-end">
            <button
              onClick={() => setEditLead(lead)}
              className="p-1.5 rounded-md text-gray-300 hover:text-brand-navy hover:bg-brand-navy/5 transition-colors"
              title="Edit"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDelete(lead.id)}
              disabled={deletingId === lead.id}
              className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Business</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Quote</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Last Contact</th>
              <th className="px-4 py-3 w-16" />
            </tr>
          </thead>
          <tbody>
            {active.length === 0 && closed.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                  No leads yet — add one above to start tracking your pipeline.
                </td>
              </tr>
            )}
            {active.map((lead) => <LeadRow key={lead.id} lead={lead} />)}
            {closed.length > 0 && (
              <>
                <tr>
                  <td colSpan={6} className="px-4 py-2 bg-gray-50/80">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Closed</p>
                  </td>
                </tr>
                {closed.map((lead) => <LeadRow key={lead.id} lead={lead} />)}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      <Modal
        open={!!editLead}
        onOpenChange={(o) => { if (!o) setEditLead(null) }}
        title={`Edit — ${editLead?.business_name}`}
      >
        {editLead && (
          <LeadForm
            defaultValues={editLead}
            onSubmit={handleEdit}
            onCancel={() => setEditLead(null)}
            submitLabel="Update Lead"
          />
        )}
      </Modal>
    </>
  )
}
