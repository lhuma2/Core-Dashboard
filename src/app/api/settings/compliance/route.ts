import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()
    const { data } = await (supabase as any)
      .from('settings')
      .select('abn, insurance_policy_number')
      .limit(1)
      .single()
    return NextResponse.json(data ?? { abn: null, insurance_policy_number: null })
  } catch {
    return NextResponse.json({ abn: null, insurance_policy_number: null })
  }
}
