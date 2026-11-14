import {
  categoryLabel,
  statusLabel,
  type Category,
  type RequirementStatus
} from '@/types/requirement';

export function CategoryBadge({ category }: { category: Category | '' }) {
  if (!category) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
        Unspecified
      </span>
    );
  }

  const styles: Record<Category, string> = {
    planner: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    performer: 'bg-purple-50 text-purple-700 border border-purple-200',
    crew: 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  };

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[category] || 'bg-slate-100 text-slate-700'}`}>
      {categoryLabel[category] || category}
    </span>
  );
}

export function StatusBadge({ status }: { status: RequirementStatus }) {
  const styles: Record<RequirementStatus, string> = {
    new: 'bg-blue-50 text-blue-700 border border-blue-200',
    reviewing: 'bg-amber-50 text-amber-700 border border-amber-200',
    contacted: 'bg-purple-50 text-purple-700 border border-purple-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    closed: 'bg-slate-100 text-slate-700 border border-slate-200'
  };

  const dots: Record<RequirementStatus, string> = {
    new: 'bg-blue-500',
    reviewing: 'bg-amber-500',
    contacted: 'bg-purple-500',
    confirmed: 'bg-emerald-500',
    closed: 'bg-slate-400'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        styles[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[status] || 'bg-slate-400'}`} aria-hidden="true" />
      {statusLabel[status] || status}
    </span>
  );
}
