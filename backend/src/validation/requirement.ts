import { z } from 'zod';

const common = {
  eventName: z.string().trim().min(1, 'Event name is required.').max(120),
  eventType: z.string().trim().min(1, 'Event type is required.').max(80),
  dateType: z.enum(['single', 'range']),
  startDate: z.string().date('Start date must use YYYY-MM-DD.'),
  endDate: z.string().date('End date must use YYYY-MM-DD.').optional().or(z.literal('')),
  location: z.string().trim().min(1, 'Location is required.').max(160),
  venue: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(1000).optional(),
  clientSubmissionId: z.string().uuid('A valid submission ID is required.')
};

const planner = z.object({ ...common, category: z.literal('planner'), details: z.object({ budget: z.coerce.number().positive('Budget must be greater than zero.'), guestCount: z.coerce.number().int().positive('Guest count must be at least one.'), planningScope: z.enum(['Full planning', 'Partial planning', 'Day-of coordination']) }) });
const performer = z.object({ ...common, category: z.literal('performer'), details: z.object({ performanceType: z.string().trim().min(1, 'Performance type is required.').max(100), durationMinutes: z.coerce.number().int().positive('Duration must be at least one minute.'), equipmentProvided: z.enum(['Yes, fully provided', 'Partially provided', 'No, provider should bring it']) }) });
const crew = z.object({ ...common, category: z.literal('crew'), details: z.object({ crewRole: z.string().trim().min(1, 'Crew role is required.').max(100), shiftHours: z.coerce.number().positive('Shift hours must be greater than zero.'), teamSize: z.coerce.number().int().positive('Team size must be at least one.') }) });

export const requirementSchema = z.discriminatedUnion('category', [planner, performer, crew]).superRefine((value, context) => {
  if (value.dateType === 'range' && !value.endDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date is required for a date range.' });
  if (value.dateType === 'single' && value.endDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date is not allowed for a single-day event.' });
  if (value.dateType === 'range' && value.endDate && value.startDate > value.endDate) context.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'End date must be on or after start date.' });
});

export type ValidRequirement = z.infer<typeof requirementSchema>;
