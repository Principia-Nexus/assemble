import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { money, slug } from "@/lib/format";
import { TaskHeader, ErrorList } from "./Stepper";
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

  return (
    <section data-testid="task-draft" className="space-y-6">
      <TaskHeader step={2} title="Draft">
        <Button onClick={generate} disabled={busy || !!sheet.preview} data-testid="draft-generate-button">{busy ? "Checking…" : failing ? "Regenerate with these crews" : "Check draft"}</Button>
      </TaskHeader>
      <ErrorList errors={errors} testId="draft-errors" />
      {sheet.preview && (
        <div data-testid="draft-preview-open-notice" role="status" className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-semibold">Proposed changes v{sheet.preview.version.number} are open.</span> Select or discard them before generating another candidate.</p>
          <Button size="sm" onClick={() => goTo("decide")} data-testid="draft-open-preview-button">Open preview</Button>
        </div>
      )}
      {failing && !linksExist && (
        <p data-testid="draft-repair-notice" role="status" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <span className="font-semibold">Repair this draft first.</span>
        </p>
      )}
      {linksExist && (
        <p data-testid="draft-links-notice" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Review links already exist, so a new candidate opens as an amendment preview. The current plan and its responses stay untouched until you select it.
        </p>
      )}
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <p className="eyebrow mb-3">Crews to include in this candidate</p>
        {partners.length === 0 && <p className="text-sm text-slate-500">No partners yet. Add them in Check.</p>}
        <div className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <label key={p.partner_id} className="lift flex cursor-pointer items-start gap-3 rounded border border-slate-200 p-3 hover:border-slate-400">
              <Checkbox checked={chosen.includes(p.partner_id)} onCheckedChange={() => toggle(p.partner_id)} data-testid={`draft-include-${slug(p.partner_id)}`} aria-label={`Include ${p.name}`} />
              <span className="text-sm">
                <span className="block font-semibold text-slate-900">{p.name}</span>
                <span className="font-mono text-[11px] text-slate-500">{money(p.price_per_site_cents)}/site · cap {(p.capacity || []).map((c) => c ?? "?").join("/")} · max {p.max_sites ?? "?"}</span>
              </span>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-3 rounded border border-slate-200 p-3 hover:border-slate-400">
            <Checkbox checked={includeOwn && ownCap > 0} disabled={ownCap === 0} onCheckedChange={(v) => setIncludeOwn(!!v)} data-testid="draft-include-own" aria-label="Include your own crew" />
            <span className="text-sm"><span className="block font-semibold text-slate-900">Your own crew</span>
              <span className="font-mono text-[11px] text-slate-500">cap {(sheet.intake.own_capacity || []).map((c) => c ?? "?").join("/") || "unknown"}</span>
              {ownCap === 0 && <span data-testid="draft-own-zero-note" className="block text-[11px] text-slate-500">No capacity entered for your crew, so it can't take sites. Add it in Check.</span>}</span>
          </label>
        </div>
      </div>
      {sheet.current ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <ScheduleGrid version={sheet.current.version} checker={sheet.current.checker} testPrefix="current" openCount={openConditions(sheet.current).length} />
          <CheckerPanel checker={sheet.current.checker} notes={sheet.current.version.generator_notes} title={`Checker · plan v${sheet.current.version.number}`} testPrefix="current" />
        </div>
      ) : (
        <p data-testid="draft-empty" className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No candidate yet. Choose crews and generate one.
        </p>
      )}
    </section>
  );
}
