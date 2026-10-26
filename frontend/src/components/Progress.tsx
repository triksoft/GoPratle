const steps = ['Event basics', 'Your requirements', 'Additional notes', 'Review'];

export function Progress({ current }: { current: number }) {
  return <ol className="grid grid-cols-4 gap-1.5" aria-label="Submission progress">
    {steps.map((name, index) => {
      const step = index + 1; const active = current === step; const complete = current > step;
      return <li key={name} className="min-w-0">
        <div className={`h-1.5 rounded-full ${complete || active ? 'bg-indigo-600' : 'bg-slate-200'}`} />
        <span className={`mt-2 block truncate text-xs font-medium sm:text-sm ${active ? 'text-indigo-700' : complete ? 'text-slate-700' : 'text-slate-400'}`}>
          <span className="mr-1 sm:hidden">{step}.</span>{name}
        </span>
      </li>;
    })}
  </ol>;
}
