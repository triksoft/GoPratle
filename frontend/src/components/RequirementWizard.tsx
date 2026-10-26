'use client';

import { useState } from 'react';
import { CategoryDetails } from '@/components/CategoryDetails';
import { EventBasics } from '@/components/EventBasics';
import { NotesStep } from '@/components/NotesStep';
import { Progress } from '@/components/Progress';
import { Review } from '@/components/Review';
import { createRequirement } from '@/lib/api';
import { validateStep, type FieldErrors } from '@/lib/validation';
import { emptyDetails, initialRequirement, type Category, type RequirementForm } from '@/types/requirement';

export function RequirementWizard() {
  const [form, setForm] = useState<RequirementForm>(initialRequirement);
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const change = (patch: Partial<RequirementForm>) => {
    setForm(current => {
      const next = { ...current, ...patch };
      if (patch.category !== undefined && patch.category !== current.category) next.details = emptyDetails(patch.category as Category | '');
      return next;
    });
    setErrors({}); setStatus('idle'); setMessage('');
  };
  const changeDetails = (patch: Record<string, string>) => {
    setForm(current => ({ ...current, details: { ...current.details, ...patch } as RequirementForm['details'] }));
    setErrors({}); setStatus('idle'); setMessage('');
  };
  const next = () => {
    const nextErrors = validateStep(form, step);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setStep(current => Math.min(4, current + 1));
  };
  const submit = async () => {
    const nextErrors = validateStep(form, 4);
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); setMessage('Please correct the highlighted fields before submitting.'); setStatus('error'); return; }
    setStatus('submitting'); setMessage('');
    try {
      const result = await createRequirement(form);
      setStatus('success'); setMessage(result.duplicate ? 'This requirement was already posted. We kept the original submission.' : 'Your requirement has been posted successfully.');
    } catch (error) { setStatus('error'); setMessage(error instanceof Error ? error.message : 'Something went wrong. Please try again.'); }
  };
  const startAgain = () => { setForm(initialRequirement()); setStep(1); setErrors({}); setStatus('idle'); setMessage(''); };

  if (status === 'success') return <Success onStartAgain={startAgain} message={message} />;
  return <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-14"><header className="mb-8 text-center"><p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-600">GoPratle</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Post your event requirement</h1><p className="mx-auto mt-3 max-w-xl text-slate-600">Share what you need and we’ll help connect you with the right event professionals.</p></header><div className="card shadow-soft"><Progress current={step} />
    {status === 'error' && message && <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{message}</div>}
    <form className="mt-8" onSubmit={e => { e.preventDefault(); step === 4 ? submit() : next(); }} noValidate>
      {step === 1 && <EventBasics form={form} errors={errors} onChange={change} />}
      {step === 2 && <CategoryDetails form={form} errors={errors} onDetailsChange={changeDetails} />}
      {step === 3 && <NotesStep form={form} onChange={notes => change({ notes })} />}
      {step === 4 && <Review form={form} onEdit={target => { setErrors({}); setStatus('idle'); setMessage(''); setStep(target); }} />}
      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => setStep(current => Math.max(1, current - 1))} disabled={step === 1 || status === 'submitting'} className="rounded-xl px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40">Back</button><button type="submit" disabled={status === 'submitting'} className="rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-wait disabled:bg-indigo-400">{status === 'submitting' ? 'Posting requirement…' : step === 4 ? 'Post requirement' : 'Continue'}</button></div>
    </form></div></div>;
}

function Success({ message, onStartAgain }: { message: string; onStartAgain: () => void }) {
  return <div className="mx-auto flex min-h-screen max-w-xl items-center px-4"><section className="card w-full text-center shadow-soft" aria-live="polite"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700">✓</div><h1 className="mt-5 text-2xl font-bold">Requirement received</h1><p className="mt-2 text-slate-600">{message}</p><button type="button" onClick={onStartAgain} className="mt-7 rounded-xl bg-indigo-600 px-5 py-2.5 font-semibold text-white hover:bg-indigo-700">Post another requirement</button></section></div>;
}
