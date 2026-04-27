export default function SOPsLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 bg-gray-200 rounded w-28" />
        <div className="h-10 bg-gray-200 rounded-lg w-28" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-8 bg-gray-100 rounded-lg w-28" />
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="h-12 bg-gray-50 border-b border-gray-100" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-4 border-b border-gray-50">
            <div className="h-4 bg-gray-100 rounded w-56" />
            <div className="h-6 bg-gray-100 rounded-full w-28" />
            <div className="h-4 bg-gray-100 rounded w-8" />
            <div className="h-6 bg-gray-100 rounded-full w-16" />
            <div className="h-4 bg-gray-100 rounded w-24 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
