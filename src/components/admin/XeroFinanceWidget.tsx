'use client'

import { useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PLPeriod {
  label: string
  fromDate: string
  toDate: string
  revenue: number
  expenses: number
  netProfit: number
}

interface XeroTransaction {
  id: string
  type: 'INCOME' | 'EXPENSE'
  contact: string
  description: string
  amount: number
  date: string | null
  status: string
  invoiceNumber: string
}

interface BankAccount {
  accountId: string
  name: string
  balance: number
  currencyCode: string
}

type Tab      = 'review' | 'pl' | 'cash'
type TxState  = 'approved' | 'ignored' | 'pending'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n)

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'

// ─── Main widget ──────────────────────────────────────────────────────────────

export function XeroFinanceWidget() {
  const [connected, setConnected]         = useState<boolean | null>(null)
  const [tenantName, setTenantName]       = useState<string | null>(null)
  const [tab, setTab]                     = useState<Tab>('review')
  const [transactions, setTransactions]   = useState<XeroTransaction[]>([])
  const [plData, setPlData]               = useState<PLPeriod[]>([])
  const [bankData, setBankData]           = useState<BankAccount[]>([])
  const [txStates, setTxStates]           = useState<Record<string, TxState>>({})
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [loadingPL, setLoadingPL]         = useState(false)
  const [loadingCash, setLoadingCash]     = useState(false)

  // Restore approval state from localStorage for instant UI
  useEffect(() => {
    try {
      const saved = localStorage.getItem('xero_tx_states')
      if (saved) setTxStates(JSON.parse(saved))
    } catch {}
  }, [])

  const saveTxState = useCallback((id: string, state: TxState) => {
    setTxStates(prev => {
      const next = { ...prev, [id]: state }
      try { localStorage.setItem('xero_tx_states', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Initial load — also checks connection
  useEffect(() => {
    fetch('/api/xero/data?type=transactions')
      .then(r => {
        if (r.status === 401) { setConnected(false); return null }
        setConnected(true)
        return r.json()
      })
      .then(data => {
        if (!data) return
        setTransactions(Array.isArray(data) ? data : [])
      })
      .catch(() => setConnected(false))
  }, [])

  // Load P&L on tab switch
  useEffect(() => {
    if (tab !== 'pl' || plData.length > 0) return
    setLoadingPL(true)
    fetch('/api/xero/data?type=pl')
      .then(r => r.json())
      .then(data => { setPlData(Array.isArray(data) ? data : []); setLoadingPL(false) })
      .catch(() => setLoadingPL(false))
  }, [tab, plData.length])

  // Load cash on tab switch
  useEffect(() => {
    if (tab !== 'cash' || bankData.length > 0) return
    setLoadingCash(true)
    fetch('/api/xero/data?type=summary')
      .then(r => r.json())
      .then(data => { setBankData(Array.isArray(data) ? data : []); setLoadingCash(false) })
      .catch(() => setLoadingCash(false))
  }, [tab, bankData.length])

  // Approve or ignore a transaction
  async function handleAction(tx: XeroTransaction, action: 'approve' | 'ignore') {
    setPendingAction(tx.id)
    try {
      await fetch('/api/xero/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xeroId: tx.id,
          type: tx.type,
          contact: tx.contact,
          description: tx.description,
          amount: tx.amount,
          date: tx.date,
          action,
        }),
      })
      saveTxState(tx.id, action === 'approve' ? 'approved' : 'ignored')
      setPlData([]) // invalidate P&L cache
    } finally {
      setPendingAction(null)
    }
  }

  async function handleUndo(xeroId: string) {
    setPendingAction(xeroId)
    try {
      await fetch(`/api/xero/approve?xeroId=${xeroId}`, { method: 'DELETE' })
      saveTxState(xeroId, 'pending')
      setPlData([])
    } finally {
      setPendingAction(null)
    }
  }

  // ── Not yet checked ──────────────────────────────────────────────────────
  if (connected === null) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    )
  }

  // ── Not connected ────────────────────────────────────────────────────────
  if (connected === false) {
    return (
      <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center">
        <p className="text-sm font-medium text-gray-700 mb-1">Connect Xero to track your P&amp;L</p>
        <p className="text-xs text-gray-400 mb-5">
          Import invoices &amp; bills, approve what belongs to Core Cleaning, and see your real profit &amp; loss.
        </p>
        <a
          href="/api/xero/connect"
          className="inline-flex items-center gap-2 bg-[#1e3a5f] hover:bg-[#162d4a] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition"
        >
          <XeroLogo />
          Connect Xero
        </a>
      </div>
    )
  }

  // ── Connected ────────────────────────────────────────────────────────────
  const pendingTx  = transactions.filter(t => !txStates[t.id] || txStates[t.id] === 'pending')
  const approvedTx = transactions.filter(t => txStates[t.id] === 'approved')
  const ignoredTx  = transactions.filter(t => txStates[t.id] === 'ignored')

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <XeroLogo />
          <span className="text-xs text-gray-500">{tenantName ?? 'Xero connected'}</span>
          <span className="text-[10px] bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full font-medium">Live</span>
        </div>
        <div className="flex items-center gap-3">
          {pendingTx.length > 0 && (
            <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full font-medium">
              {pendingTx.length} awaiting review
            </span>
          )}
          <a href="/api/xero/disconnect" className="text-xs text-gray-400 hover:text-red-500 transition">Disconnect</a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          ['review', `Review (${pendingTx.length})`],
          ['pl',     'P&L'],
          ['cash',   'Cash'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs font-medium px-4 py-1.5 rounded-lg transition ${
              tab === t ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── REVIEW TAB ──────────────────────────────────────────────────── */}
      {tab === 'review' && (
        <div className="space-y-5">
          <p className="text-xs text-gray-400">
            Approve transactions that belong to <strong className="text-gray-700">Core Cleaning</strong> — ignore personal spending.
            Only approved transactions count toward your P&amp;L.
          </p>

          {/* Pending */}
          {pendingTx.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Needs review — {pendingTx.length}</p>
              <div className="space-y-1.5">
                {pendingTx.map(tx => (
                  <TxRow key={tx.id} tx={tx} state="pending" loading={pendingAction === tx.id}
                    onApprove={() => handleAction(tx, 'approve')}
                    onIgnore={() => handleAction(tx, 'ignore')}
                    onUndo={() => handleUndo(tx.id)} />
                ))}
              </div>
            </div>
          )}

          {pendingTx.length === 0 && (
            <div className="text-center py-6 text-xs text-gray-400">
              ✓ All transactions reviewed — {approvedTx.length} approved, {ignoredTx.length} ignored
            </div>
          )}

          {/* Approved */}
          {approvedTx.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-2">Approved for Core Cleaning P&amp;L — {approvedTx.length}</p>
              <div className="space-y-1.5">
                {approvedTx.map(tx => (
                  <TxRow key={tx.id} tx={tx} state="approved" loading={pendingAction === tx.id}
                    onApprove={() => {}} onIgnore={() => handleAction(tx, 'ignore')} onUndo={() => handleUndo(tx.id)} />
                ))}
              </div>
            </div>
          )}

          {/* Ignored */}
          {ignoredTx.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Ignored — {ignoredTx.length}</p>
              <div className="space-y-1.5">
                {ignoredTx.map(tx => (
                  <TxRow key={tx.id} tx={tx} state="ignored" loading={pendingAction === tx.id}
                    onApprove={() => handleAction(tx, 'approve')} onIgnore={() => {}} onUndo={() => handleUndo(tx.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── P&L TAB ─────────────────────────────────────────────────────── */}
      {tab === 'pl' && (
        <div>
          {loadingPL ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : plData.length === 0 ? (
            <div className="text-center py-10 text-xs text-gray-400">
              No approved transactions yet —{' '}
              <button onClick={() => setTab('review')} className="underline text-gray-600">go to Review</button> to approve some.
            </div>
          ) : (
            <div className="space-y-4">
              {/* KPI summary */}
              <div className="grid grid-cols-3 gap-3">
                {(['revenue', 'expenses', 'netProfit'] as const).map(key => {
                  const total = plData.reduce((s, p) => s + p[key], 0)
                  const label = { revenue: 'Revenue', expenses: 'Expenses', netProfit: 'Net Profit' }[key]
                  const color = key === 'netProfit' ? (total >= 0 ? 'text-green-700' : 'text-red-600') : 'text-black'
                  return (
                    <div key={key} className="border border-gray-100 rounded-xl p-4">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                      <p className={`text-lg font-bold ${color}`}>{fmt(total)}</p>
                    </div>
                  )
                })}
              </div>

              {/* Monthly table */}
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-gray-400 font-medium">Month</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Revenue</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Expenses</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Profit</th>
                    <th className="text-right py-2 text-gray-400 font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {plData.map((p, i) => {
                    const margin = p.revenue > 0 ? (p.netProfit / p.revenue) * 100 : 0
                    return (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-2.5 font-medium text-gray-700">{p.label}</td>
                        <td className="py-2.5 text-right text-gray-700">{fmt(p.revenue)}</td>
                        <td className="py-2.5 text-right text-gray-500">{fmt(p.expenses)}</td>
                        <td className={`py-2.5 text-right font-semibold ${p.netProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {fmt(p.netProfit)}
                        </td>
                        <td className={`py-2.5 text-right ${margin >= 0 ? 'text-gray-500' : 'text-red-500'}`}>
                          {margin.toFixed(0)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CASH TAB ────────────────────────────────────────────────────── */}
      {tab === 'cash' && (
        <div>
          {loadingCash ? (
            <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : bankData.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">No bank accounts found in Xero.</p>
          ) : (
            <div className="space-y-2">
              {bankData.map(acc => (
                <div key={acc.accountId} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{acc.name}</p>
                    <p className="text-[10px] text-gray-400">{acc.currencyCode}</p>
                  </div>
                  <p className={`text-sm font-bold ${acc.balance >= 0 ? 'text-black' : 'text-red-600'}`}>
                    {fmt(acc.balance)}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 mt-1">
                <p className="text-xs font-semibold text-gray-500">Total cash</p>
                <p className="text-sm font-bold">{fmt(bankData.reduce((s, a) => s + a.balance, 0))}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Transaction row ──────────────────────────────────────────────────────────

function TxRow({ tx, state, loading, onApprove, onIgnore, onUndo }: {
  tx: XeroTransaction
  state: TxState
  loading: boolean
  onApprove: () => void
  onIgnore: () => void
  onUndo: () => void
}) {
  const isIncome = tx.type === 'INCOME'
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
      state === 'approved' ? 'border-green-100 bg-green-50/30' :
      state === 'ignored'  ? 'border-gray-100 bg-gray-50/40 opacity-55' :
      'border-gray-100 bg-white'
    }`}>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide flex-shrink-0 ${
        isIncome ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
      }`}>
        {isIncome ? 'IN' : 'OUT'}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate">{tx.contact}</p>
        <p className="text-[10px] text-gray-400 truncate">
          {fmtDate(tx.date)}{tx.description ? ` · ${tx.description}` : ''}
        </p>
      </div>

      <span className={`text-sm font-semibold flex-shrink-0 ${isIncome ? 'text-green-700' : 'text-gray-700'}`}>
        {isIncome ? '+' : '-'}{fmt(tx.amount)}
      </span>

      {loading ? (
        <span className="text-[10px] text-gray-400 w-16 text-right">…</span>
      ) : state === 'pending' ? (
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={onApprove}
            className="text-[10px] font-semibold px-2.5 py-1 bg-black text-white rounded-lg hover:bg-gray-800 transition">
            Approve
          </button>
          <button onClick={onIgnore}
            className="text-[10px] font-medium px-2.5 py-1 border border-gray-200 text-gray-500 rounded-lg hover:border-gray-400 transition">
            Ignore
          </button>
        </div>
      ) : (
        <button onClick={onUndo}
          className="text-[10px] text-gray-400 hover:text-black transition flex-shrink-0 underline w-8 text-right">
          Undo
        </button>
      )}
    </div>
  )
}

// ─── Xero logo ────────────────────────────────────────────────────────────────

function XeroLogo({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 40 40" fill="none" className={className}>
      <circle cx="20" cy="20" r="20" fill="#13b5ea"/>
      <path d="M11 20l5-5-5-5M29 20l-5-5 5-5M20 11l5 5-5 5M20 29l-5-5 5-5"
        stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
