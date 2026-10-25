import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SynthBadge } from "@/components/StatusPill";
import { firmName, statusSentence } from "./derive";
import { respText } from "./Cards";
import { statusText } from "./useItems";

const usd = (c) => (c == null ? "unknown" : `$${(c / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`);

function Part({ title, children, testId }) {
  return (
    <section className="break-inside-avoid border-t border-[#E2E8F0] py-4" data-testid={testId}>
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#2F4A66]">{title}</h3>
      {children}
    </section>
  );
}

export default function ReportView({ sheet, items, pkgs, conds }) {
  const it = sheet.intake, cur = sheet.current, pre = sheet.preview;
  const ch = (pre || cur)?.checker;
  const work = items.filter((i) => i.kind !== "group");
  const aiRuns = items.filter((i) => i.kind === "ai_task");
  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-6" data-testid="report-view">
      <article className="report-print mx-auto max-w-[820px] rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] px-6 py-6 sm:px-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold text-[#1A2838]">{it.job_name || sheet.project.name}{sheet.project.synthetic && <SynthBadge />}</h2>
            <p className="mt-1 text-sm text-[#64748B]">{[it.customer_name, it.start_date && `starts ${it.start_date}`, it.weeks && `${it.weeks} weeks`].filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-xs text-[#64748B]" data-testid="report-status">{statusSentence(sheet)}</p>
          </div>
          <Button size="sm" variant="outline" className="no-print bg-white" onClick={() => window.print()} data-testid="report-print-button"><Printer className="h-4 w-4" /> Print / PDF</Button>
        </div>
        <Part title="Scope coverage" testId="report-coverage">
          {pkgs.length ? (
            <ul className="space-y-1 text-sm text-[#1A2838]">
              {pkgs.map((p) => <li key={p.id}><span className="font-medium">{p.title}</span> — {p.sites.length ? p.sites.map((s) => s.name || s.site_id).join(", ") : "no sites assigned"}</li>)}
            </ul>
          ) : <p className="text-sm text-[#64748B]">No plan drafted yet. {(it.sites || []).length} sites recorded.</p>}
          {ch && <p className="mt-2 text-xs text-[#64748B]">Checker ({pre ? `private draft v${pre.version.number}` : `selected v${cur.version.number}`}): {ch.overall}. Total {usd(ch.total_cents)}{it.budget_ceiling_cents ? ` against a ${usd(it.budget_ceiling_cents)} ceiling` : ""}. Internal planning totals, not a customer price.</p>}
        </Part>
        <Part title="Quotes and terms" testId="report-quotes">
          {(it.partners || []).length ? (
            <ul className="space-y-1 text-sm text-[#1A2838]">
              {it.partners.map((p) => <li key={p.partner_id}><span className="font-medium">{p.name}</span> — {usd(p.price_per_site_cents)} per site{p.valid_until ? `, valid until ${p.valid_until}` : ""}{p.conditions?.length ? `; conditions: ${Array.isArray(p.conditions) ? p.conditions.map((c) => c.text || c).join("; ") : p.conditions}` : ""}</li>)}
            </ul>
          ) : <p className="text-sm text-[#64748B]">No firm quotes recorded.</p>}
        </Part>
        <Part title="Outstanding conditions" testId="report-conditions">
          {conds.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-[#1A2838]">{conds.map((c) => <li key={c.id}>{c.title}{c.scope ? ` (${c.scope})` : ""}</li>)}</ul>
            : <p className="text-sm text-[#64748B]">None recorded.</p>}
        </Part>
        <Part title="Review responses" testId="report-responses">
          {cur?.partners?.length ? <ul className="space-y-1 text-sm text-[#1A2838]">{cur.partners.map((p) => <li key={p.partner_id}><span className="font-medium">{p.name}</span> — {respText(p.status) || p.status} on v{cur.version.number}</li>)}</ul>
            : <p className="text-sm text-[#64748B]">No terms selected for review yet.</p>}
        </Part>
        {pre?.diff && (
          <Part title="Change consequences" testId="report-changes">
            <p className="text-sm text-[#1A2838]">Private draft v{pre.version.number} changes {pre.diff.sites?.length || 0} site assignment{pre.diff.sites?.length === 1 ? "" : "s"} against v{cur?.version.number}; affected firms need fresh review once selected.</p>
          </Part>
        )}
        <Part title="Work items" testId="report-work">
          {work.length ? <ul className="space-y-1 text-sm text-[#1A2838]">{work.map((w) => <li key={w.item_id}>{w.title} <span className="text-[#64748B]">— {statusText(w.status)}{w.firm_id ? `, ${firmName(sheet, w.firm_id)}` : ""}{w.due_date ? `, ${w.date_kind || "due"} ${w.due_date}` : ""}</span></li>)}</ul>
            : <p className="text-sm text-[#64748B]">None yet.</p>}
          {aiRuns.length > 0 && <p className="mt-2 text-xs text-[#64748B]">{aiRuns.length} AI run result{aiRuns.length === 1 ? "" : "s"} are model findings, not human decisions.</p>}
        </Part>
      </article>
    </div>
  );
}
