export default function Loading() {
  return (
    <div className="space-y-3 pt-1">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
        <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="h-7 w-48 bg-gray-100 rounded-xl animate-pulse mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
      ))}
    </div>
  )
}
