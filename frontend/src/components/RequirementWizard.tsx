'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AiAssistant } from '@/components/AiAssistant';
import { CategoryDetails } from '@/components/CategoryDetails';
import { EventBasics } from '@/components/EventBasics';
import { NotesStep } from '@/components/NotesStep';
import { Progress } from '@/components/Progress';
import { Review } from '@/components/Review';
import { createRequirement } from '@/lib/api';
import { validateStep, type FieldErrors } from '@/lib/validation';
import {
  emptyDetails,
  initialRequirement,
  type AiExtractResponse,
  type Category,
  type RequirementForm
} from '@/types/requirement';

export function RequirementWizard() {
  const [form, setForm] = useState<RequirementForm>(initialRequirement);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [wizardNotice, setWizardNotice] = useState('');

  const change = (patch: Partial<RequirementForm>) => {
    setForm(current => {
      const next = { ...current, ...patch };
      if (patch.category !== undefined && patch.category !== current.category) {
        next.details = emptyDetails(patch.category as Category | '');
      }
      return next;
    });
    setErrors({});
    setStatus('idle');
    setMessage('');
  };

  const changeDetails = (patch: Record<string, string>) => {
    setForm(current => ({
      ...current,
      details: { ...current.details, ...patch } as RequirementForm['details']
    }));
    setErrors({});
    setStatus('idle');
    setMessage('');
  };

  const handleApplyAiDetails = (
    extracted: AiExtractResponse['extracted'],
    suggestedStep: number
  ) => {
    setForm(current => {
      const targetCategory = (extracted.category || current.category) as Category | '';
      const baseDetails = emptyDetails(targetCategory);
      const incomingDetails = extracted.details || {};

      const mergedDetails = {
        ...baseDetails,
        ...incomingDetails
      } as RequirementForm['details'];

      return {
        ...current,
        eventName: extracted.eventName || current.eventName,
        eventType: extracted.eventType || current.eventType,
        dateType: extracted.dateType || current.dateType,
        startDate: extracted.startDate || current.startDate,
        endDate: extracted.endDate || current.endDate,
        location: extracted.location || current.location,
        venue: extracted.venue !== undefined ? extracted.venue : current.venue,
        category: targetCategory,
        details: mergedDetails,
        notes: extracted.notes || current.notes
      };
    });

    setErrors({});
    setStatus('idle');
    setMessage('');
    setWizardNotice('Details added to the form. Please review and post your requirement.');
    setStep(1);
  };

  const next = () => {
    const nextErrors = validateStep(form, step);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setStep(current => Math.min(4, current + 1));
  };

  const submit = async () => {
    const nextErrors = validateStep(form, 4);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      setMessage('Please correct the highlighted fields before submitting.');
      setStatus('error');
      return;
    }
    setStatus('submitting');
    setMessage('');
    try {
      const result = await createRequirement(form);
      setStatus('success');
      setMessage(
        result.duplicate
          ? 'This requirement was already posted. We kept the original submission.'
          : 'Your requirement has been posted successfully.'
      );
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  };

  const startAgain = () => {
    setForm(initialRequirement());
    setStep(1);
    setErrors({});
    setStatus('idle');
    setMessage('');
  };

  if (status === 'success') {
    return <Success onStartAgain={startAgain} message={message} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Top Header Bar */}
      <header className="mb-6 flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-600">GoPratle</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Post your event requirement
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-slate-600">
            Share what you need and we’ll help connect you with the right event professionals.
          </p>
        </div>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          Admin Dashboard
        </Link>
      </header>

      {/* Feature 1: Optional Plan with AI Assistant */}
      <div className="mb-6">
        <AiAssistant onApplyDetails={handleApplyAiDetails} />
      </div>

      {/* Step Wizard Form */}
      <div id="requirement-form" className="card shadow-soft scroll-mt-6">
        <Progress current={step} />

        {wizardNotice && (
          <div
            role="status"
            className="mt-6 flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-medium text-indigo-950"
          >
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{wizardNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setWizardNotice('')}
              className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {status === 'error' && message && (
          <div
            className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
            role="alert"
          >
            {message}
          </div>
        )}

        <form
          className="mt-8"
          onSubmit={e => {
            e.preventDefault();
            step === 4 ? submit() : next();
          }}
          noValidate
        >
          {step === 1 && <EventBasics form={form} errors={errors} onChange={change} />}
          {step === 2 && (
            <CategoryDetails form={form} errors={errors} onDetailsChange={changeDetails} />
          )}
          {step === 3 && <NotesStep form={form} onChange={notes => change({ notes })} />}
          {step === 4 && (
            <Review
              form={form}
              onEdit={target => {
                setErrors({});
                setStatus('idle');
                setMessage('');
                setStep(target);
              }}
            />
          )}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setStep(current => Math.max(1, current - 1))}
              disabled={step === 1 || status === 'submitting'}
              className="rounded-xl px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={status === 'submitting'}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-wait disabled:bg-indigo-400"
            >
              {status === 'submitting'
                ? 'Posting requirement…'
                : step === 4
                ? 'Post requirement'
                : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Success({ message, onStartAgain }: { message: string; onStartAgain: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4">
      <section className="card w-full text-center shadow-soft" aria-live="polite">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
          ✓
        </div>
        <h1 className="mt-5 text-2xl font-bold">Requirement received</h1>
        <p className="mt-2 text-slate-600">{message}</p>
        <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onStartAgain}
            className="w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700"
          >
            Post another requirement
          </button>
          <Link
            href="/dashboard"
            className="w-full sm:w-auto rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
          >
            View in Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
