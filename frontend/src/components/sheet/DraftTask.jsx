import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { money, slug } from "@/lib/format";
import { TaskHeader, ErrorList } from "./Stepper";
import ScheduleGrid from "./ScheduleGrid";
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

  const generate = async () => {
    const r = await act("post", "/project/draft", { rev: sheet.project.rev, partner_ids: chosen, include_own: includeOwn },
      linksExist ? "Opened as an amendment preview" : "Candidate generated and checked");
    setErrors(r.ok ? [] : r.errors);
    if (r.ok && linksExist) goTo("decide");
  };

  return (
    <section data-testid="task-draft" className="space-y-6">
      <TaskHeader step={2} title="Prepare a draft" lead="Pick which crews to try. A candidate schedule is generated, then the independent checker tests it.">
        <Button onClick={generate} disabled={busy} data-testid="draft-generate-button">{busy ? "Checking…" : "Generate and check candidate"}</Button>
        {sheet.current && !linksExist && <Button variant="outline" onClick={() => goTo("ask")} data-testid="draft-next-button">Go to partners</Button>}
      </TaskHeader>
      <ErrorList errors={errors} testId="draft-errors" />
      {linksExist && (
        <p data-testid="draft-links-notice" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Review links already exist, so a new candidate opens as an amendment preview. The current plan and its responses stay untouched until you select it.
        </p>
      )}
      <div className="rounded-md border border-slate-200 bg-white p-5">
        <p className="eyebrow mb-3">Crews to include in this candidate</p>
        {partners.length === 0 && <p className="text-sm text-slate-500">No partners yet. Add them in Check this job.</p>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => (
            <label key={p.partner_id} className="flex cursor-pointer items-start gap-3 rounded border border-slate-200 p-3 hover:border-slate-400">
              <Checkbox checked={chosen.includes(p.partner_id)} onCheckedChange={() => toggle(p.partner_id)} data-testid={`draft-include-${slug(p.partner_id)}`} />
              <span className="text-sm">
                <span className="block font-semibold text-slate-900">{p.name}</span>
                <span className="font-mono text-[11px] text-slate-500">{money(p.price_per_site_cents)}/site · cap {(p.capacity || []).map((c) => c ?? "?").join("/")} · max {p.max_sites ?? "?"}</span>
              </span>
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-3 rounded border border-slate-200 p-3 hover:border-slate-400">
            <Checkbox checked={includeOwn} onCheckedChange={(v) => setIncludeOwn(!!v)} data-testid="draft-include-own" />
            <span className="text-sm"><span className="block font-semibold text-slate-900">Your own crew</span>
              <span className="font-mono text-[11px] text-slate-500">cap {(sheet.intake.own_capacity || []).map((c) => c ?? "?").join("/") || "unknown"}</span></span>
          </label>
        </div>
      </div>
      {sheet.current ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <ScheduleGrid version={sheet.current.version} checker={sheet.current.checker} testPrefix="current" />
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
