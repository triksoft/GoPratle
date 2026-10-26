export const categories = ['planner', 'performer', 'crew'] as const;
export type Category = (typeof categories)[number];

export type PlannerDetails = { budget: number; guestCount: number; planningScope: 'Full planning' | 'Partial planning' | 'Day-of coordination' };
export type PerformerDetails = { performanceType: string; durationMinutes: number; equipmentProvided: 'Yes, fully provided' | 'Partially provided' | 'No, provider should bring it' };
export type CrewDetails = { crewRole: string; shiftHours: number; teamSize: number };
export type RequirementDetails = PlannerDetails | PerformerDetails | CrewDetails;
export type RequirementInput = {
  eventName: string;
  eventType: string;
  dateType: 'single' | 'range';
  startDate: string;
  endDate?: string;
  location: string;
  venue?: string;
  category: Category;
  details: RequirementDetails;
  notes?: string;
  clientSubmissionId: string;
};
