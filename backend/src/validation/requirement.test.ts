import { describe, expect, it } from 'vitest';
import { requirementSchema } from './requirement.js';

const base = { eventName: 'Product launch', eventType: 'Launch', dateType: 'single' as const, startDate: '2026-11-11', location: 'Pune', category: 'performer' as const, clientSubmissionId: '80f53d33-cc58-477d-bd42-0bbdf9a3d20b', details: { performanceType: 'DJ', durationMinutes: 120, equipmentProvided: 'No, provider should bring it' as const } };
describe('requirementSchema', () => {
  it('accepts valid category-specific input', () => expect(requirementSchema.safeParse(base).success).toBe(true));
  it('rejects details from the wrong category', () => expect(requirementSchema.safeParse({ ...base, category: 'crew', details: base.details }).success).toBe(false));
  it('requires an end date for a range', () => expect(requirementSchema.safeParse({ ...base, dateType: 'range' }).success).toBe(false));
});
