import { z } from 'zod'
import { serviceTypeEnum, frequencyEnum } from './client.schema'

export const documentTypeEnum = z.enum([
  'proposal',
  'cleaning_agreement',
  'specialist_agreement',
])

export const documentStatusEnum = z.enum([
  'draft',
  'sent',
  'signed',
  'expired',
  'cancelled',
])

export const billingSchema = z.object({
  serviceTypes: z.array(serviceTypeEnum).min(1, 'Select at least one service'),
  frequency: frequencyEnum,
  ratePerVisit: z.coerce.number().positive('Rate must be positive'),
  monthlyValue: z.number(),
  annualValue: z.number(),
  visitsPerMonth: z.number(),
  gstInclusive: z.boolean().default(true),
})

export const proposalSchema = z.object({
  scopeOfWork: z.string().min(1, 'Scope of work is required'),
  inclusions: z.string().optional().or(z.literal('')),
  exclusions: z.string().optional().or(z.literal('')),
  termsAndConditions: z.string().optional().or(z.literal('')),
})

export const cleaningAgreementSchema = z.object({
  commencementDate: z.string().min(1, 'Commencement date is required'),
  contractLength: z.string().min(1, 'Contract length is required'),
  noticePeriod: z.string().min(1, 'Notice period is required'),
  specialInstructions: z.string().optional().or(z.literal('')),
  paymentTerms: z.string().min(1, 'Payment terms are required'),
  terminationClause: z.string().optional().or(z.literal('')),
  signatoryName: z.string().min(1, 'Signatory name is required'),
  signatoryTitle: z.string().optional().or(z.literal('')),
})

export const specialistAgreementSchema = z.object({
  specialistServiceType: z.string().min(1, 'Service type is required'),
  commencementDate: z.string().min(1, 'Commencement date is required'),
  specialConditions: z.string().optional().or(z.literal('')),
  signatoryName: z.string().min(1, 'Signatory name is required'),
  signatoryTitle: z.string().optional().or(z.literal('')),
})

export const documentSchema = z.object({
  client_id: z.string().uuid('Select a client'),
  document_type: documentTypeEnum,
  title: z.string().min(1, 'Document title is required'),
  status: documentStatusEnum.default('draft'),
  billing: billingSchema,
  proposal: proposalSchema.optional(),
  cleaningAgreement: cleaningAgreementSchema.optional(),
  specialistAgreement: specialistAgreementSchema.optional(),
  expiryDate: z.string().optional().or(z.literal('')),
})

export type DocumentFormData = z.infer<typeof documentSchema>
