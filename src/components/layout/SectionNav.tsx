'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Tab { href: string; label: string }

// Grouped sections — each renders a category tab bar under the top bar so several
// related pages read as one section. Matches the sidebar grouping.
const GROUPS: { tabs: Tab[] }[] = [
  { tabs: [{ href: '/calls', label: 'Cold calls' }, { href: '/leads', label: 'Leads' }] },
  { tabs: [{ href: '/documents', label: 'Proposals & agreements' }, { href: '/safety', label: 'Safety & compliance' }, { href: '/sops', label: 'SOPs' }] },
  { tabs: [{ href: '/inspections', label: 'Inspections' }, { href: '/surveys', label: 'Surveys' }] },
  { tabs: [{ href: '/financial', label: 'Financials' }, { href: '/analytics', label: 'Analytics' }] },
]

const matches = (href: string, pathname: string) => pathname === href || pathname.startsWith(href + '/')

export function SectionNav() {
  const pathname = usePathname()
  const group = GROUPS.find((g) => g.tabs.some((t) => matches(t.href, pathname)))
  if (!group) return null

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 mb-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {group.tabs.map((t) => {
        const active = matches(t.href, pathname)
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active ? 'border-[#00250e] text-[#00250e]' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
