import { money } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

export default function GapPanel({ gap, dirty }) {
  return (
    <aside data-testid="gap-analysis-panel" className="h-fit space-y-5 rounded-md border border-slate-200 bg-white p-5 lg:sticky lg:top-20">
      <div>
        <p className="eyebrow">Gaps</p>
        {dirty && <p data-testid="gap-stale-notice" className="mt-2 rounded-sm bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">You have unsaved edits. Save to update this check.</p>}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-xs text-slate-500">Sites</dt><dd data-testid="gap-site-count" className="font-mono font-semibold">{gap.site_count}</dd></div>
        <div><dt className="text-xs text-slate-500">Ceiling</dt><dd data-testid="gap-ceiling" className="font-mono font-semibold">{money(gap.budget_ceiling_cents)}</dd></div>
        <div><dt className="text-xs text-slate-500">Partners</dt><dd className="font-mono font-semibold">{gap.partner_count}</dd></div>
        <div><dt className="text-xs text-slate-500">With known price</dt><dd className="font-mono font-semibold">{gap.priced_partner_count}</dd></div>
      </dl>
      {gap.site_count === 0 && <p data-testid="gap-no-sites-note" className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">No sites yet, so demand and shortages can't be checked.</p>}
      {gap.weekly.length > 0 && gap.site_count > 0 && (
        <table className="w-full text-xs">
          <thead><tr className="text-left font-mono text-[10px] text-slate-500"><th>Week</th><th>Due</th><th>Known capacity</th><th>Short</th></tr></thead>
          <tbody>
            {gap.weekly.map((w) => (
              <tr key={w.week} className="border-t border-slate-100" data-testid={`gap-week-${w.week}`}>
                <td className="py-1.5 font-mono">{w.week}</td>
                <td className="font-mono">{w.due}</td>
                <td className="font-mono">{w.capacity}{w.capacity_partial ? " + unknown" : ""}</td>
                <td>{w.short > 0 ? <StatusPill tone="declined" label={`${w.short} short`} /> : <span className="text-slate-400">none</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div>
        <p className="text-xs font-semibold text-slate-700">Unknowns ({gap.unknowns.length})</p>
        {gap.unknowns.length === 0 ? null : (
          <ul data-testid="gap-unknowns-list" className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
            {gap.unknowns.map((u) => (
              <li key={u} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />{u}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-700">Open conditions ({gap.open_conditions?.length || 0})</p>
        {gap.open_conditions?.length > 0 && (
          <ul data-testid="gap-conditions-list" className="mt-2 space-y-1 text-xs">
            {gap.open_conditions.map((c, i) => (
              <li key={i} className="flex items-start gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{c.scope}: {c.text}</li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
