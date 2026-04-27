export default function Loading() {
  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 h-14 flex items-center justify-between px-5">
        <div className="h-8 w-28 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-7 w-16 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full">
        <div className="h-8 w-52 bg-gray-100 rounded-xl animate-pulse mb-8" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
