import { FieldShell, TextField } from '@/components/FormField';
import type { FieldErrors } from '@/lib/validation';
import type { RequirementForm } from '@/types/requirement';

type Props = { form: RequirementForm; errors: FieldErrors; onDetailsChange: (patch: Record<string, string>) => void };
export function CategoryDetails({ form, errors, onDetailsChange }: Props) {
  if (!form.category) return <div className="rounded-xl bg-amber-50 p-4 text-amber-900">Choose a category in Event basics before continuing.</div>;
  const heading = form.category === 'planner' ? 'Plan it your way' : form.category === 'performer' ? 'Set the stage' : 'Build your crew';
  return <div className="space-y-5"><div><h2 className="text-xl font-bold">{heading}</h2><p className="mt-1 text-slate-600">These details will make your brief more useful.</p></div>
    {form.category === 'planner' && <Planner details={form.details as { budget: string; guestCount: string; planningScope: string }} errors={errors} update={onDetailsChange} />}
    {form.category === 'performer' && <Performer details={form.details as { performanceType: string; durationMinutes: string; equipmentProvided: string }} errors={errors} update={onDetailsChange} />}
    {form.category === 'crew' && <Crew details={form.details as { crewRole: string; shiftHours: string; teamSize: string }} errors={errors} update={onDetailsChange} />}
  </div>;
}

function Planner({ details, errors, update }: { details: { budget: string; guestCount: string; planningScope: string }; errors: FieldErrors; update: (p: Record<string, string>) => void }) {
  return <div className="grid gap-5 sm:grid-cols-2"><TextField label="Estimated budget (₹)" inputMode="numeric" value={details.budget} onChange={e => update({ budget: e.target.value })} error={errors.budget} placeholder="e.g. 500000" required /><TextField label="Expected guests" type="number" min="1" value={details.guestCount} onChange={e => update({ guestCount: e.target.value })} error={errors.guestCount} placeholder="e.g. 150" required /><div className="sm:col-span-2"><FieldShell label="Planning scope" error={errors.planningScope}><select className="field" value={details.planningScope} onChange={e => update({ planningScope: e.target.value })} required><option value="">Select a scope</option><option value="Full planning">Full planning</option><option value="Partial planning">Partial planning</option><option value="Day-of coordination">Day-of coordination</option></select></FieldShell></div></div>;
}

function Performer({ details, errors, update }: { details: { performanceType: string; durationMinutes: string; equipmentProvided: string }; errors: FieldErrors; update: (p: Record<string, string>) => void }) {
  return <div className="grid gap-5 sm:grid-cols-2"><TextField label="Performance type" value={details.performanceType} onChange={e => update({ performanceType: e.target.value })} error={errors.performanceType} placeholder="e.g. Live band, DJ, emcee" required /><TextField label="Required duration (minutes)" type="number" min="1" value={details.durationMinutes} onChange={e => update({ durationMinutes: e.target.value })} error={errors.durationMinutes} placeholder="e.g. 120" required /><div className="sm:col-span-2"><FieldShell label="Will you provide equipment?" error={errors.equipmentProvided}><select className="field" value={details.equipmentProvided} onChange={e => update({ equipmentProvided: e.target.value })} required><option value="">Select an option</option><option value="Yes, fully provided">Yes, fully provided</option><option value="Partially provided">Partially provided</option><option value="No, provider should bring it">No, provider should bring it</option></select></FieldShell></div></div>;
}

function Crew({ details, errors, update }: { details: { crewRole: string; shiftHours: string; teamSize: string }; errors: FieldErrors; update: (p: Record<string, string>) => void }) {
  return <div className="grid gap-5 sm:grid-cols-2"><TextField label="Crew role" value={details.crewRole} onChange={e => update({ crewRole: e.target.value })} error={errors.crewRole} placeholder="e.g. Lighting technician" required /><TextField label="Shift length (hours)" type="number" min="1" value={details.shiftHours} onChange={e => update({ shiftHours: e.target.value })} error={errors.shiftHours} placeholder="e.g. 8" required /><TextField label="Number of people needed" type="number" min="1" value={details.teamSize} onChange={e => update({ teamSize: e.target.value })} error={errors.teamSize} placeholder="e.g. 4" required /></div>;
}
