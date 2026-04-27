import { createClient } from '@/lib/supabase/server'
import { SurveyForm } from '@/components/surveys/SurveyForm'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function NewSurveyPage({
  searchParams,
}: {
  searchParams: { client?: string }
}) {
  const supabase = createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, business_name')
    .eq('active', true)
    .order('business_name')

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link
          href="/surveys"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Survey Centre
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Add Survey Result</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Record client feedback scores
        </p>
      </div>
      <Card>
        <SurveyForm
          clients={(clients || []) as Parameters<typeof SurveyForm>[0]['clients']}
          preselectedClientId={searchParams.client}
        />
      </Card>
    </div>
  )
}
