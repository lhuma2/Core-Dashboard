import { HomeFormView } from '@/components/hub/HomeFormView'
import { loadCleaners } from '@/lib/hub/homes-data'
import { brisbaneToday } from '@/lib/hub/figures'

export const dynamic = 'force-dynamic'

export default async function NewHomePage() {
  const cleaners = await loadCleaners()
  return (
    <HomeFormView started={false} wasKind="" today={brisbaneToday()} cleaners={cleaners} signed={false} backHref="/hub/residential/clients" backLabel="Residential"
      initial={{ kind: 'recurring', name: '', phone: '', email: '', street: '', suburb: '', postcode: '', state: 'QLD', beds: '3', baths: '2', carpetRooms: '0', hallways: '0', every: 'weekly', days: [], first: '', start: '', finish: '', cleaner: '', price: '', cost: '', notes: '' }} />
  )
}
