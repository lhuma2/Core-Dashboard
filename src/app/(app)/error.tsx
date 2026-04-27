'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-96 text-center p-6">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <span className="text-red-500 text-xl">!</span>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Something went wrong
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        An unexpected error occurred. Please try again, or contact support if
        the problem persists.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
