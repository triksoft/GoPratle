import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardPage from './page';
import * as api from '@/lib/api';
import type { RequirementsResponse, StoredRequirement } from '@/types/requirement';

const mockReq: StoredRequirement = {
  _id: 'req-1234567890ab',
  eventName: 'Gala Night 2026',
  eventType: 'Dinner Gala',
  dateType: 'single',
  startDate: '2026-12-15',
  endDate: '',
  location: 'Mumbai',
  venue: 'Taj Mahal Palace',
  category: 'planner',
  details: { budget: '300000', guestCount: '150', planningScope: 'Full planning' },
  notes: 'Black tie event.',
  clientSubmissionId: '550e8400-e29b-41d4-a716-446655440000',
  status: 'new',
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z'
};

const mockResponse: RequirementsResponse = {
  data: [mockReq],
  pagination: {
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  },
  summary: {
    total: 1,
    planner: 1,
    performer: 0,
    crew: 0,
    upcoming: 1
  }
};

describe('Admin Dashboard Page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'fetchAiStatus').mockResolvedValue({
      status: 'available',
      lastIssueAt: null,
      lastIssueType: null,
      updatedAt: '2026-11-14T10:00:00.000Z'
    });
  });

  it('renders summary cards, requirements table, and AI status', async () => {
    vi.spyOn(api, 'fetchRequirements').mockResolvedValueOnce(mockResponse);

    render(<DashboardPage />);

    expect(screen.getByText(/loading requirements from mongodb/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Gala Night 2026')).toBeInTheDocument();
    });

    expect(screen.getByText('Event Requirements Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Total Briefs')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Taj Mahal Palace')).toBeInTheDocument();
  });

  it('renders empty state when no requirements match filters', async () => {
    vi.spyOn(api, 'fetchRequirements').mockResolvedValueOnce({
      data: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      summary: { total: 0, planner: 0, performer: 0, crew: 0, upcoming: 0 }
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/no requirements found/i)).toBeInTheDocument();
    });
  });

  it('calls updateRequirementStatus when status dropdown is changed', async () => {
    vi.spyOn(api, 'fetchRequirements').mockResolvedValueOnce(mockResponse);
    const updateSpy = vi.spyOn(api, 'updateRequirementStatus').mockResolvedValueOnce({
      ...mockReq,
      status: 'confirmed'
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Gala Night 2026')).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/status for gala night 2026/i);
    fireEvent.change(statusSelect, { target: { value: 'confirmed' } });

    expect(updateSpy).toHaveBeenCalledWith(mockReq._id, 'confirmed');
  });

  it('keeps Refresh button and removes duplicate Open Calendar button from header', async () => {
    vi.spyOn(api, 'fetchRequirements').mockResolvedValueOnce(mockResponse);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Gala Night 2026')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open calendar/i })).not.toBeInTheDocument();
  });
});
