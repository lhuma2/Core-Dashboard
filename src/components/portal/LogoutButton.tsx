'use client'

import { signOutAction } from '@/actions/auth'

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={className ?? 'text-xs font-medium text-gray-400 hover:text-black transition-colors px-2 py-1'}
      >
        Sign out
      </button>
    </form>
  )
}
