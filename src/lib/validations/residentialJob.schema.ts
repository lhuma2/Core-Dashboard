import { z } from 'zod'

const roomCount = z.coerce.number().int().min(0).max(7).optional()

export const RECURRING_FREQUENCIES = ['weekly', 'fortnightly', 'monthly'] as const

export const residentialJobSchema = z.object({
  client_name:   z.string().min(1, 'Client name is required').max(200),
  address:       z.string().min(1, 'Address is required').max(300),
  contact_phone: z.string().max(20).optional().or(z.literal('')),
  // For a one-off job this is the clean date; for a recurring template it's
  // the start-date anchor (used for fortnightly/monthly cadence math).
  clean_date:    z.string().min(1, 'Date is required'),
  clean_time:    z.string().max(8).optional().or(z.literal('')),
  is_recurring:  z.string().optional(), // 'true' | 'false' from a checkbox
  frequency:     z.enum(RECURRING_FREQUENCIES).optional().or(z.literal('')),
  service_days:  z.array(z.string()).optional(),
  bedrooms:              roomCount,
  bathrooms:             roomCount,
  carpet_steam_rooms:    roomCount,
  carpet_steam_hallways: roomCount,
  comments:      z.string().max(2000).optional().or(z.literal('')),
  cleaner_id:    z.string().uuid().optional().or(z.literal('')),
  cleaner_cost:  z.coerce.number().min(0).optional().or(z.literal('')),
}).refine(
  (data) => data.is_recurring !== 'true' || (!!data.frequency && (data.service_days?.length ?? 0) > 0),
  { message: 'Pick a frequency and at least one day for an ongoing clean.', path: ['frequency'] },
)

export type ResidentialJobInput = z.infer<typeof residentialJobSchema>
