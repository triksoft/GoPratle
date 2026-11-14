import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarPage from './page';
import * as api from '@/lib/api';
import { getNextDayStr } from '@/lib/format';
import type { RequirementsResponse, StoredRequirement } from '@/types/requirement';

let lastRenderedEvents: any[] = [];

vi.mock('@fullcalendar/react', () => {
  return {
    default: (props: any) => {
      lastRenderedEvents = props.events || [];
      return (
        <div data-testid="fullcalendar-mock">
          {props.events?.map((e: any) => (
            <div
              key={e.id}
              data-testid={`event-${e.id}`}
              data-start={e.start}
              data-end={e.end}
              onClick={(jsEvent) => props.eventClick?.({ event: { extendedProps: e.extendedProps }, jsEvent })}
            >
              {e.title}
            </div>
          ))}
        </div>
      );
    }
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

  it('correctly calculates exclusive end-date using getNextDayStr for multi-day events', () => {
    // 2026-11-15 -> 2026-11-16
    expect(getNextDayStr('2026-11-15')).toBe('2026-11-16');
    // Month boundary: 2026-11-30 -> 2026-12-01
    expect(getNextDayStr('2026-11-30')).toBe('2026-12-01');
  });

  it('correctly maps a two-day event (Nov 14 to Nov 15) to span both days with exclusive end date', async () => {
    const twoDayReq: StoredRequirement = {
      _id: 'req-two-days',
      eventName: 'Weekend Fest',
      eventType: 'Festival',
      dateType: 'range',
      startDate: '2026-11-14',
      endDate: '2026-11-15',
      location: 'Goa',
      venue: 'Beach Resort',
      category: 'performer',
      details: { performanceType: 'DJ', durationMinutes: '180', equipmentProvided: 'Partially provided' },
      notes: '',
      clientSubmissionId: 'id-twoday',
      status: 'confirmed',
      createdAt: '2026-11-14T10:00:00.000Z',
      updatedAt: '2026-11-14T10:00:00.000Z'
    };

    vi.spyOn(api, 'fetchRequirements').mockResolvedValueOnce({
      data: [twoDayReq],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
      summary: { total: 1, planner: 0, performer: 1, crew: 0, upcoming: 1 }
    });

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('event-req-two-days')).toBeInTheDocument();
    });

    // Check mapped event in FullCalendar: start is 2026-11-14 and end is 2026-11-16 (exclusive next day)
    const mapped = lastRenderedEvents.find(e => e.id === 'req-two-days');
    expect(mapped).toBeDefined();
    expect(mapped.start).toBe('2026-11-14');
    expect(mapped.end).toBe('2026-11-16');

    // Click event to inspect modal
    fireEvent.click(screen.getByTestId('event-req-two-days'));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Weekend Fest' })).toBeInTheDocument();
      // Dashboard detail view shows readable range "2026-11-14 to 2026-11-15"
      expect(screen.getByText('2026-11-14 to 2026-11-15')).toBeInTheDocument();
    });
  });
});
