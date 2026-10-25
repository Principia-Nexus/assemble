import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { firmName, planVersion } from "./derive";

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const monday = (s) => { const d = new Date(`${s}T00:00:00Z`); return addDays(s, -((d.getUTCDay() + 6) % 7)); };
const monthStart = (s) => `${s.slice(0, 7)}-01`;
const addMonths = (s, n) => { const d = new Date(`${monthStart(s)}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
const fmt = (s, o) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...o });
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TONES = ["bg-[#E4EFF6] text-[#215273] border-[#215273]/30", "bg-[#FDF1DC] text-[#8A5208] border-[#B4690E]/30", "bg-[#E3F2EA] text-[#1E6B4F] border-[#1E7B5C]/30",
  "bg-[#F6E6EA] text-[#8E2F45] border-[#A93A55]/30", "bg-[#ECE9F6] text-[#4B3F8A] border-[#5B4DA8]/30", "bg-[#EEF3DC] text-[#4D6114] border-[#6B8A1C]/30"];
const TODAY = iso(new Date());

function useEvents(sheet, items, filter) {
  return useMemo(() => {
    const ev = [], start = sheet.intake.start_date, v = planVersion(sheet);
    if (v && start) {
      const m0 = monday(start), owners = [];
      const by = {};
      for (const s of v.sites || []) {
        const a = v.assignments?.[s.site_id];
        if (a?.week && a.owner) (by[`${a.owner}|${a.week}`] ||= []).push(s.site_id);
        if (s.deadline_week) ev.push({ key: `due-${s.site_id}`, from: addDays(m0, 7 * (s.deadline_week - 1) + 4), kind: "due", label: `${s.site_id} due`, select: `plan-${a?.owner || "unassigned"}` });
      }
      for (const [k, sites] of Object.entries(by)) {
        const [owner, w] = k.split("|");
        if (!owners.includes(owner)) owners.push(owner);
        const from = addDays(m0, 7 * (w - 1));
        ev.push({ key: `plan-${k}`, from, to: addDays(from, 4), kind: "plan", tone: TONES[owners.indexOf(owner) % TONES.length], label: `${firmName(sheet, owner)} · ${sites.join(", ")}`, short: firmName(sheet, owner), select: `plan-${owner}` });
      }
    }
    for (const it of items) {
      const d = it.start_date || it.due_date;
      if (!d || !filter(it)) continue;
      ev.push({ key: it.item_id, from: d, to: it.due_date || d, kind: "item", label: it.title, provisional: it.date_kind === "provisional", select: it.item_id });
    }
    return ev;
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
  const undated = items.filter((i) => i.kind !== "group" && !i.due_date && !i.start_date && filter(i));
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
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#E2E8F0]" data-testid={`calendar-${mode}`}>
          <div className="grid grid-cols-7 gap-px">
            {DAYS.map((d) => <p key={d} className="bg-[#F8FAFC] px-2 py-1.5 font-mono text-[10.5px] font-semibold uppercase text-[#64748B]">{d}</p>)}
            {shown.map((d) => {
              const evs = on(d), out = mode === "month" && d.slice(0, 7) !== ms.slice(0, 7), max = mode === "month" ? 3 : 20;
              return (
                <div key={d} className={`flex flex-col gap-0.5 p-1 ${mode === "month" ? "min-h-[96px]" : "min-h-[300px]"} ${out ? "bg-[#FAFBFC]" : "bg-white"}`} data-testid={`week-day-${d}`}>
                  <span className={`mb-0.5 self-start rounded-full px-1.5 font-mono text-[11px] ${d === TODAY ? "bg-[#1A2838] text-white" : out ? "text-[#CBD5E1]" : "text-[#64748B]"}`}>{Number(d.slice(8))}</span>
                  {evs.slice(0, max).map((e) => <Chip key={e.key} e={e} day={d} selectedId={selectedId} onSelect={onSelect} compact={mode === "month"} />)}
                  {evs.length > max && <button type="button" onClick={() => { setMode("week"); setCursor(d); }} className="text-left text-[10.5px] font-medium text-[#215273] hover:underline" data-testid={`calendar-more-${d}`}>+{evs.length - max} more</button>}
                </div>
              );
            })}
          </div>
        </div>
        {undated.length > 0 && <section className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3" data-testid="week-unscheduled">
          <p className="mb-2 text-[13px] font-semibold text-[#1A2838]">Unscheduled <span className="font-mono text-[10.5px] font-normal text-[#64748B]">{undated.length}</span></p>
          <div className="flex flex-wrap gap-2">
            {undated.map((it) => <button key={it.item_id} type="button" onClick={() => onSelect(it.item_id)} className="rounded-full border border-[#E2E8F0] bg-white px-3 py-1 text-[12px] text-[#1A2838] transition-colors hover:border-[#215273]" data-testid={`week-undated-${it.item_id}`}>{it.title}</button>)}
          </div>
        </section>}
      </div>
    </div>
  );
}
