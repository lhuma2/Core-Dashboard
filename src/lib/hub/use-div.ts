'use client'
import { usePathname } from 'next/navigation'
import { DIVN, divBase, divFromPath, type Div } from './div'

/** Which division screen we're on (Residential or End of Lease), from the address. */
export function useDiv(): { div: Div; base: string; name: string; lower: string } {
  const div = divFromPath(usePathname())
  return { div, base: divBase(div), name: DIVN[div], lower: DIVN[div].toLowerCase() }
}
