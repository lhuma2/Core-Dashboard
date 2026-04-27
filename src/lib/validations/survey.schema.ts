import { z } from 'zod'

const scoreField = z.coerce
  .number()
  .int()
  .min(0, 'Minimum score is 0')
  .max(10, 'Maximum score is 10')

export const surveySchema = z.object({
  client_id: z.string().uuid('Select a client'),
  submitted_at: z.string().min(1, 'Date is required'),
  quality_score: scoreField,
  reliability_score: scoreField,
  communication_score: scoreField,
  value_score: scoreField,
  comments: z.string().max(1000).optional().or(z.literal('')),
})

export type SurveyFormData = z.infer<typeof surveySchema>
