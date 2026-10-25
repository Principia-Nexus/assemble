import { StatusPill } from "@/components/StatusPill";
import { CHECK, OVERALL, money } from "@/lib/format";

export default function CheckerPanel({ checker, notes, title, testPrefix }) {
  const o = OVERALL[checker.overall];
  return (
    <div data-testid={`${testPrefix}-checker-panel`} className="h-fit rounded-md border border-slate-200 bg-white">
      <div className="space-y-2 border-b border-slate-200 p-4">
        <p className="eyebrow">{title}</p>
        <StatusPill testId={`${testPrefix}-checker-overall`} tone={o.tone} label={o.label} />
        <dl className="grid grid-cols-2 gap-2 pt-2 text-sm">
          <div><dt className="text-xs text-slate-500">Plan total</dt><dd data-testid={`${testPrefix}-checker-total`} className="font-mono font-semibold">{money(checker.total_cents)}</dd></div>
          <div><dt className="text-xs text-slate-500">Ceiling</dt><dd className="font-mono font-semibold">{money(checker.ceiling_cents)}</dd></div>
        </dl>
        {checker.headroom_cents != null && (
          <p className="text-[11px] text-slate-500">Budget headroom {money(checker.headroom_cents)}.</p>
        )}
      </div>
      <ul key={checker.total_cents + checker.overall} className="stagger divide-y divide-slate-100">
        {checker.rules.map((r) => (
          <li key={r.key} className="p-4" data-testid={`${testPrefix}-rule-${r.key}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">{r.label}</span>
              <StatusPill testId={`${testPrefix}-rule-${r.key}-status`} tone={CHECK[r.status].tone} label={CHECK[r.status].label} />
            </div>
            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-slate-600">
              {r.details.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </li>
        ))}
      </ul>
      <div className="space-y-2 border-t border-slate-200 bg-slate-50 p-4 text-[11px] leading-relaxed text-slate-600">
        {checker.note && <p data-testid={`${testPrefix}-checker-note`}>{checker.note}</p>}
        {notes?.length > 0 && (
          <details>
            <summary className="cursor-pointer font-semibold text-slate-700">Generator notes ({notes.length})</summary>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
          </details>
        )}
      </div>
    </div>
  );
}
