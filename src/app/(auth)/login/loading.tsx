export default function LoginLoading() {
  return (
    <div className="animate-pulse">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gray-200 rounded-2xl mx-auto mb-4" />
        <div className="h-6 bg-gray-200 rounded w-48 mx-auto mb-2" />
        <div className="h-4 bg-gray-100 rounded w-36 mx-auto" />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-8 space-y-5">
        <div>
          <div className="h-4 bg-gray-100 rounded w-28 mb-2" />
          <div className="h-10 bg-gray-100 rounded-lg" />
        </div>
        <div>
          <div className="h-4 bg-gray-100 rounded w-20 mb-2" />
          <div className="h-10 bg-gray-100 rounded-lg" />
        </div>
        <div className="h-10 bg-gray-200 rounded-lg" />
      </div>
    </div>
  )
}
