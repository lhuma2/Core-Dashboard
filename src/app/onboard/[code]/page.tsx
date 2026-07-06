export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/admin'
import { OnboardExperience } from '@/components/documents/OnboardExperience'
import type { SubbieSignature } from '@/components/documents/render/SwmsDocument'

function auDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Brisbane' })
}

export default async function OnboardPage({ params }: { params: { code: string } }) {
  const db = createAdminClient() as any
  const { data: sub } = await db
    .from('subcontractors')
    .select('sign_code, signed_name, signed_at, company_name')
    .eq('sign_code', params.code)
    .maybeSingle()

  if (!sub) {
    return (
      <div className="min-h-[100dvh] bg-[#0b1320] flex items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-white text-xl font-bold mb-2">This onboarding link isn&apos;t valid</h1>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">The link may be mistyped or no longer active. Please contact Core Cleaning.</p>
        </div>
      </div>
    )
  }

  const alreadySigned: SubbieSignature | null =
    sub.signed_at && sub.signed_name
      ? { name: sub.signed_name, date: auDate(sub.signed_at), company: sub.company_name ?? undefined }
      : null

  return <OnboardExperience code={params.code} alreadySigned={alreadySigned} />
}
