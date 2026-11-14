export const categories = ['planner', 'performer', 'crew'] as const;
export type Category = (typeof categories)[number];

export const requirementStatuses = ['new', 'reviewing', 'contacted', 'confirmed', 'closed'] as const;
export type RequirementStatus = (typeof requirementStatuses)[number];

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

export type StoredRequirement = RequirementForm & {
  _id: string;
  status: RequirementStatus;
  createdAt: string;
  updatedAt: string;
};

export type RequirementsSummary = {
  total: number;
  planner: number;
  performer: number;
  crew: number;
  upcoming: number;
};

export type RequirementsResponse = {
  data: StoredRequirement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  summary: RequirementsSummary;
};

export type AiStatusResponse = {
  status: 'available' | 'limited' | 'unavailable';
  lastIssueAt: string | null;
  lastIssueType: string | null;
  updatedAt: string;
};

export type AiExtractResponse = {
  extracted: {
    eventName?: string;
    eventType?: string;
    dateType?: 'single' | 'range';
    startDate?: string;
    endDate?: string;
    location?: string;
    venue?: string;
    category?: Category | '';
    details?: Record<string, string>;
    notes?: string;
    missingFields?: string[];
  };
  missingFields: string[];
  suggestedStep: number;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type AiChatResponse = {
  assistantMessage: string;
  quickReplies: string[];
  extracted: AiExtractResponse['extracted'];
  missingFields: string[];
  isReadyForReview: boolean;
  suggestedStep: number;
};

export const categoryLabel: Record<Category, string> = {
  planner: 'Event Planner',
  performer: 'Performer',
  crew: 'Crew'
};

export const statusLabel: Record<RequirementStatus, string> = {
  new: 'New',
  reviewing: 'Reviewing',
  contacted: 'Contacted',
  confirmed: 'Confirmed',
  closed: 'Closed'
};

export const emptyDetails = (category: Category | ''): RequirementForm['details'] => {
  switch (category) {
    case 'planner':
      return { budget: '', guestCount: '', planningScope: '' };
    case 'performer':
      return { performanceType: '', durationMinutes: '', equipmentProvided: '' };
    case 'crew':
      return { crewRole: '', shiftHours: '', teamSize: '' };
    default:
      return { budget: '', guestCount: '', planningScope: '' };
  }
};

export const initialRequirement = (): RequirementForm => ({
  eventName: '',
  eventType: '',
  dateType: 'single',
  startDate: '',
  endDate: '',
  location: '',
  venue: '',
  category: '',
  details: emptyDetails(''),
  notes: '',
  clientSubmissionId: crypto.randomUUID()
});
