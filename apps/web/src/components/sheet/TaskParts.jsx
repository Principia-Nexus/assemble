export function TaskHeader({ title, lead, children }) {
  if (!lead && !children) return <h2 className="sr-only">{title}</h2>;
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-2xl">
        <h2 className="sr-only">{title}</h2>
        {lead && <p className="text-sm leading-relaxed text-slate-600">{lead}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function ErrorList({ errors, testId, title = "Nothing was saved." }) {
  if (!errors?.length) return null;
  return (
    <div data-testid={testId} role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}
