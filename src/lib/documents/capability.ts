// ─── Capability Statement — data model + defaults ────────────────────────────
// A leave-behind that always travels with a proposal. Mostly fixed template;
// these are the few editable fields.

export interface CapabilityData {
  year: string
  tagline: string
  intro: string
  testimonial: string
  testimonialAuthor: string
  testimonial2: string
  testimonial2Author: string
  contactName: string
  contactRole: string
  contactPhone: string
  contactEmail: string
  website: string
}

export const DEFAULT_CAPABILITY: CapabilityData = {
  year: '2026',
  tagline: 'A higher standard of commercial cleaning, kept by the owner.',
  intro: 'Owner-led commercial cleaning for businesses across Brisbane and South East Queensland, built on reliability, accountability and personal involvement.',
  testimonial: 'Laith has clear communication and frequently checks in to make sure we are getting the best service. We would recommend Core Cleaning to other commercial sites.',
  testimonialAuthor: 'Braden L. · Physiotherapy Clinic',
  testimonial2: 'They understand the hygiene standards a medical environment needs and consistently deliver. Communication is clear and quality is always high.',
  testimonial2Author: 'Keziah W. · Medical Clinic Manager',
  contactName: 'Laith Humadi',
  contactRole: 'Director',
  contactPhone: '+61 407 026 360',
  contactEmail: 'admin@corecleaning.services',
  website: 'corecleaning.services',
}

export function withCapabilityDefaults(data: Partial<CapabilityData> | null | undefined): CapabilityData {
  return { ...DEFAULT_CAPABILITY, ...(data ?? {}) }
}
