import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { firmName, firmTone, planVersion } from "./derive";

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monday = (s) => { const d = new Date(`${s}T00:00:00Z`); return addDays(s, -((d.getUTCDay() + 6) % 7)); };
const monthStart = (s) => `${s.slice(0, 7)}-01`;
const addMonths = (s, n) => { const d = new Date(`${monthStart(s)}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
const fmt = (s, o) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...o });
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY = iso(new Date());

function useEvents(sheet, items, filter) {
  return useMemo(() => {
    const ev = [], start = sheet.intake.start_date, v = planVersion(sheet);
    if (v && start) {
      const m0 = monday(start);
      const by = {};
      for (const s of v.sites || []) {
        const a = v.assignments?.[s.site_id];
        if (a?.week && a.owner) (by[`${a.owner}|${a.week}`] ||= []).push(s.site_id);
        if (s.deadline_week) ev.push({ key: `due-${s.site_id}`, from: addDays(m0, 7 * (s.deadline_week - 1) + 4), kind: "due", label: `${s.site_id} due`, select: `plan-${a?.owner || "unassigned"}` });
      }
      for (const [k, sites] of Object.entries(by)) {
        const [owner, w] = k.split("|");
        const from = addDays(m0, 7 * (w - 1));
        ev.push({ key: `plan-${k}`, from, to: addDays(from, 4), kind: "plan", tone: firmTone(sheet, owner).bar, label: `${firmName(sheet, owner)} · ${sites.join(", ")}`, short: firmName(sheet, owner), select: `plan-${owner}` });
      }
    }
    for (const it of items) {
      const d = it.start_date || it.due_date;
      if (!d || !filter(it)) continue;
      ev.push({ key: it.item_id, from: d, to: it.due_date || d, kind: "item", label: it.title, provisional: it.date_kind === "provisional", select: it.item_id });
    }
    const dues = {};
    for (const e of ev.filter((x) => x.kind === "due")) (dues[e.from] ||= []).push(e);
    return [...ev.filter((x) => x.kind !== "due"), ...Object.entries(dues).map(([d, es]) => ({
      key: `due-${d}`, from: d, kind: "due", select: es[0].select,
      label: es.length === 1 ? es[0].label : `${es.length} sites due · ${es.map((x) => x.label.split(" ")[0]).join(", ")}`,
    }))];
  }, [sheet, items, filter]);
}

function Chip({ e, day, selectedId, onSelect, compact }) {
  const first = e.from === day || DAYS[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7] === "Mon";
  const cls = e.kind === "plan" ? `border ${e.tone}` : e.kind === "due" ? "text-[#A93A3A]" : `border bg-white text-[#1A2838] ${e.provisional ? "border-dashed border-[#94A3B8]" : "border-[#CBD5E1]"}`;
  return (
    <button type="button" onClick={() => onSelect(e.select)} title={e.label} data-testid={`week-item-${e.key}-${day}`}
      className={`block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-sm ${cls} ${selectedId === e.select ? "ring-2 ring-[#215273]" : ""}`}>
      {e.kind === "due" ? <span className="font-mono">● {e.label}</span> : first || !compact ? (compact && e.short ? e.short : e.label) : "\u00A0"}
    </button>
  );
}

export default function WeekView({ sheet, items, onSelect, selectedId, filter }) {
  const events = useEvents(sheet, items, filter);
  const anchor = [...events.map((e) => e.from)].sort()[0] || sheet.intake.start_date || TODAY;
  const [mode, setMode] = useState("month");
  const [cursor, setCursor] = useState(anchor);
  const on = (d) => events.filter((e) => e.from <= d && d <= (e.to || e.from)).sort((a, b) => ({ plan: 0, item: 1, due: 2 }[a.kind] - { plan: 0, item: 1, due: 2 }[b.kind]));
  const ms = monthStart(cursor), gridStart = monday(ms);
  const days = mode === "month" ? Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)) : DAYS.map((_, i) => addDays(monday(cursor), i));
  const weeks = mode === "month" ? (days[35].slice(0, 7) === ms.slice(0, 7) ? 6 : 5) : 1;
  const shown = days.slice(0, weeks * 7);
  const title = mode === "month" ? fmt(ms, { month: "long", year: "numeric" }) : `${fmt(shown[0], { month: "short", day: "numeric" })} – ${fmt(shown[6], { month: "short", day: "numeric", year: "numeric" })}`;
  const step = (n) => setCursor(mode === "month" ? addMonths(cursor, n) : addDays(cursor, 7 * n));
  const navBtn = "flex h-8 w-8 items-center justify-center rounded-md border border-[#E2E8F0] bg-white text-[#1A2838] transition-colors hover:bg-[#F1F5F9]";

  return (
    <div className="h-full overflow-auto px-4 pb-40 pt-5 sm:px-6" data-testid="week-view">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" className={navBtn} onClick={() => step(-1)} aria-label="Previous" data-testid="week-prev"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className={navBtn} onClick={() => step(1)} aria-label="Next" data-testid="week-next"><ChevronRight className="h-4 w-4" /></button>
          <p className="ml-1 text-[15px] font-semibold text-[#1A2838]" data-testid="week-label">{title}</p>
          <button type="button" onClick={() => setCursor(TODAY)} className="ml-2 h-8 rounded-md border border-[#E2E8F0] bg-white px-3 text-[12.5px] font-medium text-[#1A2838] transition-colors hover:bg-[#F1F5F9]" data-testid="calendar-today">Today</button>
          <div className="ml-auto flex rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-0.5" role="tablist" aria-label="Calendar range">
            {["month", "week"].map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} data-testid={`calendar-mode-${m}`}
                className={`rounded px-3 py-1 text-[12.5px] font-semibold capitalize transition-colors ${mode === m ? "bg-[#1A2838] text-white" : "text-[#475569] hover:text-[#1A2838]"}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white" data-testid={`calendar-${mode}`}>
          <div className="grid grid-cols-7 border-b border-[#E2E8F0] bg-[#F8FAFC]">
            {DAYS.map((d) => <p key={d} className="px-2 py-1.5 font-mono text-[10.5px] font-semibold uppercase text-[#64748B]">{d}</p>)}
          </div>
          {Array.from({ length: weeks }, (_, w) => shown.slice(w * 7, w * 7 + 7)).map((wk) => {
            const bars = events.filter((e) => e.kind === "plan" && e.from <= wk[6] && (e.to || e.from) >= wk[0]);
            return (
              <div key={wk[0]} className="relative border-b border-[#E2E8F0] last:border-b-0" data-testid={`calendar-week-${wk[0]}`}>
                <div className="absolute inset-0 grid grid-cols-7 divide-x divide-[#EEF2F6]" aria-hidden="true">
                  {wk.map((d) => <div key={d} className={mode === "month" && d.slice(0, 7) !== ms.slice(0, 7) ? "bg-[#FAFBFC]" : ""} />)}
                </div>
                <div className="relative grid grid-cols-7">
                  {wk.map((d) => {
                    const out = mode === "month" && d.slice(0, 7) !== ms.slice(0, 7);
                    return <span key={d} className={`m-1 self-start justify-self-start rounded-full px-1.5 font-mono text-[11px] ${d === TODAY ? "bg-[#1A2838] text-white" : out ? "text-[#CBD5E1]" : "text-[#64748B]"}`}>{Number(d.slice(8))}</span>;
                  })}
                </div>
                {bars.length > 0 && (
                  <div className="relative grid grid-cols-7 gap-y-0.5 px-1 pb-0.5">
                    {bars.map((e) => {
                      const a = Math.max(0, wk.indexOf(e.from)), b = wk.indexOf(e.to) < 0 ? 6 : wk.indexOf(e.to);
                      return (
                        <button key={e.key} type="button" onClick={() => onSelect(e.select)} title={e.label} style={{ gridColumn: `${a + 1} / ${b + 2}` }} data-testid={`calendar-bar-${e.key}`}
                          className={`truncate rounded-md border px-2 py-0.5 text-left text-[11.5px] font-medium transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-sm ${e.tone} ${selectedId === e.select ? "ring-2 ring-[#215273]" : ""}`}>
                          {e.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className={`relative grid grid-cols-7 ${mode === "month" ? "min-h-[56px]" : "min-h-[260px]"}`}>
                  {wk.map((d) => {
                    const evs = on(d).filter((e) => e.kind !== "plan"), max = mode === "month" ? 3 : 20;
                    return (
                      <div key={d} className="flex min-w-0 flex-col gap-0.5 p-1" data-testid={`week-day-${d}`}>
                        {evs.slice(0, max).map((e) => <Chip key={e.key} e={e} day={d} selectedId={selectedId} onSelect={onSelect} compact={false} />)}
                        {evs.length > max && <button type="button" onClick={() => { setMode("week"); setCursor(d); }} className="text-left text-[10.5px] font-medium text-[#215273] hover:underline" data-testid={`calendar-more-${d}`}>+{evs.length - max} more</button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
