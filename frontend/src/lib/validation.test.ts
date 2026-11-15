import { describe, expect, it } from 'vitest';
import { initialRequirement } from '@/types/requirement';
import { validateStep } from '@/lib/validation';

describe('validateStep', () => {
  it('requires event basics', () => expect(validateStep(initialRequirement(), 1)).toMatchObject({ eventName: expect.any(String), category: expect.any(String) }));
  it('enforces a valid planner payload', () => {
    const form = {
      ...initialRequirement(),
      eventName: 'Launch',
      eventType: 'Conference',
      startDate: '2026-11-04',
      location: 'Mumbai',
      category: 'planner' as const,
      phone: '+91 98765 43210',
      details: { budget: '100000', guestCount: '70', planningScope: 'Full planning' }
    };
    expect(validateStep(form, 4)).toEqual({});
  });

  it('rejects submission when both phone and email are empty on step 3 and 4', () => {
    const formWithoutContact = {
      ...initialRequirement(),
      eventName: 'Launch',
      eventType: 'Conference',
      startDate: '2026-11-04',
      location: 'Mumbai',
      category: 'planner' as const,
      phone: '',
      email: '',
      details: { budget: '100000', guestCount: '70', planningScope: 'Full planning' }
    };
    const errors3 = validateStep(formWithoutContact, 3);
    expect(errors3.contact).toBe('Enter at least a phone number or email address so we can contact you.');

    const errors4 = validateStep(formWithoutContact, 4);
    expect(errors4.contact).toBe('Enter at least a phone number or email address so we can contact you.');
  });

  it('accepts requirement when only phone is present', () => {
    const form = {
      ...initialRequirement(),
      eventName: 'Launch',
      eventType: 'Conference',
      startDate: '2026-11-04',
      location: 'Mumbai',
      category: 'planner' as const,
      phone: '+91 98765 43210',
      email: '',
      details: { budget: '100000', guestCount: '70', planningScope: 'Full planning' }
    };
    expect(validateStep(form, 3)).toEqual({});
    expect(validateStep(form, 4)).toEqual({});
  });

  it('accepts requirement when only email is present', () => {
    const form = {
      ...initialRequirement(),
      eventName: 'Launch',
      eventType: 'Conference',
      startDate: '2026-11-04',
      location: 'Mumbai',
      category: 'planner' as const,
      phone: '',
      email: 'contact@example.com',
      details: { budget: '100000', guestCount: '70', planningScope: 'Full planning' }
    };
    expect(validateStep(form, 3)).toEqual({});
    expect(validateStep(form, 4)).toEqual({});
  });
  it('rejects a reversed date range', () => {
    const form = { ...initialRequirement(), dateType: 'range' as const, startDate: '2026-11-05', endDate: '2026-11-04' };
    expect(validateStep(form, 1).endDate).toMatch(/after/);
  });

  it('validates phone number and email address formats', () => {
    const invalidContact = {
      ...initialRequirement(),
      eventName: 'Launch',
      eventType: 'Conference',
      startDate: '2026-11-04',
      location: 'Mumbai',
      category: 'planner' as const,
      details: { budget: '100000', guestCount: '70', planningScope: 'Full planning' },
      phone: '123', // too short
      email: 'not-an-email'
    };
    const errors = validateStep(invalidContact, 3);
    expect(errors.phone).toMatch(/valid phone number/);
    expect(errors.email).toMatch(/valid email address/);

    const validContact = {
      ...invalidContact,
      phone: '+91 98765 43210',
      email: 'organizer@event.com'
    };
    expect(validateStep(validContact, 3)).toEqual({});
    expect(validateStep(validContact, 4)).toEqual({});
  });
});
