import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money, slug } from "@/lib/format";
import { ErrorList } from "./Stepper";
import ScheduleGrid from "./ScheduleGrid";
import { openConditions } from "@/lib/planState";
import CheckerPanel from "./CheckerPanel";

export default function DraftTask({ sheet, act, busy, goTo }) {
  const partners = sheet.intake.partners;
  const initial = sheet.current?.version.partners
    ? Object.keys(sheet.current.version.assignments).length && [...new Set(Object.values(sheet.current.version.assignments).map((a) => a.owner))]
    : [];
  const [chosen, setChosen] = useState(() => partners.map((p) => p.partner_id).filter((id) => (initial || []).includes(id)));
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
          <p><span className="font-semibold">Proposed changes v{sheet.preview.version.number} are open.</span></p>
          <Button size="sm" onClick={() => goTo("decide")} data-testid="draft-open-preview-button">Open preview</Button>
        </div>
      )}
      {failing && !linksExist && (
        <p data-testid="draft-repair-notice" role="status" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">Repair this draft first.</p>
      )}
      <div className="rounded-md border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="eyebrow">Firms</p>
          <Button size="sm" onClick={generate} disabled={busy || !!sheet.preview} data-testid="draft-generate-button">{busy ? "Checking…" : failing ? "Recheck" : "Check draft"}</Button>
        </div>
        {partners.length === 0 && <p className="text-sm text-slate-500">No partners yet. Add them in Check.</p>}
        <div className="stagger flex flex-wrap gap-2" role="group" aria-label="Firms to include">
          {partners.map((p) => {
            const on = chosen.includes(p.partner_id);
            return (
              <button key={p.partner_id} type="button" aria-pressed={on} onClick={() => toggle(p.partner_id)} className={chip(on)} data-testid={`draft-include-${slug(p.partner_id)}`}>
                <span className="text-sm font-semibold">{p.name}</span>
                <span className={`font-mono text-[11px] ${on ? "text-white/70" : "text-slate-500"}`}>{money(p.price_per_site_cents)}/site · cap {(p.capacity || []).map((c) => c ?? "?").join("/")} · max {p.max_sites ?? "?"}</span>
              </button>
            );
          })}
          <button type="button" aria-pressed={includeOwn && ownCap > 0} disabled={ownCap === 0} onClick={() => setIncludeOwn(!includeOwn)} className={chip(includeOwn && ownCap > 0, ownCap === 0)} data-testid="draft-include-own">
            <span className="text-sm font-semibold">Your own crew</span>
            <span className={`font-mono text-[11px] ${includeOwn && ownCap > 0 ? "text-white/70" : ""}`}>cap {(sheet.intake.own_capacity || []).map((c) => c ?? "?").join("/") || "unknown"}</span>
          </button>
        </div>
      </div>
      {sheet.current ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <ScheduleGrid version={sheet.current.version} checker={sheet.current.checker} testPrefix="current" openCount={openConditions(sheet.current).length} />
          <CheckerPanel checker={sheet.current.checker} notes={sheet.current.version.generator_notes} title="Checker" testPrefix="current" />
        </div>
      ) : (
        <p data-testid="draft-empty" className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No candidate yet.</p>
      )}
    </section>
  );
}
