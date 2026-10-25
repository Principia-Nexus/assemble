import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { firmName, planVersion } from "./derive";

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monday = (s) => { const d = new Date(`${s}T00:00:00Z`); return addDays(s, -((d.getUTCDay() + 6) % 7)); };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Dated work items by day; plan site-weeks shown as provisional week entries when the job has a start date.
export default function WeekView({ sheet, items, onSelect, selectedId, filter }) {
  const start = sheet.intake.start_date;
  const firstDated = items.map((i) => i.due_date || i.start_date).filter(Boolean).sort()[0];
  const [week, setWeek] = useState(() => monday(start || firstDated || iso(new Date())));
  const days = DAYS.map((_, i) => addDays(week, i));
  const dated = items.filter((i) => (i.due_date || i.start_date) && filter(i));
  const undated = items.filter((i) => i.kind !== "group" && !i.due_date && !i.start_date && filter(i));
  const planWeek = useMemo(() => {
    const v = planVersion(sheet);
    if (!v || !start) return [];
    const n = Math.floor((new Date(`${week}T00:00:00Z`) - new Date(`${monday(start)}T00:00:00Z`)) / 6048e5) + 1;
    const by = {};
    for (const s of v.sites || []) {
      const a = v.assignments?.[s.site_id];
      if (a?.week === n) (by[a.owner] ||= []).push(s.site_id);
    }
    return Object.entries(by).map(([owner, sites]) => ({ owner, sites, n }));
  }, [sheet, start, week]);
  const on = (d) => dated.filter((i) => (i.due_date || i.start_date) === d || (i.start_date && i.due_date && i.start_date <= d && d <= i.due_date));

  return (
    <div className="h-full overflow-auto px-4 py-5 sm:px-6" data-testid="week-view">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-3 flex items-center gap-2">
          <Button size="icon" variant="outline" className="h-8 w-8 bg-[#FFFFFF]" onClick={() => setWeek(addDays(week, -7))} aria-label="Previous week" data-testid="week-prev"><ChevronLeft className="h-4 w-4" /></Button>
          <p className="text-sm font-semibold text-[#1A2838]" data-testid="week-label">Week of {week}</p>
          <Button size="icon" variant="outline" className="h-8 w-8 bg-[#FFFFFF]" onClick={() => setWeek(addDays(week, 7))} aria-label="Next week" data-testid="week-next"><ChevronRight className="h-4 w-4" /></Button>
        </div>
        {planWeek.length > 0 && (
          <div className="mb-3 rounded-xl border border-dashed border-[#215273]/40 bg-[#E4EFF6]/60 p-3 text-[12.5px] text-[#1A2838]" data-testid="week-plan">
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#215273]">Plan week {planWeek[0].n} · provisional, not a reserved crew</p>
            {planWeek.map((p) => <p key={p.owner}><span className="font-medium">{firmName(sheet, p.owner)}</span> · {p.sites.join(", ")}</p>)}
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
          {days.map((d, i) => (
            <div key={d} className="min-h-[120px] rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-2" data-testid={`week-day-${d}`}>
              <p className="mb-1.5 font-mono text-[10.5px] text-[#64748B]">{DAYS[i]} {d.slice(5)}</p>
              {on(d).map((it) => (
                <button key={it.item_id} type="button" onClick={() => onSelect(it.item_id)} data-testid={`week-item-${it.item_id}-${d}`}
                  className={`mb-1 block w-full rounded-lg border border-[#E2E8F0] bg-white px-2 py-1 text-left text-[12px] leading-snug text-[#1A2838] hover:border-[#215273] ${selectedId === it.item_id ? "ring-2 ring-[#215273]" : ""}`}>
                  {it.title}<span className="block text-[10px] text-[#64748B]">{it.date_kind || "date"}{it.firm_id ? ` · ${firmName(sheet, it.firm_id)}` : ""}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <section className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3" data-testid="week-unscheduled">
          <p className="mb-2 text-[13px] font-semibold text-[#1A2838]">Unscheduled <span className="font-mono text-[10.5px] font-normal text-[#64748B]">{undated.length}</span></p>
          <div className="flex flex-wrap gap-2">
            {undated.map((it) => <button key={it.item_id} type="button" onClick={() => onSelect(it.item_id)} className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-[12px] text-[#1A2838] hover:border-[#215273]" data-testid={`week-undated-${it.item_id}`}>{it.title}</button>)}
            {!undated.length && <p className="text-xs text-[#64748B]">Everything has a date.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
