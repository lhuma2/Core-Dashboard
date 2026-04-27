import type { Client } from '@/types/app'

interface ClientRatioSectionProps {
  clients: Client[]
}

export function ClientRatioSection({ clients }: ClientRatioSectionProps) {
  const active = clients.filter((c) => c.active).length
  const inactive = clients.filter((c) => !c.active).length
  const total = clients.length
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <p className="text-4xl font-bold text-brand-navy">{activePct}%</p>
          <p className="text-sm text-gray-500">retention rate</p>
        </div>
        <div className="flex-1 pb-1">
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-navy rounded-full transition-all"
              style={{ width: `${activePct}%` }}
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500">Total clients</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-700">{active}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-400">{inactive}</p>
          <p className="text-xs text-gray-500">Inactive</p>
        </div>
      </div>
    </div>
  )
}
