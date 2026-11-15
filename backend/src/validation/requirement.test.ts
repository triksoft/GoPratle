import { describe, expect, it } from 'vitest';
import { requirementSchema } from './requirement.js';

const base = { eventName: 'Product launch', eventType: 'Launch', dateType: 'single' as const, startDate: '2026-11-11', location: 'Pune', category: 'performer' as const, clientSubmissionId: '80f53d33-cc58-477d-bd42-0bbdf9a3d20b', details: { performanceType: 'DJ', durationMinutes: 120, equipmentProvided: 'No, provider should bring it' as const } };
describe('requirementSchema', () => {
  it('accepts valid category-specific input', () => expect(requirementSchema.safeParse(base).success).toBe(true));
  it('rejects details from the wrong category', () => expect(requirementSchema.safeParse({ ...base, category: 'crew', details: base.details }).success).toBe(false));
  it('requires an end date for a range', () => expect(requirementSchema.safeParse({ ...base, dateType: 'range' }).success).toBe(false));

  it('accepts planner requirement with single numeric budget', () => {
    const plannerBase = {
      ...base,
      category: 'planner' as const,
      details: {
        budget: 500000,
        guestCount: 200,
        planningScope: 'Full planning' as const
      }
    };
    const parsed = requirementSchema.safeParse(plannerBase);
    expect(parsed.success).toBe(true);
  });

  it('accepts planner requirement with readable budget range string', () => {
    const plannerRange = {
      ...base,
      category: 'planner' as const,
      details: {
        budget: '₹1,00,000 – ₹3,00,000',
        guestCount: 150,
        planningScope: 'Partial planning' as const
      }
    };
    const parsed = requirementSchema.safeParse(plannerRange);
    expect(parsed.success).toBe(true);
  });

  it('accepts valid phone number and email', () => {
    const withContact = {
      ...base,
      phone: '+91 98765 43210',
      email: 'ananya@example.com'
    };
    const parsed = requirementSchema.safeParse(withContact);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.phone).toBe('+91 98765 43210');
      expect(parsed.data.email).toBe('ananya@example.com');
    }
  });

  it('accepts only phone number or only email id', () => {
    expect(requirementSchema.safeParse({ ...base, phone: '9876543210', email: '' }).success).toBe(true);
    expect(requirementSchema.safeParse({ ...base, phone: '', email: 'contact@gopratle.com' }).success).toBe(true);
    expect(requirementSchema.safeParse({ ...base, phone: undefined, email: undefined }).success).toBe(true);
  });

  it('rejects invalid email format', () => {
    const invalidEmail = {
      ...base,
      email: 'not-an-email'
    };
    const parsed = requirementSchema.safeParse(invalidEmail);
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid phone number format', () => {
    const invalidPhone = {
      ...base,
      phone: 'not-a-number'
    };
    const parsed = requirementSchema.safeParse(invalidPhone);
    expect(parsed.success).toBe(false);
  });
});
