export const categories = ['planner', 'performer', 'crew'] as const;
export type Category = (typeof categories)[number];

export type EventBasics = {
  eventName: string;
  eventType: string;
  dateType: 'single' | 'range';
  startDate: string;
  endDate: string;
  location: string;
  venue: string;
  category: Category | '';
};

export type PlannerDetails = {
  budget: string;
  guestCount: string;
  planningScope: string;
};

export type PerformerDetails = {
  performanceType: string;
  durationMinutes: string;
  equipmentProvided: string;
};

export type CrewDetails = {
  crewRole: string;
  shiftHours: string;
  teamSize: string;
};

export type RequirementForm = EventBasics & {
  details: PlannerDetails | PerformerDetails | CrewDetails;
  notes: string;
  clientSubmissionId: string;
};

export const categoryLabel: Record<Category, string> = {
  planner: 'Event Planner',
  performer: 'Performer',
  crew: 'Crew'
};

export const emptyDetails = (category: Category | ''): RequirementForm['details'] => {
  switch (category) {
    case 'planner': return { budget: '', guestCount: '', planningScope: '' };
    case 'performer': return { performanceType: '', durationMinutes: '', equipmentProvided: '' };
    case 'crew': return { crewRole: '', shiftHours: '', teamSize: '' };
    default: return { budget: '', guestCount: '', planningScope: '' };
  }
};

export const initialRequirement = (): RequirementForm => ({
  eventName: '', eventType: '', dateType: 'single', startDate: '', endDate: '',
  location: '', venue: '', category: '', details: emptyDetails(''), notes: '',
  clientSubmissionId: crypto.randomUUID()
});
