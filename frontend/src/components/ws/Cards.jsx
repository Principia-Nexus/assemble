import { AlertTriangle, CheckCircle2, Circle, Diamond, FolderOpen, HelpCircle, Sparkles } from "lucide-react";
import { statusText } from "./useItems";
import { RESP_TONE, firmName, firmTone } from "./derive";

const RESP = { confirmed: "Confirmed", confirmed_conditional: "Confirmed with conditions", declined: "Declined", change_requested: "Change requested",
  awaiting: "Awaiting response", link_not_shared: "Link not shared", no_link: "No review link", needs_rereview: "Needs fresh review", expired: "Expired" };
export const respText = (s) => RESP[s] || null;

export const QUAL = { fits: "Fits", review_needed: "Review needed", evidence_needed: "Evidence needed", does_not_fit: "Does not fit" };
const ring = (sel, hot) => `${sel ? "ring-2 ring-[#215273]" : ""} ${hot ? "outline outline-2 outline-offset-2 outline-[#215273]" : ""}`;

function DateLine({ it }) {
  if (!it.due_date && !it.start_date) return null;
  return (
    <p className="mt-1.5 font-mono text-[10.5px] text-[#64748B]">
      {it.start_date && `${it.start_date} → `}{it.due_date}{it.date_kind && <span className="ml-1 rounded bg-[#F1F5F9] px-1">{it.date_kind}</span>}
    </p>
  );
}

export function ItemCard({ it, sheet, selected, hot, onSelect, cardRef }) {
  const Icon = { task: it.status === "done" ? CheckCircle2 : Circle, milestone: Diamond, ai_task: Sparkles, condition: HelpCircle }[it.kind] || Circle;
  const tone = it.kind === "condition" ? "border-dashed border-[#B4690E] bg-[#FDF5E6]" : it.kind === "milestone" ? "border-[#2F4A66] bg-[#FFFFFF]" : "border-[#E2E8F0] bg-[#FFFFFF]";
  return (
    <button ref={cardRef} type="button" onClick={() => onSelect(it.item_id)} data-testid={`card-${it.item_id}`}
      className={`ws-card group w-[232px] rounded-xl border p-3 text-left shadow-[0_1px_2px_rgba(26,40,56,.06)] transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-[0_4px_14px_-6px_rgba(26,40,56,.25)] ${tone} ${ring(selected, hot)}`}>
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#64748B]">
        <Icon className={`h-3.5 w-3.5 ${it.status === "done" || it.status === "reached" ? "text-[#1E7B5C]" : ""}`} />
        {it.kind === "ai_task" ? `AI run · ${statusText(it.status)}` : it.kind === "task" ? (it.status === "done" ? "Done" : "Task") : it.kind === "milestone" ? (it.status === "reached" ? "Reached" : "Milestone") : statusText(it.status)}
      </div>
      <p className="mt-1 text-[13px] font-medium leading-snug text-[#1A2838]">{it.title}</p>
      {it.firm_id && <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#2F4A66]"><span className={`h-2 w-2 shrink-0 rounded-full ${firmTone(sheet, it.firm_id).dot}`} />{firmName(sheet, it.firm_id)}</p>}
      {it.site_ids?.length > 0 && <p className="mt-0.5 font-mono text-[10.5px] text-[#64748B]">{it.site_ids.join(", ")}</p>}
      <DateLine it={it} />
    </button>
  );
}

export function PackageCard({ pkg, sheet, selected, onSelect, cardRef }) {
  const tone = firmTone(sheet, pkg.owner);
  const weeks = [...new Set(pkg.sites.map((s) => s.week).filter(Boolean))].sort();
  return (
    <button ref={cardRef} type="button" onClick={() => onSelect(pkg.id)} data-testid={`card-${pkg.id}`}
      className={`ws-card w-[232px] rounded-xl border border-[#E2E8F0] bg-[#FFFFFF] p-3 text-left shadow-[0_1px_2px_rgba(26,40,56,.06)] transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-[0_4px_14px_-6px_rgba(26,40,56,.25)] ${ring(selected)}`}>
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#64748B]">
        <FolderOpen className="h-3.5 w-3.5" /> Scope package
        <span className={`ml-auto h-2.5 w-2.5 rounded-full ${tone.dot}`} aria-hidden="true" />
      </div>
      <p className="mt-1 text-[13px] font-semibold leading-snug text-[#1A2838]">{pkg.title}</p>
      {pkg.firm && <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] font-medium text-[#2F4A66]" data-testid={`card-firm-${pkg.id}`}>{pkg.firm}</p>}
      <p className="mt-1 text-[11.5px] text-[#2F4A66]">{pkg.sites.length ? `${pkg.sites.length} site${pkg.sites.length === 1 ? "" : "s"}${weeks.length ? ` · week ${weeks.join(", ")}` : ""}` : "Not in plan"}{pkg.quote?.price_per_site_cents != null ? ` · $${(pkg.quote.price_per_site_cents / 100).toLocaleString()}/site` : ""}</p>
      {pkg.sites.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{pkg.sites.map((s) => <span key={s.site_id} title={s.name} className={`rounded px-1 font-mono text-[10px] ${tone.chip}`}>{s.site_id}</span>)}</div>}
      {pkg.qual && pkg.qual !== "fits" && <p className={`mt-1 text-[11px] font-medium ${pkg.qual === "does_not_fit" ? "text-[#A93A3A]" : "text-[#B4690E]"}`} data-testid={`card-qual-${pkg.id}`}>{QUAL[pkg.qual]}</p>}
      {pkg.qual === "fits" && <p className="mt-1 text-[11px] font-medium text-[#1E7B5C]" data-testid={`card-qual-${pkg.id}`}>Fits</p>}
      {respText(pkg.response) && <p className={`mt-1 text-[11px] font-medium ${RESP_TONE[pkg.response] || "text-[#B4690E]"}`}>{respText(pkg.response)}</p>}
    </button>
  );
}

export function ConditionCard({ c, selected, onSelect }) {
  return (
    <button type="button" onClick={() => onSelect(c.id)} data-testid={`card-${c.id}`}
      className={`ws-card w-[232px] rounded-xl border border-dashed border-[#B4690E] bg-[#FDF5E6] p-3 text-left transition-shadow hover:shadow-[0_4px_14px_-6px_rgba(180,105,14,.35)] ${ring(selected)}`}>
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#B4690E]">
        <AlertTriangle className="h-3.5 w-3.5" /> {{ unknown: "Unknown", finding: "Check failed", requirement: "Requirement", open_scope: "Open scope" }[c.kind] || "Open condition"}
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-[#1A2838]">{c.title}</p>
      {c.scope && <p className="mt-1 text-[11px] text-[#64748B]">{c.scope}</p>}
    </button>
  );
}
