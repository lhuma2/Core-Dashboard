// Delta Cleaning — QA site inspection template + scoring.
// A default commercial-cleaning inspection: areas → items, each scored
// Pass / Minor / Fail. Shared by the form (client) and the actions (server),
// so scoring is identical everywhere.

export type Rating = 'pass' | 'minor' | 'fail'

export interface TemplateItem { key: string; label: string }
export interface TemplateArea { key: string; name: string; items: TemplateItem[] }

export const RATING_POINTS: Record<Rating, number> = { pass: 2, minor: 1, fail: 0 }

export const RATING_LABEL: Record<Rating, string> = { pass: 'Pass', minor: 'Minor', fail: 'Fail' }

export const INSPECTION_TEMPLATE: TemplateArea[] = [
  {
    key: 'reception', name: 'Reception & entrance',
    items: [
      { key: 'floors', label: 'Floors clean & dry' },
      { key: 'glass', label: 'Glass & entry doors' },
      { key: 'surfaces', label: 'Surfaces dusted' },
      { key: 'impression', label: 'Overall first impression' },
    ],
  },
  {
    key: 'offices', name: 'Offices & workstations',
    items: [
      { key: 'desks', label: 'Desks & surfaces wiped' },
      { key: 'floors', label: 'Floors vacuumed' },
      { key: 'bins', label: 'Bins emptied' },
      { key: 'cobwebs', label: 'Cobwebs & vents' },
    ],
  },
  {
    key: 'restrooms', name: 'Restrooms',
    items: [
      { key: 'toilets', label: 'Toilets & urinals' },
      { key: 'basins', label: 'Basins & mirrors' },
      { key: 'floors', label: 'Floors mopped' },
      { key: 'restock', label: 'Soap & paper restocked' },
      { key: 'odour', label: 'Odour fresh' },
    ],
  },
  {
    key: 'kitchen', name: 'Kitchen & break room',
    items: [
      { key: 'benches', label: 'Benches & sink' },
      { key: 'appliances', label: 'Appliance exteriors' },
      { key: 'floor', label: 'Floor clean' },
      { key: 'bins', label: 'Bins emptied' },
    ],
  },
  {
    key: 'floors', name: 'Floors (hard & carpet)',
    items: [
      { key: 'vacuumed', label: 'Carpets vacuumed' },
      { key: 'mopped', label: 'Hard floors mopped, no streaks' },
      { key: 'edges', label: 'Edges & corners done' },
    ],
  },
  {
    key: 'waste', name: 'Bins & waste',
    items: [
      { key: 'emptied', label: 'All bins emptied' },
      { key: 'liners', label: 'Liners replaced' },
      { key: 'removed', label: 'Waste removed from site' },
    ],
  },
  {
    key: 'hightouch', name: 'High-touch points',
    items: [
      { key: 'handles', label: 'Door handles' },
      { key: 'switches', label: 'Light switches' },
      { key: 'rails', label: 'Lift buttons / rails' },
    ],
  },
  {
    key: 'detail', name: 'Detail & presentation',
    items: [
      { key: 'skirting', label: 'Skirting & ledges' },
      { key: 'sills', label: 'Vents & window sills' },
      { key: 'tidiness', label: 'Overall tidiness' },
    ],
  },
]

// ── Runtime shapes (what a saved inspection stores) ──────────────────────────
export interface InspItem { key: string; label: string; rating: Rating | null }
export interface InspArea { key: string; name: string; items: InspItem[]; note?: string | null; photos?: string[] }
export interface Rectification { area: string; label: string; rating: Rating; note?: string | null }

export interface AreaScore { key: string; name: string; score: number | null; rated: number }
export interface InspectionScore { overall: number | null; perArea: AreaScore[]; rectifications: Rectification[] }

/** Build a blank inspection (all items unrated) from the template. */
export function blankAreas(): InspArea[] {
  return INSPECTION_TEMPLATE.map((a) => ({
    key: a.key, name: a.name, note: '', photos: [],
    items: a.items.map((it) => ({ key: it.key, label: it.label, rating: null as Rating | null })),
  }))
}

/** Score an inspection — overall %, per-area %, and the rectification list. */
export function scoreInspection(areas: InspArea[]): InspectionScore {
  let pts = 0
  let max = 0
  const perArea: AreaScore[] = areas.map((a) => {
    let ap = 0
    let am = 0
    a.items.forEach((it) => {
      if (it.rating) { ap += RATING_POINTS[it.rating]; am += 2 }
    })
    pts += ap
    max += am
    return { key: a.key, name: a.name, score: am ? Math.round((100 * ap) / am) : null, rated: am / 2 }
  })
  const overall = max ? Math.round((100 * pts) / max) : null
  const rectifications: Rectification[] = areas.flatMap((a) =>
    a.items
      .filter((it) => it.rating === 'minor' || it.rating === 'fail')
      .map((it) => ({ area: a.name, label: it.label, rating: it.rating as Rating, note: a.note || null }))
  )
  return { overall, perArea, rectifications }
}

export type Band = 'pass' | 'watch' | 'fail' | 'none'

/** Colour band for a score: green ≥90, amber 75–89, red below. */
export function scoreBand(score: number | null): Band {
  if (score == null) return 'none'
  if (score >= 90) return 'pass'
  if (score >= 75) return 'watch'
  return 'fail'
}
