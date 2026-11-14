'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CategoryBadge, StatusBadge } from '@/components/Badges';
import { fetchRequirementById, updateRequirementStatus } from '@/lib/api';
import { formatBudgetDisplay } from '@/lib/format';
import {
  categoryLabel,
  requirementStatuses,
  statusLabel,
  type Category,
  type RequirementStatus,
  type StoredRequirement
} from '@/types/requirement';

export default function RequirementDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');

  const [req, setReq] = useState<StoredRequirement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchRequirementById(id)
      .then(setReq)
      .catch(err => setError(err?.message || 'Requirement not found.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (newStatus: RequirementStatus) => {
    if (!req || newStatus === req.status) return;
    setUpdating(true);
    try {
      const updated = await updateRequirementStatus(req._id, newStatus);
      setReq(updated);
    } catch (err: any) {
      alert(err?.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500">
        <svg className="mx-auto h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
        <p className="mt-3 text-sm">Loading requirement details…</p>
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <p className="font-semibold text-lg">{error || 'Requirement not found.'}</p>
          <div className="mt-4">
            <Link
              href="/dashboard"
              className="inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const formattedDate =
    req.dateType === 'range' && req.endDate ? `${req.startDate} to ${req.endDate}` : req.startDate;

  const detailsList: [string, string][] = [];
  if (req.category === 'planner') {
    const d = req.details as any;
    if (d.budget) detailsList.push(['Estimated Budget', formatBudgetDisplay(d.budget)]);
    if (d.guestCount) detailsList.push(['Expected Guests', String(d.guestCount)]);
    if (d.planningScope) detailsList.push(['Planning Scope', String(d.planningScope)]);
  } else if (req.category === 'performer') {
    const d = req.details as any;
    if (d.performanceType) detailsList.push(['Performance Type', String(d.performanceType)]);
    if (d.durationMinutes) detailsList.push(['Duration', `${d.durationMinutes} minutes`]);
    if (d.equipmentProvided) detailsList.push(['Equipment Provided', String(d.equipmentProvided)]);
  } else if (req.category === 'crew') {
    const d = req.details as any;
    if (d.crewRole) detailsList.push(['Crew Role', String(d.crewRole)]);
    if (d.shiftHours) detailsList.push(['Shift Length', `${d.shiftHours} hours`]);
    if (d.teamSize) detailsList.push(['Team Size', `${d.teamSize} people`]);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="text-xs font-semibold text-slate-600 hover:text-indigo-600 flex items-center gap-1"
        >
          ← Back to Dashboard
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Status:</span>
          <select
            value={req.status}
            onChange={e => handleStatusChange(e.target.value as RequirementStatus)}
            disabled={updating}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {requirementStatuses.map(s => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
          {updating && <span className="text-xs text-indigo-600 animate-pulse">Updating…</span>}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <CategoryBadge category={req.category} />
            <StatusBadge status={req.status} />
          </div>
          <h1 className="mt-3 text-2xl font-bold text-slate-950 sm:text-3xl">{req.eventName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Event Type: <span className="font-semibold text-slate-800">{req.eventType}</span>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Date & Schedule
            </span>
            <p className="mt-1.5 text-base font-semibold text-slate-900">{formattedDate}</p>
            <p className="text-xs text-slate-500 capitalize">{req.dateType} event</p>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Location & Venue
            </span>
            <p className="mt-1.5 text-base font-semibold text-slate-900">{req.location}</p>
            <p className="text-xs text-slate-500">{req.venue || 'No specific venue'}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {req.category && req.category in categoryLabel ? categoryLabel[req.category as Category] : 'Category'} Requirements
          </span>
          <dl className="mt-3 grid gap-4 sm:grid-cols-3">
            {detailsList.map(([key, val]) => (
              <div key={key}>
                <dt className="text-xs text-slate-500">{key}</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">{val}</dd>
              </div>
            ))}
          </dl>
        </div>

        {req.notes && (
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Additional Notes
            </span>
            <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{req.notes}</p>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4 text-xs text-slate-400 flex flex-wrap justify-between gap-3">
          <div>
            Requirement ID: <code className="font-mono text-slate-700">{req._id}</code>
          </div>
          <div>
            Idempotency Key: <code className="font-mono text-slate-700">{req.clientSubmissionId}</code>
          </div>
          <div>
            Submitted: {new Date(req.createdAt).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </div>
  );
}
