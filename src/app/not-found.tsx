import Image from 'next/image'
import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <Image
            src="/logo-icon-black.png"
            alt="Delta Cleaning"
            width={64}
            height={64}
            className="object-contain"
          />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <p className="text-gray-500 mb-6">
          This page doesn&apos;t exist in Delta Operations Hub.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-navy text-white text-sm font-semibold rounded-lg hover:bg-brand-navy-light transition"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
