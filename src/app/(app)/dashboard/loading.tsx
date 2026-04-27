export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI grid skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-28">
            <div className="h-3 bg-gray-100 rounded w-24 mb-3" />
            <div className="h-7 bg-gray-100 rounded w-32" />
          </div>
        ))}
      </div>
      {/* Valuation banner */}
      <div className="bg-gray-200 rounded-xl h-24" />
      {/* Content grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 h-64" />
          <div className="bg-white rounded-xl border border-gray-200 h-48" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 h-64" />
      </div>
    </div>
  )
}
