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

export default function PlanStrip({ sheet, goTo }) {
  const cur = sheet.current;
  const next = nextStep(sheet);
  const go = () => {
    goTo(next.task);
    if (next.focus) setTimeout(() => document.querySelector(`[data-testid="${next.focus}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
  };
  const r = cur && scopedResult(cur.checker);
  const conds = cur ? openConditions(cur).length : sheet.gap.open_conditions?.length || 0;
  return (
    <section data-testid="plan-strip" className="no-print mt-5 overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="stagger grid grid-cols-2 divide-x divide-y divide-slate-100 md:grid-cols-4 md:divide-y-0">
        <Cell label={cur ? `Plan v${cur.version.number}` : "Plan"} testId="plan-strip-result">
          {r ? <StatusPill testId="project-overall-status" tone={r.tone} label={r.label} /> : <span className="text-slate-500">No candidate yet</span>}
        </Cell>
        <Cell label="Total against ceiling" testId="plan-strip-total">
          {cur ? `${money(cur.checker.total_cents)} of ${money(cur.checker.ceiling_cents)}` : `Ceiling ${money(sheet.intake.budget_ceiling_cents)}`}
        </Cell>
        <Cell label="Responses to these terms" testId="plan-strip-responses">
          {cur ? `${cur.partners.filter(answered).length} of ${cur.partners.length}` : "—"}
        </Cell>
        <Cell label="Conditions" testId="plan-strip-conditions">
          {conds ? <span className="text-amber-800">{conds} open</span> : <span className="text-slate-600">None open</span>}
        </Cell>
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p data-testid="plan-strip-next-text" className="text-sm text-slate-700"><span className="eyebrow mr-2">Next</span>{next.text}</p>
        {next.href ? (
          <Button size="sm" asChild data-testid="plan-strip-next-button"><Link to={next.href}>{next.label} <ArrowRight className="h-4 w-4" /></Link></Button>
        ) : (
          <Button size="sm" onClick={go} data-testid="plan-strip-next-button">{next.label} <ArrowRight className="h-4 w-4" /></Button>
        )}
      </div>
    </section>
  );
}
