import Link from 'next/link'
import { SWMS_LIST, MODERN_SLAVERY, SDS_REGISTER, POLICIES } from '@/lib/documents/safety'
import { ShieldCheck, FileText, ChevronRight, HardHat, FlaskConical } from 'lucide-react'

export default function SafetyPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-gray-900">Safety &amp; Compliance</h1>
        <p className="text-sm text-gray-400 mt-0.5">Safe Work Method Statements and policies — view, print, or share with clients and auditors.</p>
      </div>

      {/* SWMS */}
      <div className="flex items-center gap-2 mb-3">
        <HardHat className="w-4 h-4 text-gray-400" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Safe Work Method Statements · {SWMS_LIST.length}</p>
      </div>
      <div className="space-y-2 mb-8">
        {SWMS_LIST.map((s) => {
          const slug = s.code.replace(/\s+/g, '-').toLowerCase()
          return (
            <Link key={s.code} href={`/safety/${slug}`} target="_blank" className="block">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4 text-[#1e3a5f]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400 font-mono">{s.code} · {s.rows.length} hazards</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Policies */}
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-gray-400" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Policies</p>
      </div>
      <div className="space-y-2">
        {POLICIES.map((p) => (
          <Link key={p.slug} href={`/safety/${p.slug}`} target="_blank" className="block">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-[#1e3a5f]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400">Policy statement · {p.code}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          </Link>
        ))}
        <Link href="/safety/modern-slavery" target="_blank" className="block">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-[#1e3a5f]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{MODERN_SLAVERY.title}</p>
                <p className="text-xs text-gray-400">Policy statement</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
        </Link>
        <Link href="/safety/sds-register" target="_blank" className="block">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-3 hover:border-gray-300 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#1e3a5f]/5 border border-[#1e3a5f]/10 flex items-center justify-center flex-shrink-0">
                <FlaskConical className="w-4 h-4 text-[#1e3a5f]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{SDS_REGISTER.title}</p>
                <p className="text-xs text-gray-400">{SDS_REGISTER.products.length} products · SDS on the cleaner portal</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </div>
        </Link>
        <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-500">Contractor Induction</p>
            <p className="text-xs text-gray-400">Signable — coming next: subbies sign it online before starting.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
