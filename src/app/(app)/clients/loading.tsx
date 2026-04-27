export default function ClientsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 bg-gray-200 rounded w-32 mb-2" />
          <div className="h-4 bg-gray-100 rounded w-24" />
        </div>
        <div className="h-10 bg-gray-200 rounded-lg w-32" />
      </div>
      <div className="flex gap-3">
        <div className="h-10 bg-gray-100 rounded-lg w-64" />
        <div className="h-10 bg-gray-100 rounded-lg w-36" />
        <div className="h-10 bg-gray-100 rounded-lg w-44" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-100" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3.5 border-b border-gray-50">
            <div className="h-4 bg-gray-100 rounded w-20" />
            <div className="h-4 bg-gray-100 rounded w-48" />
            <div className="h-4 bg-gray-100 rounded w-24" />
            <div className="h-4 bg-gray-100 rounded w-32" />
            <div className="h-4 bg-gray-100 rounded w-24 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
