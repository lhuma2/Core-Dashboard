export default function SurveysLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-gray-200 rounded w-32" />
        <div className="h-10 bg-gray-200 rounded-lg w-28" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 h-20">
            <div className="h-3 bg-gray-100 rounded w-20 mb-2" />
            <div className="h-5 bg-gray-100 rounded w-16" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-6 h-64" />
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-100" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-4 border-b border-gray-50">
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-40" />
            <div className="h-4 bg-gray-100 rounded w-8" />
            <div className="h-4 bg-gray-100 rounded w-8" />
            <div className="h-4 bg-gray-100 rounded w-8" />
            <div className="h-4 bg-gray-100 rounded w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}
