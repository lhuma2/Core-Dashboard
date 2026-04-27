import { z } from 'zod'

export const financialRecordSchema = z.object({
  client_id: z.string().uuid().optional().or(z.literal('')),
  record_date: z.string().min(1, 'Date is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense']),
  category: z.string().min(1, 'Category is required'),
  description: z.string().max(500).optional().or(z.literal('')),
})

export type FinancialRecordFormData = z.infer<typeof financialRecordSchema>
