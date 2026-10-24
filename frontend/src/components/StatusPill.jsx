import { cn } from "@/lib/utils";

const TONES = {
  confirmed: "text-emerald-700 bg-emerald-50 border-emerald-200 [--dot:#10B981]",
  pending: "text-amber-700 bg-amber-50 border-amber-200 [--dot:#F59E0B]",
  declined: "text-red-700 bg-red-50 border-red-200 [--dot:#EF4444]",
  unknown: "text-slate-600 bg-slate-100 border-slate-300 [--dot:#94A3B8]",
};

export function StatusPill({ tone = "unknown", label, testId, className }) {
  return (
    <span
      data-testid={testId}
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--dot)]" aria-hidden />
      {label}
    </span>
  );
}

export function SyntheticTag({ className }) {
  return (
    <span className={cn("inline-flex items-center rounded-sm border border-amber-300 bg-amber-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-amber-800", className)}>
      Synthetic
    </span>
  );
}
