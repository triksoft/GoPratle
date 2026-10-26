import { FieldShell, TextField } from '@/components/FormField';
import { categories, categoryLabel, type Category, type RequirementForm } from '@/types/requirement';
import type { FieldErrors } from '@/lib/validation';

type Props = { form: RequirementForm; errors: FieldErrors; onChange: (patch: Partial<RequirementForm>) => void };
export function EventBasics({ form, errors, onChange }: Props) {
  return <div className="space-y-5">
    <div><h2 className="text-xl font-bold">Tell us about the event</h2><p className="mt-1 text-slate-600">A few essentials help us match the right people.</p></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField label="Event name" value={form.eventName} onChange={e => onChange({ eventName: e.target.value })} error={errors.eventName} placeholder="e.g. Ananya & Rohan's reception" required />
      <TextField label="Event type" value={form.eventType} onChange={e => onChange({ eventType: e.target.value })} error={errors.eventType} placeholder="e.g. Wedding reception" required />
    </div>
    <fieldset><legend className="field-label">When is it?</legend><div className="flex gap-3"><label className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" checked={form.dateType === 'single'} onChange={() => onChange({ dateType: 'single', endDate: '' })} /> Single date</label><label className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" checked={form.dateType === 'range'} onChange={() => onChange({ dateType: 'range' })} /> Date range</label></div></fieldset>
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField label={form.dateType === 'single' ? 'Event date' : 'Start date'} type="date" value={form.startDate} onChange={e => onChange({ startDate: e.target.value })} error={errors.startDate} required />
      {form.dateType === 'range' && <TextField label="End date" type="date" min={form.startDate} value={form.endDate} onChange={e => onChange({ endDate: e.target.value })} error={errors.endDate} required />}
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <TextField label="City or location" value={form.location} onChange={e => onChange({ location: e.target.value })} error={errors.location} placeholder="e.g. Bengaluru, Karnataka" required />
      <TextField label="Venue (optional)" value={form.venue} onChange={e => onChange({ venue: e.target.value })} placeholder="e.g. The Leela Palace" />
    </div>
    <FieldShell label="What kind of help do you need?" error={errors.category}>
      <div className="grid gap-3 sm:grid-cols-3">
        {categories.map(category => <label key={category} className={`cursor-pointer rounded-xl border p-4 transition ${form.category === category ? 'border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600' : 'border-slate-200 hover:border-indigo-300'}`}><input className="sr-only" type="radio" name="category" checked={form.category === category} onChange={() => onChange({ category: category as Category })} /><span className="block font-semibold text-slate-900">{categoryLabel[category]}</span><span className="mt-1 block text-xs text-slate-600">{category === 'planner' ? 'Plan the whole event' : category === 'performer' ? 'Make the event memorable' : 'Get essential support'}</span></label>)}
      </div>
    </FieldShell>
  </div>;
}
