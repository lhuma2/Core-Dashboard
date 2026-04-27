export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 h-14 flex items-center px-5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
          <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
      <div className="flex-1 px-4 py-5 pb-8 max-w-lg mx-auto w-full space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
