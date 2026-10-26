import { TextArea } from '@/components/FormField';
import type { RequirementForm } from '@/types/requirement';

export function NotesStep({ form, onChange }: { form: RequirementForm; onChange: (notes: string) => void }) {
  return <div className="space-y-5"><div><h2 className="text-xl font-bold">Any finishing touches?</h2><p className="mt-1 text-slate-600">Share preferences, timing constraints, or anything else that will help. This is optional.</p></div><TextArea label="Additional notes" value={form.notes} onChange={e => onChange(e.target.value)} maxLength={1000} placeholder="For example: We would love a relaxed, modern feel and need set-up complete by 5 PM." hint={`${form.notes.length}/1000 characters`} /></div>;
}
