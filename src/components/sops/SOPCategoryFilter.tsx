'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { SOP_CATEGORIES } from '@/lib/constants'
import { cn } from '@/lib/utils'

export function SOPCategoryFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const active = searchParams.get('category') || ''

  function setCategory(cat: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (cat) {
      params.set('category', cat)
    } else {
      params.delete('category')
    }
    router.push(pathname + '?' + params.toString())
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => setCategory('')}
        className={cn(
          'px-3 py-1.5 rounded-lg text-sm font-medium border transition',
          !active
            ? 'bg-brand-navy text-white border-brand-navy'
            : 'border-gray-300 text-gray-600 hover:border-brand-navy'
        )}
      >
        All
      </button>
      {SOP_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => setCategory(cat)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium border transition',
            active === cat
              ? 'bg-brand-navy text-white border-brand-navy'
              : 'border-gray-300 text-gray-600 hover:border-brand-navy'
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
