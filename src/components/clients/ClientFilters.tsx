'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/ui/Select'
import { SERVICE_TYPE_LABELS } from '@/lib/constants'

const STATUS_OPTIONS = [
  { value: '',         label: 'Active only'   },
  { value: 'all',      label: 'All clients'   },
  { value: 'inactive', label: 'Inactive only' },
]

const SERVICE_OPTIONS = [
  { value: '', label: 'All services' },
  ...Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

const HEALTH_OPTIONS = [
  { value: '',           label: 'All health'    },
  { value: 'at_risk',    label: 'At Risk'       },
  { value: 'watch',      label: 'Watch'         },
  { value: 'healthy',    label: 'Healthy'       },
  { value: 'incomplete', label: 'Incomplete'    },
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ClientFilters({ suburbs: _ }: { suburbs?: string[] }) {
  const router      = useRouter()
  const pathname    = usePathname()
  const searchParams = useSearchParams()

  const update = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      value ? params.set(name, value) : params.delete(name)
      router.push(pathname + '?' + params.toString())
    },
    [router, pathname, searchParams]
  )

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <SearchInput
        value={searchParams.get('q') || ''}
        onChange={(v) => update('q', v)}
        placeholder="Search clients…"
        className="w-full sm:w-64"
      />
      <Select
        options={STATUS_OPTIONS}
        value={searchParams.get('status') || ''}
        onChange={(e) => update('status', e.target.value)}
        className="w-36"
      />
      <Select
        options={SERVICE_OPTIONS}
        value={searchParams.get('service') || ''}
        onChange={(e) => update('service', e.target.value)}
        className="w-44"
      />
      <Select
        options={HEALTH_OPTIONS}
        value={searchParams.get('health') || ''}
        onChange={(e) => update('health', e.target.value)}
        className="w-36"
      />
    </div>
  )
}
