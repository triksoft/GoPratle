import type {
  AiExtractResponse,
  AiStatusResponse,
  Category,
  RequirementForm,
  RequirementStatus,
  RequirementsResponse,
  StoredRequirement
} from '@/types/requirement';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export async function createRequirement(form: RequirementForm) {
  const response = await fetch(`${apiUrl}/api/requirements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': form.clientSubmissionId
    },
    body: JSON.stringify(form)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.message ?? 'We could not submit your requirement. Please try again.', payload.code, response.status);
  }
  return payload as { message: string; requirement: { _id: string }; duplicate?: boolean };
}

export async function extractEventDetails(description: string): Promise<AiExtractResponse> {
  const response = await fetch(`${apiUrl}/api/ai/extract-event-details`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      payload.message ?? 'The AI assistant encountered an issue. Please complete the event form manually.',
      payload.code,
      response.status
    );
  }
  return payload as AiExtractResponse;
}

export async function fetchAiStatus(): Promise<AiStatusResponse> {
  const response = await fetch(`${apiUrl}/api/admin/ai-status`, {
    headers: { 'Content-Type': 'application/json' }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      status: 'unavailable',
      lastIssueAt: null,
      lastIssueType: 'STATUS_FETCH_FAILED',
      updatedAt: new Date().toISOString()
    };
  }
  return payload as AiStatusResponse;
}

export interface RequirementsQueryParams {
  page?: number;
  limit?: number;
  category?: Category | '';
  status?: RequirementStatus | '';
  eventType?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function fetchRequirements(params: RequirementsQueryParams = {}): Promise<RequirementsResponse> {
  const url = new URL(`${apiUrl}/api/requirements`);
  if (params.page) url.searchParams.set('page', String(params.page));
  if (params.limit) url.searchParams.set('limit', String(params.limit));
  if (params.category) url.searchParams.set('category', params.category);
  if (params.status) url.searchParams.set('status', params.status);
  if (params.eventType) url.searchParams.set('eventType', params.eventType);
  if (params.location) url.searchParams.set('location', params.location);
  if (params.dateFrom) url.searchParams.set('dateFrom', params.dateFrom);
  if (params.dateTo) url.searchParams.set('dateTo', params.dateTo);
  if (params.search) url.searchParams.set('search', params.search);
  if (params.sortBy) url.searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) url.searchParams.set('sortOrder', params.sortOrder);

  const response = await fetch(url.toString(), {
    headers: { 'Content-Type': 'application/json' }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.message ?? 'Failed to load requirements.', payload.code, response.status);
  }
  return payload as RequirementsResponse;
}

export async function fetchRequirementById(id: string): Promise<StoredRequirement> {
  const response = await fetch(`${apiUrl}/api/requirements/${id}`, {
    headers: { 'Content-Type': 'application/json' }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.message ?? 'Requirement not found.', payload.code, response.status);
  }
  return payload.requirement as StoredRequirement;
}

export async function updateRequirementStatus(id: string, status: RequirementStatus): Promise<StoredRequirement> {
  const response = await fetch(`${apiUrl}/api/requirements/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.message ?? 'Failed to update requirement status.', payload.code, response.status);
  }
  return payload.requirement as StoredRequirement;
}
