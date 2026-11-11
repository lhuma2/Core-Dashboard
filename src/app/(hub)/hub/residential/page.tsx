import { redirect } from 'next/navigation'

// Residential opens on Quotes until the Clients tab is built.
export default function ResidentialPage() { redirect('/hub/residential/quotes') }
