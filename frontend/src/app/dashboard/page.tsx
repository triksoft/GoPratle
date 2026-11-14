'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CategoryBadge, StatusBadge } from '@/components/Badges';
import { RequirementDetailModal } from '@/components/RequirementDetailModal';
import { fetchAiStatus, fetchRequirements, updateRequirementStatus } from '@/lib/api';
import {
  categories,
  categoryLabel,
  requirementStatuses,
  statusLabel,
  type AiStatusResponse,
  type Category,
  type RequirementStatus,
  type RequirementsResponse,
  type StoredRequirement
} from '@/types/requirement';

export default function DashboardPage() {
  const [data, setData] = useState<RequirementsResponse | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [status, setStatus] = useState<RequirementStatus | ''>('');
  const [eventType, setEventType] = useState('');
  const [location, setLocation] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected requirement for modal view
  const [selectedReq, setSelectedReq] = useState<StoredRequirement | null>(null);

  // Inline status updating indicator
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqsResponse, aiResponse] = await Promise.all([
        fetchRequirements({
          page,
          limit: 10,
          search: search.trim() || undefined,
          category: category || undefined,
          status: status || undefined,
          eventType: eventType.trim() || undefined,
          location: location.trim() || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        }),
        fetchAiStatus()
      ]);
      setData(reqsResponse);
      setAiStatus(aiResponse);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data. Please verify your connection.');
    } finally {
      setLoading(false);
    }
  }, [page, search, category, status, eventType, location, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleResetFilters = () => {
    setSearch('');
    setCategory('');
    setStatus('');
    setEventType('');
    setLocation('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleInlineStatusChange = async (id: string, newStatus: RequirementStatus) => {
    setUpdatingId(id);
    try {
      const updated = await updateRequirementStatus(id, newStatus);
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          data: prev.data.map(item => (item._id === id ? updated : item))
        };
      });
      if (selectedReq?._id === id) {
        setSelectedReq(updated);
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRequirementUpdated = (updated: StoredRequirement) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        data: prev.data.map(item => (item._id === updated._id ? updated : item))
      };
    });
  };

  const summary = data?.summary || { total: 0, planner: 0, performer: 0, crew: 0, upcoming: 0 };
  const pagination = data?.pagination;

  return (
    <div className="space-y-8">
      {/* Page Title & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
            Event Requirements Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Real-time MongoDB requirements, category metrics, and operational AI status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
          <Link
            href="/dashboard/calendar"
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Open Calendar
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {/* Total Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Briefs</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{summary.total}</p>
          <p className="mt-1 text-xs text-slate-500">Stored in MongoDB</p>
        </div>

        {/* Planner Card */}
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-700">Planners</p>
          <p className="mt-2 text-3xl font-bold text-indigo-950">{summary.planner}</p>
          <p className="mt-1 text-xs text-indigo-600">Full / Partial / Day-of</p>
        </div>

        {/* Performer Card */}
        <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-purple-700">Performers</p>
          <p className="mt-2 text-3xl font-bold text-purple-950">{summary.performer}</p>
          <p className="mt-1 text-xs text-purple-600">DJs, Bands, Artists</p>
        </div>

        {/* Crew Card */}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-700">Crew</p>
          <p className="mt-2 text-3xl font-bold text-emerald-950">{summary.crew}</p>
          <p className="mt-1 text-xs text-emerald-600">Tech & Support Staff</p>
        </div>

        {/* Upcoming Events Card */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-blue-700">Upcoming</p>
          <p className="mt-2 text-3xl font-bold text-blue-950">{summary.upcoming}</p>
          <p className="mt-1 text-xs text-blue-600">Scheduled on/after today</p>
        </div>

        {/* AI Assistant Status Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">AI Assistant</p>
          <div className="mt-2 flex items-center gap-2">
            {aiStatus?.status === 'available' ? (
              <>
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span className="text-sm font-bold text-emerald-700">Available</span>
              </>
            ) : aiStatus?.status === 'limited' ? (
              <>
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                <span className="text-sm font-bold text-amber-700">Usage limit reached</span>
              </>
            ) : (
              <>
                <span className="h-3 w-3 rounded-full bg-rose-500" />
                <span className="text-sm font-bold text-rose-700">Temporarily unavailable</span>
              </>
            )}
          </div>
          {aiStatus?.lastIssueAt && (
            <p className="mt-1 text-[11px] text-slate-500">
              Last issue:{' '}
              {new Date(aiStatus.lastIssueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          <p className="mt-1.5 text-[11px] font-medium text-slate-600 border-t border-slate-100 pt-1">
            Manual posting remains available
          </p>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Filter Requirements</h2>
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            Clear all filters
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          {/* Keyword Search */}
          <div className="sm:col-span-2">
            <label htmlFor="filter-search" className="block text-[11px] font-semibold uppercase text-slate-500">
              Search
            </label>
            <input
              id="filter-search"
              type="text"
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Event name, location, venue, notes…"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <label htmlFor="filter-category" className="block text-[11px] font-semibold uppercase text-slate-500">
              Category
            </label>
            <select
              id="filter-category"
              value={category}
              onChange={e => {
                setCategory(e.target.value as Category | '');
                setPage(1);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="filter-status" className="block text-[11px] font-semibold uppercase text-slate-500">
              Status
            </label>
            <select
              id="filter-status"
              value={status}
              onChange={e => {
                setStatus(e.target.value as RequirementStatus | '');
                setPage(1);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Statuses</option>
              {requirementStatuses.map(s => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Date From */}
          <div>
            <label htmlFor="filter-dateFrom" className="block text-[11px] font-semibold uppercase text-slate-500">
              Date From
            </label>
            <input
              id="filter-dateFrom"
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Date To */}
          <div>
            <label htmlFor="filter-dateTo" className="block text-[11px] font-semibold uppercase text-slate-500">
              Date To
            </label>
            <input
              id="filter-dateTo"
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Requirements Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadData}
              className="font-semibold underline hover:text-rose-950 text-xs ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading skeleton or empty or table */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <svg
              className="mx-auto h-8 w-8 animate-spin text-indigo-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <p className="mt-3 text-sm font-medium">Loading requirements from MongoDB…</p>
          </div>
        ) : !data?.data || data.data.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-2xl text-slate-400">
              📋
            </div>
            <h3 className="mt-4 text-base font-bold text-slate-900">No requirements found</h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              No requirement briefs match your current filter criteria, or none have been submitted yet.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Clear filters
              </button>
              <Link
                href="/"
                className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Post requirement
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-5 py-3.5">
                    Event
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Dates
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Location & Venue
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Submitted
                  </th>
                  <th scope="col" className="px-5 py-3.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.data.map(req => {
                  const dateDisplay =
                    req.dateType === 'range' && req.endDate
                      ? `${req.startDate} → ${req.endDate}`
                      : req.startDate;

                  return (
                    <tr
                      key={req._id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => setSelectedReq(req)}
                    >
                      <td className="px-5 py-4 font-medium text-slate-900">
                        <div className="font-semibold text-slate-900 hover:text-indigo-600">
                          {req.eventName}
                        </div>
                        <div className="text-xs text-slate-500">{req.eventType}</div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap">
                        <CategoryBadge category={req.category} />
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-700">
                        <span className="font-mono">{dateDisplay}</span>
                        <span className="block text-[11px] text-slate-400 capitalize">{req.dateType}</span>
                      </td>

                      <td className="px-4 py-4 text-xs text-slate-700 max-w-[180px] truncate">
                        <div className="font-medium">{req.location}</div>
                        {req.venue && <div className="text-[11px] text-slate-500 truncate">{req.venue}</div>}
                      </td>

                      <td
                        className="px-4 py-4 whitespace-nowrap"
                        onClick={e => e.stopPropagation()} // Prevent row click from overriding dropdown
                      >
                        <div className="flex items-center gap-2">
                          <select
                            aria-label={`Status for ${req.eventName}`}
                            value={req.status}
                            onChange={e =>
                              handleInlineStatusChange(req._id, e.target.value as RequirementStatus)
                            }
                            disabled={updatingId === req._id}
                            className="rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {requirementStatuses.map(s => (
                              <option key={s} value={s}>
                                {statusLabel[s]}
                              </option>
                            ))}
                          </select>
                          {updatingId === req._id && (
                            <span className="h-3 w-3 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500">
                        {new Date(req.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short'
                        })}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-right text-xs">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedReq(req);
                          }}
                          className="font-semibold text-indigo-600 hover:text-indigo-900 rounded px-2 py-1 hover:bg-indigo-50 transition"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-5 py-3.5 sm:px-6">
            <div className="text-xs text-slate-500">
              Showing <span className="font-medium text-slate-900">{(page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-medium text-slate-900">
                {Math.min(page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-medium text-slate-900">{pagination.total}</span> requirements
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={!pagination.hasPrevPage || loading}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs font-medium text-slate-700 px-1">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={!pagination.hasNextPage || loading}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Requirement Detail Modal */}
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
