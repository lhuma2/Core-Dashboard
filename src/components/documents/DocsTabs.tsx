'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, ShieldCheck } from 'lucide-react'

const TABS = [
  { href: '/documents', label: 'Proposals & agreements', icon: FileText },
  { href: '/safety', label: 'Safety & compliance', icon: ShieldCheck },
]

export function DocsTabs() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + '/')
        const Icon = t.icon
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              active ? 'border-[#1e3a5f] text-[#1e3a5f]' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {t.label}
          </Link>
        )
      })}
    </div>
  )
}
