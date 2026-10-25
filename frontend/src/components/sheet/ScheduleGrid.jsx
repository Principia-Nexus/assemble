import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";

const PALETTE = ["bg-sky-200 text-sky-950", "bg-amber-200 text-amber-950", "bg-emerald-200 text-emerald-950",
  "bg-rose-200 text-rose-950", "bg-violet-200 text-violet-950", "bg-lime-200 text-lime-950"];

export default function ScheduleGrid({ version, checker, testPrefix }) {
  const weeks = version.weeks || 0;
  const pm = Object.fromEntries(version.partners.map((p) => [p.partner_id, p]));
  const owners = [...new Set(Object.values(version.assignments).map((a) => a.owner))];
  const color = (o) => PALETTE[owners.indexOf(o) % PALETTE.length];
  const name = (o) => (o === "own" ? "Your crew" : pm[o]?.name || o);
  const weekStart = (w) => {
    if (!version.start_date) return null;
    const d = new Date(`${version.start_date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7 * (w - 1));
    return d.toISOString().slice(0, 10);
  };

  return (
    <div data-testid={`${testPrefix}-schedule-grid`} className="min-w-0 rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <p className="eyebrow">Schedule</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2 text-left font-semibold">Site</th>
              {Array.from({ length: weeks }).map((_, i) => (
                <th key={i} className="px-2 py-2 text-left font-semibold">Week {i + 1}<span className="block normal-case tracking-normal text-slate-400">{weekStart(i + 1) ? fmtDate(weekStart(i + 1)) : "date unknown"}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {version.sites.map((s) => {
              const a = version.assignments[s.site_id] || {};
              return (
                <tr key={s.site_id} className="border-t border-slate-100">
                  <td className="px-4 py-1.5"><span className="font-mono text-xs font-semibold">{s.site_id}</span>
                    <span className="ml-2 hidden text-xs text-slate-500 sm:inline">due wk {s.deadline_week ?? "unknown"}</span></td>
                  {Array.from({ length: weeks }).map((_, i) => {
                    const w = i + 1;
                    const here = a.week === w;
                    const late = here && s.deadline_week != null && w > s.deadline_week;
                    return (
                      <td key={w} className={cn("px-3 py-2 text-xs font-semibold", here && "border-x border-white", here && (late ? "bg-red-100 text-red-800" : color(a.owner)))}
                        data-testid={`${testPrefix}-cell-${s.site_id}-week-${w}`}>
                        {here && `${name(a.owner)}${late ? " · late" : ""}`}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-mono text-xs">
              <td className="px-4 py-2 font-semibold">Load / capacity</td>
              {checker.weekly.map((w) => (
                <td key={w.week} className="px-2 py-2" data-testid={`${testPrefix}-week-load-${w.week}`}>
                  <span className={cn("font-semibold", w.gap > 0 ? "text-red-700" : "text-slate-900")}>{w.load}</span>
                  <span className="text-slate-500"> / {w.capacity}{w.capacity_partial ? "+?" : ""}</span>
                  {w.gap > 0 && <span className="block text-[10px] font-semibold text-red-700">{w.gap}-slot gap</span>}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
