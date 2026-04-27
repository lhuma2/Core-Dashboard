import { z } from 'zod'

export const sopSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  category: z.string().min(1, 'Category is required'),
  content: z.string().min(1, 'Content is required'),
  active: z.boolean().default(true),
})

export type SOPFormData = z.infer<typeof sopSchema>
