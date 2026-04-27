import { createClient } from '@/lib/supabase/server'
import { DocumentBuilder } from '@/components/documents/DocumentBuilder'

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: { client?: string; type?: string }
}) {
  const supabase = createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .eq('active', true)
    .order('business_name')

  return (
    <div className="-m-6 lg:-m-8">
      <DocumentBuilder
        clients={clients || []}
        preselectedClientId={searchParams.client}
        preselectedType={searchParams.type as any}
      />
    </div>
  )
}
