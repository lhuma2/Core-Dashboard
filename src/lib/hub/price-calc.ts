// The website's price calculators, copied into the hub so a phone quote gets the same price
// the website would have shown. Keep these numbers in step with the website repo:
//   residential  api/_lib/residentialHours.js
//   end of lease src/lib/endOfLeaseHours.js + src/lib/endOfLeasePricing.js
import type { Quote } from './home-quotes'

// ── Residential (regular and deep cleans) ─────────────────────
// Minutes for one cleaner. Every home is assumed to have one kitchen and one laundry.
export const RES_ROOM_MIN = { bedroom: 15, bathroom: 25, livingArea: 20, kitchen: 30, laundry: 10 }
export const RES_SETUP_MIN = 10
export const RES_LARGE_BEDS = 3
export const RES_LARGE_FACTOR = 1.15
export const RES_PETS_FACTOR = 1.15
export const RES_DEEP_FACTOR = 2.5
export const RES_MONTHLY_FACTOR = 1.15
/** Regular cleans are charged at least this many hours. Deep cleans aren't. */
export const RES_MIN_HOURS = 2.75
/** $ an hour before GST: cleaner pay $45 + 20% margin, or the deep clean rate. */
export const RES_RATE_EX = 45 * 1.2
export const RES_DEEP_RATE_EX = 60
/** Internal windows add-on by bedrooms, incl GST. */
export const resWindowsPrice = (beds: number) => (beds >= 5 ? 150 : beds >= 4 ? 110 : beds >= 3 ? 80 : 60)
/** Carpet steam cleaning add-on on a deep clean, a room, incl GST. */
export const RES_CARPET_ROOM = 50

const quarter = (h: number) => Math.round(h * 4) / 4
const cents = (n: number) => Math.round(n * 100) / 100

export interface Calc { hours: number; charged: number; rateEx: number; price: number; lines: string[] }

export function resCalc(q: Pick<Quote, 'type' | 'every' | 'beds' | 'baths' | 'living'>, pets: boolean): Calc {
  const deep = q.type === 'deep'
  const beds = Math.max(0, +q.beds || 0), baths = Math.max(0, +q.baths || 0), living = Math.max(0, +q.living || 0)
  const rooms = beds * RES_ROOM_MIN.bedroom + baths * RES_ROOM_MIN.bathroom + living * RES_ROOM_MIN.livingArea + RES_ROOM_MIN.kitchen + RES_ROOM_MIN.laundry
  let min = rooms
  const lines = [`Rooms ${rooms} min (${beds} bed, ${baths} bath, ${living} living, kitchen, laundry)`]
  if (beds >= RES_LARGE_BEDS) { min *= RES_LARGE_FACTOR; lines.push('3+ bedrooms +15%') }
  if (pets) { min *= RES_PETS_FACTOR; lines.push('Pets +15%') }
  if (deep) { min *= RES_DEEP_FACTOR; lines.push('Deep clean ×2.5') }
  else if (q.every === 'monthly') { min *= RES_MONTHLY_FACTOR; lines.push('Monthly +15%') }
  min += RES_SETUP_MIN
  const hours = quarter(min / 60)
  const charged = deep ? hours : Math.max(hours, RES_MIN_HOURS)
  if (charged > hours) lines.push(`Minimum charge ${RES_MIN_HOURS} hrs`)
  const rateEx = deep ? RES_DEEP_RATE_EX : RES_RATE_EX
  return { hours, charged, rateEx, price: cents(charged * rateEx * 1.1), lines }
}

// ── End of lease ──────────────────────────────────────────────
export const EOL_ROOM_HRS = { bedrooms: 1, bathrooms: 1.5, livingAreas: 1.5, kitchens: 2.5, garage: 1, balcony: 1 }
export const EOL_UNIT_FACTOR = 0.9
export const EOL_RATE_EX = 70

/** The clean alone (no add-ons), incl GST, rounded down to the nearest $5 like the website. */
export function eolCalc(q: Pick<Quote, 'beds' | 'baths' | 'living' | 'eol'>, unit: boolean): Calc {
  const n = (v: unknown) => Math.max(0, +(v as number) || 0)
  const beds = n(q.beds), baths = n(q.baths), living = n(q.living), kit = n(q.eol?.kitchens), gar = n(q.eol?.garage), bal = n(q.eol?.balcony)
  let hours = beds * EOL_ROOM_HRS.bedrooms + baths * EOL_ROOM_HRS.bathrooms + living * EOL_ROOM_HRS.livingAreas + kit * EOL_ROOM_HRS.kitchens + gar * EOL_ROOM_HRS.garage + bal * EOL_ROOM_HRS.balcony
  const lines = [`Rooms ${hours} hrs (${beds} bed, ${baths} bath, ${living} living, ${kit} kitchen${gar ? ', ' + gar + ' garage' : ''}${bal ? ', ' + bal + ' balcony' : ''})`]
  if (unit) { hours = quarter(hours * EOL_UNIT_FACTOR); lines.push('Unit or apartment ×0.9') }
  return { hours, charged: hours, rateEx: EOL_RATE_EX, price: Math.floor((hours * EOL_RATE_EX * 1.1) / 5) * 5, lines }
}

/** The calculator for this quote. Null for an add-ons only quote, or a home with no rooms picked. */
export function quoteCalc(q: Quote): Calc | null {
  if (q.type === 'eol') {
    if (q.eol?.only) return null
    const c = eolCalc(q, !!q.calc?.unit)
    return c.hours > 0 ? c : null
  }
  return resCalc(q, !!q.calc?.pets)
}

/** "3.25" style hours for the Estimated hours box. */
export const hrsText = (h: number) => String(Number(h.toFixed(2)))
