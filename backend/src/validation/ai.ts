import { z } from 'zod';

export const aiExtractionRequestSchema = z.object({
  description: z.string().trim().min(3, 'Event description is required.').max(3000, 'Description is too long.')
});

export type AiExtractionRequest = z.infer<typeof aiExtractionRequestSchema>;

const plannerDetailsSchema = z.object({
  budget: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== '' ? String(v) : '')),
  guestCount: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== '' ? String(v) : '')),
  planningScope: z.enum(['Full planning', 'Partial planning', 'Day-of coordination', '']).catch('').default('')
});

const performerDetailsSchema = z.object({
  performanceType: z.string().optional().default(''),
  durationMinutes: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== '' ? String(v) : '')),
  equipmentProvided: z.enum(['Yes, fully provided', 'Partially provided', 'No, provider should bring it', '']).catch('').default('')
});

const crewDetailsSchema = z.object({
  crewRole: z.string().optional().default(''),
  shiftHours: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== '' ? String(v) : '')),
  teamSize: z.union([z.string(), z.number()]).optional().transform(v => (v !== undefined && v !== null && v !== '' ? String(v) : ''))
});

export const extractedAiDetailsSchema = z.object({
  eventName: z.string().catch('').default(''),
  eventType: z.string().catch('').default(''),
  dateType: z.enum(['single', 'range']).catch('single').default('single'),
  startDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Must be YYYY-MM-DD or empty').catch('').default(''),
  endDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Must be YYYY-MM-DD or empty').catch('').default(''),
  location: z.string().catch('').default(''),
  venue: z.string().catch('').default(''),
  category: z.enum(['planner', 'performer', 'crew', '']).catch('').default(''),
  details: z.record(z.string(), z.any()).catch({}).default({}),
  notes: z.string().catch('').default(''),
  missingFields: z.array(z.string()).catch([]).default([])
});

export type ExtractedAiDetails = z.infer<typeof extractedAiDetailsSchema>;
