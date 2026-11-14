import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarPage from './page';
import * as api from '@/lib/api';
import type { RequirementsResponse, StoredRequirement } from '@/types/requirement';

vi.mock('@fullcalendar/react', () => {
  return {
    default: (props: any) => (
      <div data-testid="fullcalendar-mock">
        {props.events?.map((e: any) => (
          <div
            key={e.id}
            data-testid={`event-${e.id}`}
            onClick={(jsEvent) => props.eventClick?.({ event: { extendedProps: e.extendedProps }, jsEvent })}
          >
            {e.title}
          </div>
        ))}
      </div>
    )
  };
});

const reqNew: StoredRequirement = {
  _id: 'req-new',
  eventName: 'Summer Music Fest',
  eventType: 'Concert',
  dateType: 'single',
  startDate: '2026-11-20',
  endDate: '',
  location: 'Bangalore',
  venue: 'Palace Grounds',
  category: 'performer',
  details: { performanceType: 'Band', durationMinutes: '120', equipmentProvided: 'Yes, fully provided' },
  notes: '',
  clientSubmissionId: 'id-1',
  status: 'new',
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z'
};

const reqConfirmed: StoredRequirement = {
  _id: 'req-confirmed',
  eventName: 'Tech Summit 2026',
  eventType: 'Conference',
  dateType: 'range',
  startDate: '2026-11-25',
  endDate: '2026-11-27',
  location: 'Hyderabad',
  venue: 'HICC',
  category: 'planner',
  details: { budget: '500000', guestCount: '300', planningScope: 'Full planning' },
  notes: '',
  clientSubmissionId: 'id-2',
  status: 'confirmed',
  createdAt: '2026-11-14T10:00:00.000Z',
  updatedAt: '2026-11-14T10:00:00.000Z'
};

const reqClosed: StoredRequirement = {
  _id: 'req-closed',
  eventName: 'Old Archived Meetup',
  eventType: 'Meetup',
  dateType: 'single',
  startDate: '2026-11-10',
  endDate: '',
  location: 'Delhi',
  venue: 'India Habitat Centre',
  category: 'crew',
  details: { crewRole: 'Sound', shiftHours: '6', teamSize: '2' },
  notes: '',
  clientSubmissionId: 'id-3',
  status: 'closed',
  createdAt: '2026-11-10T10:00:00.000Z',
  updatedAt: '2026-11-10T10:00:00.000Z'
};

describe('CalendarPage (Closed Event Handling)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('queries backend with excludeStatus=closed and defensively excludes closed events from calendar', async () => {
    const fetchSpy = vi.spyOn(api, 'fetchRequirements').mockResolvedValueOnce({
      // Even if backend were to return a closed item, calendar defensively ignores it
      data: [reqNew, reqConfirmed, reqClosed],
      pagination: { page: 1, limit: 100, total: 3, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      summary: { total: 3, planner: 1, performer: 1, crew: 1, upcoming: 2 }
    });

    render(<CalendarPage />);

    expect(fetchSpy).toHaveBeenCalledWith({ limit: 100, excludeStatus: 'closed' });

    await waitFor(() => {
      expect(screen.getByTestId('event-req-new')).toBeInTheDocument();
      expect(screen.getByTestId('event-req-confirmed')).toBeInTheDocument();
    });

    // Defensively excluded
    expect(screen.queryByTestId('event-req-closed')).not.toBeInTheDocument();
    expect(screen.queryByText(/old archived meetup/i)).not.toBeInTheDocument();
  });

  it('immediately removes requirement from calendar without page reload when status is changed to closed in modal', async () => {
    vi.spyOn(api, 'fetchRequirements').mockResolvedValueOnce({
      data: [reqNew, reqConfirmed],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      summary: { total: 2, planner: 1, performer: 1, crew: 0, upcoming: 2 }
    });

    vi.spyOn(api, 'updateRequirementStatus').mockResolvedValueOnce({
      ...reqNew,
      status: 'closed'
    });

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('event-req-new')).toBeInTheDocument();
    });

    // Click event to open detail modal
    fireEvent.click(screen.getByTestId('event-req-new'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Summer Music Fest' })).toBeInTheDocument();
    });

    // Change status to closed in modal
    const select = screen.getByLabelText(/status/i);
    fireEvent.change(select, { target: { value: 'closed' } });

    // The event is immediately removed from the calendar
    await waitFor(() => {
      expect(screen.queryByTestId('event-req-new')).not.toBeInTheDocument();
    });

    // reqConfirmed remains visible
    expect(screen.getByTestId('event-req-confirmed')).toBeInTheDocument();
  });
});
