import type { RequirementForm } from '@/types/requirement';

export type FieldErrors = Record<string, string>;

export function validateStep(form: RequirementForm, step: number): FieldErrors {
  const errors: FieldErrors = {};
  const required = (name: keyof RequirementForm, label: string) => {
    if (!String(form[name]).trim()) errors[name] = `${label} is required.`;
  };
  if (step === 1 || step === 4) {
    required('eventName', 'Event name'); required('eventType', 'Event type');
    required('startDate', 'Event date'); required('location', 'Location');
    if (!form.category) errors.category = 'Choose a category.';
    if (form.dateType === 'range') {
      if (!form.endDate) errors.endDate = 'End date is required for a date range.';
      else if (form.startDate > form.endDate) errors.endDate = 'End date must be on or after the start date.';
    }
  }
  if ((step === 2 || step === 4) && form.category === 'planner') {
    const d = form.details as { budget: string; guestCount: string; planningScope: string };
    if (!d.budget.trim()) errors.budget = 'Budget is required.';
    if (!d.guestCount || Number(d.guestCount) < 1) errors.guestCount = 'Enter at least one guest.';
    if (!d.planningScope.trim()) errors.planningScope = 'Planning scope is required.';
  }
  if ((step === 2 || step === 4) && form.category === 'performer') {
    const d = form.details as { performanceType: string; durationMinutes: string; equipmentProvided: string };
    if (!d.performanceType.trim()) errors.performanceType = 'Performance type is required.';
    if (!d.durationMinutes || Number(d.durationMinutes) < 1) errors.durationMinutes = 'Enter a duration in minutes.';
    if (!d.equipmentProvided.trim()) errors.equipmentProvided = 'Tell us whether equipment is provided.';
  }
  if ((step === 2 || step === 4) && form.category === 'crew') {
    const d = form.details as { crewRole: string; shiftHours: string; teamSize: string };
    if (!d.crewRole.trim()) errors.crewRole = 'Crew role is required.';
    if (!d.shiftHours || Number(d.shiftHours) < 1) errors.shiftHours = 'Enter shift length in hours.';
    if (!d.teamSize || Number(d.teamSize) < 1) errors.teamSize = 'Enter a team size.';
  }
  return errors;
}
