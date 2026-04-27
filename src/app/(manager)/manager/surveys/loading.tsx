export default function Loading() {
  return (
    <div className="space-y-2 pt-1">
      <div className="h-8 w-52 bg-gray-100 rounded-xl animate-pulse mb-6" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
      ))}
    </div>
  )
}
