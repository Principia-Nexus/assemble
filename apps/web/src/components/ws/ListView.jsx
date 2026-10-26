import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { KIND_LABEL, statusText } from "./useItems";
import { firmName, planLabel } from "./derive";
import { respText } from "./Cards";

const DONE = { task: "done", milestone: "reached", condition: "resolved" };

function Row({ it, depth, sheet, run, onSelect, selectedId, hot }) {
  const [title, setTitle] = useState(it.title);
  useEffect(() => setTitle(it.title), [it.title]);
  const save = () => { if (title.trim() && title !== it.title) run([{ op: "update", item_id: it.item_id, fields: { title } }], `Renamed to “${title}”`); else setTitle(it.title); };
  const done = DONE[it.kind];
  return (
    <div data-testid={`list-row-${it.item_id}`} className={`grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#F1F5F9] px-3 py-1.5 transition-colors hover:bg-[#F1F5F9] sm:grid-cols-[24px_minmax(0,1fr)_120px_150px_110px] ${selectedId === it.item_id ? "bg-[#E4EFF6]" : ""} ${hot.has(it.item_id) ? "bg-[#E8EEF5]" : ""}`}>
      {done ? (
        <input type="checkbox" className="h-4 w-4 accent-[#1A2838]" checked={it.status === done} aria-label={`Mark ${it.title} ${done}`} data-testid={`list-done-${it.item_id}`}
          onChange={(e) => run([{ op: "update", item_id: it.item_id, fields: { status: e.target.checked ? done : "open" } }], `${it.title}: ${e.target.checked ? done : "reopened"}`)} />
      ) : <span />}
      <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 16 }}>
        <span className="shrink-0 rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">{KIND_LABEL[it.kind]}</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className={`min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-[13px] text-[#1A2838] outline-none focus:bg-white focus:ring-1 focus:ring-[#215273] ${it.kind === "group" ? "font-semibold" : ""}`} aria-label="Title" data-testid={`list-title-${it.item_id}`} />
      </div>
      <span className="hidden truncate text-xs text-[#2F4A66] sm:block">{firmName(sheet, it.firm_id) || ""}{it.plan_draft && it.firm_id ? " · draft" : ""}</span>
      <span className="hidden font-mono text-[11px] text-[#64748B] sm:block">{it.due_date ? `${it.due_date}${it.date_kind ? ` · ${it.date_kind}` : ""}` : ""}</span>
      <button type="button" onClick={() => onSelect(it.item_id)} className="justify-self-end rounded px-2 py-0.5 text-xs text-[#215273] hover:underline" data-testid={`list-open-${it.item_id}`}>
        {it.kind === "ai_task" ? statusText(it.status) : "Details"}
      </button>
    </div>
  );
}

function Section({ title, count, children, testId }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mb-4 overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#FFFFFF]" data-testid={testId}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 border-b border-[#F1F5F9] px-3 py-2 text-left text-[13px] font-semibold text-[#1A2838]">
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} /> {title}
        <span className="ml-auto font-mono text-[10.5px] font-normal text-[#64748B]">{count}</span>
      </button>
      {open && children}
    </section>
  );
}

export default function ListView({ sheet, items, pkgs, conds, run, onSelect, selectedId, hot, filter }) {
  const groups = items.filter((i) => i.kind === "group");
  const rows = [];
  const walk = (parent, depth) => items.filter((i) => (i.parent_id || null) === parent).forEach((i) => {
    const kids = items.filter((k) => k.parent_id === i.item_id);
    if (filter(i) || kids.some(filter)) rows.push({ it: i, depth });
    if (i.kind === "group") walk(i.item_id, depth + 1);
  });
  walk(null, 0);
  return (
    <div className="h-full overflow-auto px-4 pb-64 pt-5 sm:px-6" data-testid="list-view">
      <div className="mx-auto max-w-[1000px]">
        {pkgs.length > 0 && (
          <Section title={planLabel(sheet) || "Firms and sites"} count={`${pkgs.length}`} testId="list-plan">
            {pkgs.filter(filter).map((p) => (
              <button key={p.id} type="button" onClick={() => onSelect(p.id)} data-testid={`list-row-${p.id}`}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-[#F1F5F9] px-3 py-2 text-left text-[13px] hover:bg-[#F1F5F9] ${selectedId === p.id ? "bg-[#E4EFF6]" : ""}`}>
                <span className="font-medium text-[#1A2838]">{p.title}{p.firm && <span className="font-normal text-[#2F4A66]"> · {p.firm}</span>} <span className="font-normal text-[#64748B]">· {p.sites.length ? p.sites.map((s) => s.site_id).join(", ") : "no sites assigned"}</span></span>
                <span className="text-xs text-[#B4690E]">{respText(p.response, p.for_version) || ""}</span>
              </button>
            ))}
          </Section>
        )}
        {conds.length > 0 && (
          <Section title="Open items" count={`${conds.length}`} testId="list-conditions">
            {conds.filter(filter).map((c) => (
              <button key={c.id} type="button" onClick={() => onSelect(c.id)} data-testid={`list-row-${c.id}`} className="block w-full border-b border-[#F1F5F9] px-3 py-2 text-left text-[13px] text-[#1A2838] hover:bg-[#FDF5E6]">
                <span className="mr-2 text-[10px] font-semibold uppercase tracking-wide text-[#B4690E]">{c.kind}</span>{c.title}
              </button>
            ))}
          </Section>
        )}
        <Section title="Work" count={`${items.length - groups.length} items · ${groups.length} groups`} testId="list-work">
          {rows.length ? rows.map(({ it, depth }) => <Row key={it.item_id} it={it} depth={depth} sheet={sheet} run={run} onSelect={onSelect} selectedId={selectedId} hot={hot} />)
            : <p className="px-3 py-3 text-xs text-[#64748B]" data-testid="list-empty">No work items yet. Use Add, or ask below.</p>}
        </Section>
      </div>
    </div>
  );
}
