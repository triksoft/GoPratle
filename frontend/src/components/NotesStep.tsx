import { TextArea, TextField } from '@/components/FormField';
import type { FieldErrors } from '@/lib/validation';
import type { RequirementForm } from '@/types/requirement';

type Props = {
  form: RequirementForm;
  errors?: FieldErrors;
  onChange: (patch: Partial<RequirementForm>) => void;
};

export function NotesStep({ form, errors = {}, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-950">Contact details & finishing touches</h2>
        <p className="mt-1 text-sm text-slate-600">
          Provide your contact details so verified event professionals can reach out to you with proposals.
        </p>
      </div>

      {/* Contact Details Card */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">How should event providers reach you?</h3>
          <p className="text-xs text-slate-500">
            Enter your phone number or email address (or both) so we can connect you with matching professionals.
          </p>
        </div>

        {errors.contact && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
          >
            {errors.contact}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Phone number"
            type="tel"
            value={form.phone || ''}
            onChange={e => onChange({ phone: e.target.value })}
            error={errors.phone}
            placeholder="e.g. +91 98765 43210"
          />
          <TextField
            label="Email address"
            type="email"
            value={form.email || ''}
            onChange={e => onChange({ email: e.target.value })}
            error={errors.email}
            placeholder="e.g. ananya@example.com"
          />
        </div>
      </div>

      {/* Additional Notes Card */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 mb-2">Additional notes (optional)</h3>
        <TextArea
          label="Share preferences, timing constraints, or anything else"
          value={form.notes}
          onChange={e => onChange({ notes: e.target.value })}
          maxLength={1000}
          placeholder="For example: We would love a relaxed, modern feel and need set-up complete by 5 PM."
          hint={`${form.notes.length}/1000 characters`}
        />
      </div>
    </div>
  );
}
