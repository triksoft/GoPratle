import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type BaseProps = { label: string; error?: string; hint?: string; children?: ReactNode };
export function FieldShell({ label, error, hint, children }: BaseProps) {
  return <label className="block">
    <span className="field-label">{label}</span>{children}
    {hint && !error && <span className="mt-1.5 block text-sm text-slate-500">{hint}</span>}
    {error && <span className="field-error" role="alert">{error}</span>}
  </label>;
}

type TextProps = BaseProps & InputHTMLAttributes<HTMLInputElement>;
export function TextField({ label, error, hint, ...props }: TextProps) {
  return <FieldShell label={label} error={error} hint={hint}><input className="field" aria-invalid={Boolean(error)} {...props} /></FieldShell>;
}

type AreaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;
export function TextArea({ label, error, hint, ...props }: AreaProps) {
  return <FieldShell label={label} error={error} hint={hint}><textarea className="field min-h-28 resize-y" aria-invalid={Boolean(error)} {...props} /></FieldShell>;
}
