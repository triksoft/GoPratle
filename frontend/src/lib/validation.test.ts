import { describe, expect, it } from 'vitest';
import { initialRequirement } from '@/types/requirement';
import { validateStep } from '@/lib/validation';

describe('validateStep', () => {
  it('requires event basics', () => expect(validateStep(initialRequirement(), 1)).toMatchObject({ eventName: expect.any(String), category: expect.any(String) }));
  it('enforces a valid planner payload', () => {
    const form = { ...initialRequirement(), eventName: 'Launch', eventType: 'Conference', startDate: '2026-11-04', location: 'Mumbai', category: 'planner' as const, details: { budget: '100000', guestCount: '70', planningScope: 'Full planning' } };
    expect(validateStep(form, 4)).toEqual({});
  });
  it('rejects a reversed date range', () => {
    const form = { ...initialRequirement(), dateType: 'range' as const, startDate: '2026-11-05', endDate: '2026-11-04' };
    expect(validateStep(form, 1).endDate).toMatch(/after/);
  });
});
