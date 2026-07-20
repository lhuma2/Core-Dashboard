import { z } from 'zod'

const roomCount = z.coerce.number().int().min(0).max(7).optional()

export const bondJobSchema = z.object({
  client_name:   z.string().min(1, 'Client name is required').max(200),
  address:       z.string().min(1, 'Address is required').max(300),
  contact_phone: z.string().max(20).optional().or(z.literal('')),
  clean_date:    z.string().min(1, 'Clean date is required'),
  clean_time:    z.string().max(8).optional().or(z.literal('')),
  bedrooms:              roomCount,
  bathrooms:             roomCount,
  carpet_steam_rooms:    roomCount,
  carpet_steam_hallways: roomCount,
  comments:      z.string().max(2000).optional().or(z.literal('')),
  cleaner_id:    z.string().uuid().optional().or(z.literal('')),
})

export type BondJobInput = z.infer<typeof bondJobSchema>
