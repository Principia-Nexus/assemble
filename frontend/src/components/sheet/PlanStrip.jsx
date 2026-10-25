import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import { money } from "@/lib/format";
import { answered, nextStep, openConditions, scopedResult } from "@/lib/planState";

function Cell({ label, children, testId }) {
  return (
    <div className="min-w-0 px-4 py-3" data-testid={testId}>
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{children}</div>
    </div>
  );
}

export default function PlanStrip({ sheet, goTo, stacked = false }) {
  const cur = sheet.current;
  const pre = sheet.preview;
  const next = nextStep(sheet);
  const go = () => {
    goTo(next.task);
    if (next.focus) setTimeout(() => document.querySelector(`[data-testid="${next.focus}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
  };
  const r = cur && scopedResult(cur.checker);
  const conds = cur ? openConditions(cur).length : sheet.gap.open_conditions?.length || 0;
  const t = stacked ? "facts" : "plan-strip";
  return (
    <section data-testid={t} className={`no-print overflow-hidden rounded-md border border-slate-200 bg-white ${stacked ? "" : "mt-5"}`}>
      <div className={`stagger grid divide-slate-100 ${stacked ? "grid-cols-1 divide-y" : "grid-cols-2 divide-x divide-y md:grid-cols-4 md:divide-y-0"}`}>
        <Cell label={cur ? `Current review · plan v${cur.version.number}` : "Plan"} testId={`${t}-result`}>
          {r ? <StatusPill testId={stacked ? "facts-overall-status" : "project-overall-status"} tone={r.tone} label={r.label} className="whitespace-normal" /> : <span className="text-slate-500">No candidate yet</span>}
        </Cell>
        <Cell label={cur ? "Current review · total against ceiling" : "Ceiling"} testId={`${t}-total`}>
          {cur ? `${money(cur.checker.total_cents)} of ${money(cur.checker.ceiling_cents)}` : money(sheet.intake.budget_ceiling_cents)}
        </Cell>
        {stacked && pre && (
          <Cell label={`Private draft · v${pre.version.number} (not selected)`} testId="facts-draft">
            {money(pre.checker.total_cents)} · <span className={pre.checker.overall === "fail" ? "text-red-700" : ""}>{scopedResult(pre.checker).label}</span>
          </Cell>
        )}
        <Cell label="Current review · responses to these terms" testId={`${t}-responses`}>
          {cur ? `${cur.partners.filter(answered).length} of ${cur.partners.length}` : "—"}
        </Cell>
        <Cell label="Conditions" testId={`${t}-conditions`}>
          {conds ? <span className="text-amber-800">{conds} open</span> : <span className="text-slate-600">None open</span>}
        </Cell>
      </div>
      <div className={`flex flex-col gap-3 border-t border-slate-100 px-4 py-3 ${stacked ? "" : "sm:flex-row sm:items-center sm:justify-between"}`}>
        <p data-testid={`${t}-next-text`} className="text-sm text-slate-700">{next.text}</p>
        {next.href ? (
          <Button size="sm" asChild data-testid={`${t}-next-button`}><Link to={next.href}>{next.label} <ArrowRight className="h-4 w-4" /></Link></Button>
        ) : next.label ? (
          <Button size="sm" onClick={go} data-testid={`${t}-next-button`}>{next.label} <ArrowRight className="h-4 w-4" /></Button>
        ) : null}
      </div>
    </section>
  );
}
