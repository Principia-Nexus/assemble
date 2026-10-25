import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = [
  { key: "intake", title: "Check", short: "Check" },
  { key: "draft", title: "Draft", short: "Draft" },
  { key: "ask", title: "Invite", short: "Invite" },
  { key: "decide", title: "Decide", short: "Decide" },
];

export function stepInfo(sheet) {
  const hasIntake = !!sheet.intake.weeks && sheet.intake.sites.length > 0;
  const partners = sheet.current?.partners || [];
  const failing = sheet.current?.checker.overall === "fail";
  const allAsked = partners.length > 0 && partners.every((p) => ["confirmed", "confirmed_conditional", "declined", "change_requested"].includes(p.status));
  const done = { intake: hasIntake, draft: !!sheet.current && !failing, ask: allAsked, decide: false };
  const current = sheet.preview ? "decide" : !hasIntake ? "intake" : !sheet.current || failing ? "draft" : !allAsked ? "ask" : "decide";
  return { done, current };
}

export default function Stepper({ info, selected, onSelect }) {
  return (
    <nav className="no-print mt-5 grid grid-cols-4 overflow-hidden rounded-md border border-slate-200 bg-white" aria-label="Tasks">
      {STEPS.map((s, i) => {
        const active = selected === s.key;
        return (
          <button key={s.key} onClick={() => onSelect(s.key)} data-testid={`task-step-${s.key}`} aria-label={s.title} aria-current={active ? "step" : undefined}
            className={cn("relative flex flex-col items-center gap-1 border-r border-slate-200 px-1 py-2 text-left transition-colors last:border-r-0 sm:flex-row sm:gap-2.5 sm:px-4 sm:py-2.5",
              active ? "bg-slate-900 text-white" : "hover:bg-slate-50")}>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border font-mono text-xs",
              active ? "border-white/40" : info.done[s.key] ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 text-slate-600")}>
              {info.done[s.key] && !active ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="hidden text-sm font-semibold sm:block">{s.title}</span>
              <span className="block text-xs font-semibold sm:hidden">{s.short}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}

export function TaskHeader({ step, title, lead, children }) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">Task {step} of 4</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {lead && <p className="mt-1 text-sm leading-relaxed text-slate-600">{lead}</p>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function ErrorList({ errors, testId, title = "Nothing was saved. Fix these first:" }) {
  if (!errors?.length) return null;
  return (
    <div data-testid={testId} role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}
