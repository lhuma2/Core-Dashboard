export type TenderSource = 'austender' | 'qtenders'
export type TenderStatus = 'candidate' | 'active' | 'done'

export interface Tender {
  id: string
  source: TenderSource
  external_id: string
  title: string
  issuer: string | null
  category: string | null
  summary: string | null
  location: string | null
  status: TenderStatus
  open_date: string | null
  close_date: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  url: string
  activated_at: string | null
  ticked_off_at: string | null
  created_at: string
  updated_at: string
}

// A freshly-fetched, not-yet-deduped record ready to insert as a 'candidate'.
export type TenderCandidate = Pick<
  Tender,
  'source' | 'external_id' | 'title' | 'issuer' | 'category' | 'summary' |
  'location' | 'open_date' | 'close_date' | 'contact_name' | 'contact_email' |
  'contact_phone' | 'url'
>
