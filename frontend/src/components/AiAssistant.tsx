'use client';

import { useState } from 'react';
import { extractEventDetails } from '@/lib/api';
import type { AiExtractResponse } from '@/types/requirement';

type Props = {
  onApplyDetails: (data: AiExtractResponse['extracted'], targetStep: number) => void;
  onContinueManually?: () => void;
};

const SAMPLE_PROMPT =
  'I need a DJ and decorator for a birthday party in Bangalore next Saturday for 100 guests with a budget of ₹80,000.';

interface ErrorState {
  title: string;
  message: string;
  code?: string;
  isRetryable: boolean;
}

function resolveFriendlyError(err: any): ErrorState {
  const code = err?.code;
  const status = err?.status;
  const rawMsg = String(err?.message || '').toLowerCase();

  // 1. Missing / unconfigured Gemini key
  if (code === 'AI_CONFIG_MISSING' || status === 503 || rawMsg.includes('not configured')) {
    return {
      title: 'AI Assistant Not Configured',
      message: 'The AI assistant is currently not configured. Please complete the event form manually.',
      code: 'AI_CONFIG_MISSING',
      isRetryable: false
    };
  }

  // 2. Quota / rate limit reached
  if (code === 'AI_LIMIT_REACHED' || status === 429 || rawMsg.includes('usage limit') || rawMsg.includes('quota')) {
    return {
      title: 'AI Usage Limit Reached',
      message: 'The AI assistant has temporarily reached its usage limit. Please complete the event form manually.',
      code: 'AI_LIMIT_REACHED',
      isRetryable: true
    };
  }

  // 3. Temporary network / timeout failure
  if (code === 'AI_NETWORK_ERROR' || status === 504 || rawMsg.includes('timed out') || rawMsg.includes('network')) {
    return {
      title: 'Connection Timed Out',
      message: 'The AI request timed out or encountered a network issue. You can retry or complete the form manually.',
      code: 'AI_NETWORK_ERROR',
      isRetryable: true
    };
  }

  // 4. Invalid AI response
  if (code === 'AI_PARSE_FAILED' || status === 422 || rawMsg.includes('could not structure')) {
    return {
      title: 'Could Not Structure Brief',
      message: 'The AI assistant could not structure the event details. Please complete the event form manually.',
      code: 'AI_PARSE_FAILED',
      isRetryable: true
    };
  }

  // Default provider fallback
  return {
    title: 'AI Assistant Temporarily Unavailable',
    message: err?.message || 'The AI assistant is temporarily unavailable. Please complete the event form manually.',
    code: code || 'AI_SERVICE_ERROR',
    isRetryable: true
  };
}

export function AiAssistant({ onApplyDetails, onContinueManually }: Props) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ missingFields: string[]; applied: boolean } | null>(null);

  const handleGenerate = async () => {
    const trimmed = description.trim();
    if (!trimmed) {
      setError({
        title: 'Description Required',
        message: 'Please describe your event before generating details.',
        isRetryable: false
      });
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessInfo(null);

    try {
      const result = await extractEventDetails(trimmed);
      setSuccessInfo({
        missingFields: result.missingFields || [],
        applied: true
      });
      onApplyDetails(result.extracted, result.suggestedStep || 1);
    } catch (err: any) {
      // Retain description on failure
      const resolved = resolveFriendlyError(err);
      setError(resolved);
    } finally {
      setLoading(false);
    }
  };

  const handleUseSample = () => {
    setDescription(SAMPLE_PROMPT);
    setError(null);
  };

  const handleContinueManually = () => {
    setError(null);
    if (onContinueManually) {
      onContinueManually();
    } else {
      const formEl = document.getElementById('requirement-form');
      if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      aria-label="Plan with AI"
      className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
              />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Plan with AI Event Assistant</h2>
            <p className="text-xs text-slate-600">
              Describe your event in plain English. We’ll auto-fill the form so you can review and submit faster.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleUseSample}
          className="self-start sm:self-auto text-xs font-semibold text-indigo-700 hover:text-indigo-900 underline underline-offset-2"
        >
          Try sample brief
        </button>
      </div>

      <div className="mt-4">
        <label htmlFor="ai-event-description" className="sr-only">
          Natural-language event description
        </label>
        <textarea
          id="ai-event-description"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="e.g. I need a DJ and decorator for a birthday party in Bangalore next Saturday for 100 guests with a budget of ₹80,000."
          className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          disabled={loading}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          Optional • Manual form below remains fully available anytime
        </span>

        {/* Primary Action Button only (avoids confusing duplicate Continue manually buttons) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-wait disabled:bg-indigo-400"
          >
            {loading ? (
              <>
                <svg
                  className="h-3.5 w-3.5 animate-spin text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
                <span>Analyzing brief…</span>
              </>
            ) : (
              <>
                <span>Generate event details</span>
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Specific Friendly Error Alert with Single Continue Manually Action */}
      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs sm:text-sm text-amber-900"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-amber-600 font-bold" aria-hidden="true">
              ⚠
            </span>
            <div className="flex-1">
              <p className="font-semibold text-amber-950">{error.title}</p>
              <p className="mt-0.5 text-xs text-amber-900">{error.message}</p>
              <div className="mt-3 flex items-center gap-2">
                {error.isRetryable && (
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition"
                  >
                    Retry AI
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleContinueManually}
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition"
                >
                  Continue manually
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success notification */}
      {successInfo?.applied && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs sm:text-sm text-emerald-900"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 text-emerald-600 font-bold" aria-hidden="true">
              ✓
            </span>
            <div className="flex-1">
              <p className="font-semibold text-emerald-950">
                AI pre-filled your event requirement details!
              </p>
              <p className="mt-0.5 text-xs text-emerald-800">
                Every field in the form below remains fully editable.
                {successInfo.missingFields.length > 0 && (
                  <span className="block mt-1">
                    Missing or unconfirmed info:{' '}
                    <strong>{successInfo.missingFields.join(', ')}</strong>. Please review these steps.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
