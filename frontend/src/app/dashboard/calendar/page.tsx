'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import listPlugin from '@fullcalendar/react/list';
import { RequirementDetailModal } from '@/components/RequirementDetailModal';
import { fetchRequirements } from '@/lib/api';
import type { Category, StoredRequirement } from '@/types/requirement';

// Dynamic import with ssr: false ensures FullCalendar runs in browser environment
const FullCalendar = dynamic(() => import('@fullcalendar/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center text-slate-400">
      <svg className="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  )
});

const categoryColors: Record<Category, { bg: string; border: string }> = {
  planner: { bg: '#4f46e5', border: '#4338ca' }, // indigo
  performer: { bg: '#9333ea', border: '#7e22ce' }, // purple
  crew: { bg: '#059669', border: '#047857' } // emerald
};

function getNextDayStr(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  } catch {
    return dateStr;
  }
}

export default function CalendarPage() {
  const [requirements, setRequirements] = useState<StoredRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const [selectedReq, setSelectedReq] = useState<StoredRequirement | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRequirements({ limit: 100 })
      .then(res => {
        setRequirements(res.data || []);
      })
      .catch(err => {
        setError(err?.message || 'Failed to load events for the calendar.');
      })
      .finally(() => setLoading(false));
  }, []);

  // Map requirements to FullCalendar events safely
  let skipped = 0;
  const events = requirements
    .filter(req => {
      if (!req.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(req.startDate)) {
        skipped++;
        return false;
      }
      return true;
    })
    .map(req => {
      const colors = categoryColors[req.category as Category] || {
        bg: '#64748b',
        border: '#475569'
      };

      const isRange = req.dateType === 'range' && req.endDate && /^\d{4}-\d{2}-\d{2}$/.test(req.endDate);

      return {
        id: req._id,
        title: `${req.eventName} (${req.eventType})`,
        start: req.startDate,
        end: isRange ? getNextDayStr(req.endDate) : undefined, // FullCalendar end date is exclusive for all-day events
        allDay: true,
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: '#ffffff',
        extendedProps: {
          requirement: req
        }
      };
    });

  // Track skipped malformed count
  if (skipped !== skippedCount && !loading) {
    setSkippedCount(skipped);
  }

  const handleEventClick = (info: any) => {
    info.jsEvent.preventDefault();
    const req = info.event.extendedProps?.requirement;
    if (req) {
      setSelectedReq(req);
    }
  };

  const handleRequirementUpdated = (updated: StoredRequirement) => {
    setRequirements(prev => prev.map(item => (item._id === updated._id ? updated : item)));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Event Calendar
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            View submitted event schedules, multi-day milestones, and category assignments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← Back to Table Overview
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            + Post Requirement
          </Link>
        </div>
      </div>

      {/* Category Legend & Skipped Warning */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-slate-700">Categories:</span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="h-3 w-3 rounded-full bg-indigo-600" />
            Event Planner
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="h-3 w-3 rounded-full bg-purple-600" />
            Performer
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="h-3 w-3 rounded-full bg-emerald-600" />
            Crew
          </span>
        </div>

        {skippedCount > 0 && (
          <span className="text-amber-700 font-medium">
            ⚠ {skippedCount} requirement(s) with missing dates skipped safely.
          </span>
        )}
      </div>

      {/* Calendar Container */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
        {error ? (
          <div className="p-6 text-center text-rose-800 bg-rose-50 rounded-xl border border-rose-200">
            <p className="font-semibold text-sm">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="calendar-wrapper">
            <FullCalendar
              plugins={[dayGridPlugin, listPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,listMonth'
              }}
              events={events}
              eventClick={handleEventClick}
              height="auto"
              dayMaxEvents={3}
            />
          </div>
        )}
      </div>

      {/* Modal View on Event Click */}
      {selectedReq && (
        <RequirementDetailModal
          requirement={selectedReq}
          onClose={() => setSelectedReq(null)}
          onStatusUpdated={handleRequirementUpdated}
        />
      )}
    </div>
  );
}
