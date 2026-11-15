'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CategoryBadge, StatusBadge } from '@/components/Badges';
import { updateRequirementStatus } from '@/lib/api';
import { formatBudgetDisplay } from '@/lib/format';
import {
  categoryLabel,
  requirementStatuses,
  statusLabel,
  type Category,
  type RequirementStatus,
  type StoredRequirement
} from '@/types/requirement';

type Props = {
  requirement: StoredRequirement | null;
  onClose: () => void;
  onStatusUpdated?: (updated: StoredRequirement) => void;
};

export function RequirementDetailModal({ requirement, onClose, onStatusUpdated }: Props) {
  const [updating, setUpdating] = useState(false);
  const [currentReq, setCurrentReq] = useState<StoredRequirement | null>(requirement);
  const [errorMsg, setErrorMsg] = useState('');

  if (!currentReq) return null;

  const handleStatusChange = async (newStatus: RequirementStatus) => {
    if (newStatus === currentReq.status) return;
    setUpdating(true);
    setErrorMsg('');
    try {
      const updated = await updateRequirementStatus(currentReq._id, newStatus);
      setCurrentReq(updated);
      if (onStatusUpdated) onStatusUpdated(updated);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const formattedDate =
    currentReq.dateType === 'range' && currentReq.endDate
      ? `${currentReq.startDate} to ${currentReq.endDate}`
      : currentReq.startDate;

  const detailsList: [string, string][] = [];
  if (currentReq.category === 'planner') {
    const d = currentReq.details as any;
    if (d.budget) detailsList.push(['Estimated Budget', formatBudgetDisplay(d.budget)]);
    if (d.guestCount) detailsList.push(['Expected Guests', String(d.guestCount)]);
    if (d.planningScope) detailsList.push(['Planning Scope', String(d.planningScope)]);
  } else if (currentReq.category === 'performer') {
    const d = currentReq.details as any;
    if (d.performanceType) detailsList.push(['Performance Type', String(d.performanceType)]);
    if (d.durationMinutes) detailsList.push(['Duration', `${d.durationMinutes} minutes`]);
    if (d.equipmentProvided) detailsList.push(['Equipment Provided', String(d.equipmentProvided)]);
  } else if (currentReq.category === 'crew') {
    const d = currentReq.details as any;
    if (d.crewRole) detailsList.push(['Crew Role', String(d.crewRole)]);
    if (d.shiftHours) detailsList.push(['Shift Length', `${d.shiftHours} hours`]);
    if (d.teamSize) detailsList.push(['Team Size', `${d.teamSize} people`]);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl transition-all sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CategoryBadge category={currentReq.category} />
              <StatusBadge status={currentReq.status} />
            </div>
            <h2 id="modal-title" className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
              {currentReq.eventName}
            </h2>
            <p className="text-xs text-slate-500">
              Type: <span className="font-medium text-slate-700">{currentReq.eventType}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Close modal"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        {/* Content */}
        <div className="mt-5 space-y-5 text-sm">
          {/* Quick Status Updater */}
          <div className="flex flex-wrap items-center justify-between rounded-xl bg-slate-50 p-3.5 border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-slate-700">Update Status:</span>
              <p className="text-[11px] text-slate-500">Keep providers and admins aligned.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Update Requirement Status"
                value={currentReq.status}
                onChange={e => handleStatusChange(e.target.value as RequirementStatus)}
                disabled={updating}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {requirementStatuses.map(s => (
                  <option key={s} value={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </select>
              {updating && <span className="text-xs text-indigo-600 animate-pulse">Saving…</span>}
            </div>
          </div>

          {/* Schedule & Location */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Date & Schedule
              </span>
              <p className="mt-1 font-medium text-slate-900">{formattedDate}</p>
              <p className="text-xs text-slate-500 capitalize">{currentReq.dateType} date event</p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Location & Venue
              </span>
              <p className="mt-1 font-medium text-slate-900">{currentReq.location}</p>
              <p className="text-xs text-slate-500">
                {currentReq.venue ? currentReq.venue : 'No specific venue specified'}
              </p>
            </div>
          </div>

          {/* Category Details */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {currentReq.category && currentReq.category in categoryLabel
                ? categoryLabel[currentReq.category as Category]
                : 'Category'}{' '}
              Requirements
            </span>
            <dl className="mt-2.5 grid gap-x-6 gap-y-3 sm:grid-cols-3">
              {detailsList.map(([key, val]) => (
                <div key={key}>
                  <dt className="text-xs text-slate-500">{key}</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{val}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Contact Details */}
          {(currentReq.phone || currentReq.email) && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Contact Information
              </span>
              <dl className="mt-2.5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Phone Number</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {currentReq.phone ? (
                      <a href={`tel:${currentReq.phone}`} className="text-indigo-600 hover:underline">
                        {currentReq.phone}
                      </a>
                    ) : (
                      'Not provided'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Email Address</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {currentReq.email ? (
                      <a href={`mailto:${currentReq.email}`} className="text-indigo-600 hover:underline">
                        {currentReq.email}
                      </a>
                    ) : (
                      'Not provided'
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Notes */}
          {currentReq.notes && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Additional Notes
              </span>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{currentReq.notes}</p>
            </div>
          )}

          {/* Metadata Footer */}
          <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-400 flex flex-wrap justify-between gap-2">
            <span>ID: <code className="font-mono text-slate-600">{currentReq._id}</code></span>
            <span>
              Submitted:{' '}
              {new Date(currentReq.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </span>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <Link
            href={`/dashboard/requirements/${currentReq._id}`}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Open standalone page →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
