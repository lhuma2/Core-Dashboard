export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-24" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-24">
            <div className="h-3 bg-gray-100 rounded w-20 mb-3" />
            <div className="h-6 bg-gray-100 rounded w-28" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-72" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 h-56" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 h-64" />
    </div>
  )
}
