import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money, slug } from "@/lib/format";
import { ErrorList } from "./TaskParts";
import ScheduleGrid from "./ScheduleGrid";
import { openConditions } from "@/lib/planState";
import CheckerPanel from "./CheckerPanel";

export default function DraftTask({ sheet, act, busy, goTo }) {
  const partners = sheet.intake.partners;
  const [chosen, setChosen] = useState(() => partners.map((p) => p.partner_id));
  const [includeOwn, setIncludeOwn] = useState(true);
  const [errors, setErrors] = useState([]);
  const toggle = (id) => setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  const linksExist = sheet.links_count > 0;
  const failing = sheet.current?.checker.overall === "fail";
  const ownCap = (sheet.intake.own_capacity || []).reduce((a, c) => a + (c || 0), 0);

  const generate = async () => {
    const r = await act("post", "/project/draft", { rev: sheet.project.rev, partner_ids: chosen, include_own: includeOwn },
      linksExist ? "Opened as an amendment preview" : "Candidate generated and checked");
    setErrors(r.ok ? [] : r.errors);
    if (r.ok && linksExist) goTo("decide");
  };

  const chip = (on, disabled) => `lift flex min-w-[180px] flex-1 flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors sm:flex-none ${
    disabled ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400" : on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white hover:border-slate-400"}`;
  return (
    <section data-testid="task-draft" className="space-y-6">
      <h2 className="sr-only">Draft</h2>
      <ErrorList errors={errors} testId="draft-errors" />
      {sheet.preview && (
        <div data-testid="draft-preview-open-notice" role="status" className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-semibold">Proposed changes are open.</span></p>
          <Button size="sm" onClick={() => goTo("decide")} data-testid="draft-open-preview-button">Open preview</Button>
        </div>
      )}
      {failing && !linksExist && (
        <p data-testid="draft-repair-notice" role="status" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">Repair this draft first.</p>
      )}
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="eyebrow">Firms</p>
          <Button size="sm" onClick={generate} disabled={busy || !!sheet.preview} data-testid="draft-generate-button">{busy ? "Checking…" : failing ? "Check plan" : sheet.current ? "Redraft and check" : "Draft and check"}</Button>
        </div>
        {partners.length === 0 && <p className="text-sm text-slate-500">No partners yet. Add them in Check.</p>}
        <div className="stagger flex flex-wrap gap-2" role="group" aria-label="Firms to include">
          {partners.map((p) => {
            const on = chosen.includes(p.partner_id);
            return (
              <button key={p.partner_id} type="button" aria-pressed={on} onClick={() => toggle(p.partner_id)} className={chip(on)} data-testid={`draft-include-${slug(p.partner_id)}`}>
                <span className="text-sm font-semibold">{p.name}</span>
                <span className={`text-[11px] ${on ? "text-white/70" : "text-slate-500"}`}>{money(p.price_per_site_cents)} per site</span>
              </button>
            );
          })}
          {ownCap > 0 && (
            <button type="button" aria-pressed={includeOwn} onClick={() => setIncludeOwn(!includeOwn)} className={chip(includeOwn)} data-testid="draft-include-own">
              <span className="text-sm font-semibold">Your own crew</span>
            </button>
          )}
        </div>
      </div>
      {sheet.current && (() => {
        const qa = sheet.current.qualification, bad = Object.entries(qa.sites).filter(([, x]) => x.status === "does_not_fit").map(([k]) => k);
        const pending = Object.values(qa.sites).filter((x) => ["review_needed", "evidence_needed"].includes(x.status)).length;
        return (
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white p-4" data-testid="draft-qualification">
            <p className="min-w-0 flex-1 text-sm text-slate-700">
              <span className="font-semibold">Coverage:</span> {qa.coverage.open.length ? `${qa.coverage.open.join(", ")} open` : "every scope assigned"}
              {" · "}<span className="font-semibold">Qualification:</span> <span className={bad.length ? "text-[#A93A3A]" : pending ? "text-[#B4690E]" : "text-[#1E7B5C]"}>{bad.length ? `does not fit for ${bad.join(", ")}` : pending ? `${pending} site${pending === 1 ? "" : "s"} need review or evidence` : "fits"}</span>
              {" · "}<span className="font-semibold">Budget and schedule:</span> {sheet.current.checker.overall}
            </p>
            {!sheet.project.plan_selected && (
              <Button size="sm" disabled={busy || bad.length > 0 || failing} onClick={() => act("post", "/project/plan/select", { rev: sheet.project.rev }, "Plan selected. Partners still need to review it.")} data-testid="draft-select-plan">Select plan</Button>
            )}
          </div>
        );
      })()}
      {sheet.current ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <ScheduleGrid version={sheet.current.version} checker={sheet.current.checker} testPrefix="current" openCount={openConditions(sheet.current).length} />
          <CheckerPanel checker={sheet.current.checker} notes={sheet.current.version.generator_notes} title="Checker" testPrefix="current" />
        </div>
      ) : null}
    </section>
  );
}
