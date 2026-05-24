'use server'

import { createClient } from '@/lib/supabase/server'
import { getXeroInvoices, getXeroBills } from '@/lib/xero'

// ─── Sync ─────────────────────────────────────────────────────────────────────

export async function syncXeroTransactionsAction(): Promise<{ inserted: number; error?: string }> {
  const supabase = createClient()

  try {
    const [invoices, bills] = await Promise.all([
      getXeroInvoices('AUTHORISED,PAID'),
      getXeroBills(),
    ])

    const rows: Array<{
      xero_id: string
      type: string
      contact: string | null
      description: string | null
      amount: number
      currency: string
      date: string | null
      due_date: string | null
      xero_status: string
      category: string | null
    }> = []

    for (const inv of invoices) {
      rows.push({
        xero_id: inv.invoiceId,
        type: 'income',
        contact: inv.contact,
        description: inv.invoiceNumber || null,
        amount: inv.total,
        currency: 'AUD',
        date: inv.date,
        due_date: inv.dueDate,
        xero_status: inv.status,
        category: null,
      })
    }

    for (const bill of bills) {
      rows.push({
        xero_id: bill.invoiceId,
        type: 'expense',
        contact: bill.contact,
        description: bill.invoiceNumber || null,
        amount: bill.total,
        currency: 'AUD',
        date: bill.date,
        due_date: bill.dueDate,
        xero_status: bill.status,
        category: null,
      })
    }

    if (rows.length === 0) {
      return { inserted: 0 }
    }

    // Only insert NEW rows — never overwrite existing approvals
    const { data, error } = await (supabase as any)
      .from('xero_transactions')
      .upsert(rows, { onConflict: 'xero_id', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error('syncXeroTransactionsAction upsert error:', error)
      return { inserted: 0, error: error.message }
    }

    return { inserted: data?.length ?? 0 }
  } catch (err: any) {
    const message = err?.message ?? 'Unknown error'
    if (message.includes('no valid tokens')) {
      return { inserted: 0, error: 'xero_not_connected' }
    }
    console.error('syncXeroTransactionsAction error:', err)
    return { inserted: 0, error: message }
  }
}

// ─── Approve / Reject ─────────────────────────────────────────────────────────

export async function approveTransactionAction(id: string): Promise<{ error?: string }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('xero_transactions')
    .update({ approved: true, approved_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('approveTransactionAction error:', error)
    return { error: error.message }
  }

  return {}
}

export async function rejectTransactionAction(id: string): Promise<{ error?: string }> {
  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('xero_transactions')
    .update({ approved: false, approved_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('rejectTransactionAction error:', error)
    return { error: error.message }
  }

  return {}
}

export async function bulkApproveAction(ids: string[]): Promise<{ error?: string }> {
  if (!ids.length) return {}

  const supabase = createClient()

  const { error } = await (supabase as any)
    .from('xero_transactions')
    .update({ approved: true, approved_at: new Date().toISOString() })
    .in('id', ids)

  if (error) {
    console.error('bulkApproveAction error:', error)
    return { error: error.message }
  }

  return {}
}
