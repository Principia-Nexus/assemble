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
      <ul className="divide-y divide-slate-100 sm:hidden" data-testid={`${testPrefix}-schedule-list`}>
        {version.sites.map((s) => {
          const a = version.assignments[s.site_id] || {};
          const late = a.week != null && s.deadline_week != null && a.week > s.deadline_week;
          return (
            <li key={s.site_id} className="flex items-start justify-between gap-3 px-4 py-2">
              <span className="min-w-0"><span className="text-xs font-semibold text-slate-900">{s.name || s.site_id}</span>
                <span className="block text-[11px] text-slate-500">due {s.deadline_week == null ? "unknown" : `wk ${s.deadline_week}`}</span></span>
              <span className={cn("shrink-0 rounded px-2 py-1 text-[11px] font-semibold", a.week ? (late ? "bg-red-100 text-red-800" : color(a.owner)) : "text-slate-400")}>
                {a.week ? `Wk ${a.week} · ${name(a.owner)}${late ? " · late" : ""}` : "unassigned"}
              </span>
            </li>
          );
        })}
        <li className="flex flex-wrap gap-x-4 gap-y-1 bg-slate-50 px-4 py-2 font-mono text-[11px]">
          {checker.weekly.map((w) => <span key={w.week} className={w.gap > 0 ? "font-semibold text-red-700" : "text-slate-700"}>Wk {w.week}: {w.load}/{w.capacity}{w.capacity_partial ? "+?" : ""}</span>)}
        </li>
      </ul>
      <div className="hidden sm:block">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="font-mono text-[10px] text-slate-500">
              <th className="w-[34%] px-4 py-2 text-left font-semibold">Site</th>
              {Array.from({ length: weeks }).map((_, i) => (
                <th key={i} className="px-2 py-2 text-left font-semibold">Week {i + 1}<span className="block normal-case tracking-normal text-slate-400">{weekStart(i + 1) ? fmtDate(weekStart(i + 1)) : "date unknown"}</span></th>
              ))}
            </tr>
          </thead>
          <tbody key={version.version_id} className="rows-in">
            {version.sites.map((s, idx) => {
              const a = version.assignments[s.site_id] || {};
              return (
                <tr key={s.site_id} className="border-t border-slate-100" style={{ "--i": idx }}>
                  <td className="px-4 py-1.5"><span className="text-xs font-semibold text-slate-900">{s.name || s.site_id}</span>
                    {s.name && <span className="ml-1.5 font-mono text-[10px] text-slate-400">{s.site_id}</span>}
                    <span className="block text-[11px] text-slate-500">due {s.deadline_week == null ? "unknown" : weekStart(s.deadline_week) ? `week of ${fmtDate(weekStart(s.deadline_week))}` : `wk ${s.deadline_week}`}</span></td>
                  {Array.from({ length: weeks }).map((_, i) => {
                    const w = i + 1;
                    const here = a.week === w;
                    const late = here && s.deadline_week != null && w > s.deadline_week;
                    return (
                      <td key={w} className={cn("break-words px-3 py-2 text-xs font-semibold", here && (late ? "bg-red-100 text-red-800" : color(a.owner)))}
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
