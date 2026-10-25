import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { c2s, n2s } from "@/lib/format";
import { setDirty } from "@/lib/dirty";
import { TaskHeader, ErrorList } from "./Stepper";
import IntakeSites from "./IntakeSites";
import IntakePartners from "./IntakePartners";
import GapPanel from "./GapPanel";
import JobConditions from "./JobConditions";
import ExtractPanel from "./ExtractPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const toForm = (it) => ({
  job_name: it.job_name || "", customer_name: it.customer_name || "", scope_summary: it.scope_summary || "",
  start_date: it.start_date || "", weeks: n2s(it.weeks), budget_ceiling: c2s(it.budget_ceiling_cents),
  own_capacity: (it.own_capacity || []).map(n2s), own_cost_per_site: c2s(it.own_cost_per_site_cents),
  sites: it.sites.map((s) => ({ ...s, site_id: s.site_id || "", name: s.name || "", scope: s.scope || "", deadline_week: n2s(s.deadline_week) })),
  partners: it.partners.map((p) => ({
    ...p, name: p.name || "", email: p.email || "", price_per_site: c2s(p.price_per_site_cents),
    capacity: (p.capacity || []).map(n2s), max_sites: n2s(p.max_sites), payer: p.payer || "",
    advance_pct: n2s(p.advance_pct), balance_terms: p.balance_terms || "", conditions: p.conditions || "",
    exclusions: p.exclusions || "", scope: p.scope || "", valid_until: p.valid_until || "",
  })),
  job_conditions: (it.job_conditions || []).map((c) => ({ ...c, source: c.source || "" })),
});

export const weeksOf = (f) => (/^\d+$/.test(f.weeks) && +f.weeks >= 1 && +f.weeks <= 12 ? +f.weeks : 0);
const trim = (arr, w) => (arr || []).slice(0, w);

export function F({ id, label, hint, className, ...props }) {
  return (
    <div className={className}>
      <Label htmlFor={id} className="text-xs font-semibold text-slate-700">{label}</Label>
      <Input id={id} className="mt-1 h-9 bg-white" {...props} />
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export default function IntakeTask({ sheet, act, busy, goTo }) {
  const [form, setForm] = useState(() => toForm(sheet.intake));
  const [errors, setErrors] = useState([]);
  const [tab, setTab] = useState(() => sessionStorage.getItem(`assemble_intake_tab_${sheet.project.project_id}`) || (sheet.intake.sites.length ? "form" : "read"));
  useEffect(() => {
    const h = (e) => setTab(e.detail);
    window.addEventListener("assemble:intake-tab", h);
    return () => window.removeEventListener("assemble:intake-tab", h);
  }, []);
  const w = weeksOf(form);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(sheet.intake));
  useEffect(() => { setDirty(dirty); return () => setDirty(false); }, [dirty]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setCap = (i, v) => { const c = [...form.own_capacity]; c[i] = v; setForm({ ...form, own_capacity: c }); };

  const save = async () => {
    const intake = { ...form, own_capacity: trim(form.own_capacity, w),
      partners: form.partners.map((p) => ({ ...p, capacity: trim(p.capacity, w) })) };
    const r = await act("put", "/project/intake", { rev: sheet.project.rev, intake }, "Job details saved");
    setErrors(r.ok ? [] : r.errors);
    if (r.ok) setForm(toForm(r.data.sheet.intake));
  };

  return (
    <section data-testid="task-intake" className="space-y-6">
      <TaskHeader step={1} title={sheet.intake.sites.length ? "Check" : "Add the job details"}>
        {dirty && <span data-testid="intake-unsaved-badge" className="self-center rounded-sm bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">Unsaved edits</span>}
        <Button onClick={save} disabled={busy} data-testid="intake-save-button">{busy ? "Saving…" : "Save and check gaps"}</Button>
        {sheet.gap.site_count > 0 && sheet.intake.weeks && (
          <Button variant="outline" onClick={() => goTo("draft")} data-testid="intake-next-button">Go to draft</Button>
        )}
      </TaskHeader>
      <ErrorList errors={errors} testId="intake-errors" />
      <Tabs value={tab} onValueChange={(v) => { setTab(v); sessionStorage.setItem(`assemble_intake_tab_${sheet.project.project_id}`, v); }}>
        <TabsList className="h-auto max-w-full flex-wrap">
          <TabsTrigger value="form" data-testid="intake-tab-form">Enter details manually</TabsTrigger>
          <TabsTrigger value="read" data-testid="intake-tab-read">Paste a brief or add files</TabsTrigger>
        </TabsList>
        <TabsContent value="read" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0"><ExtractPanel sheet={sheet} act={act} busy={busy} /></div>
            <GapPanel gap={sheet.gap} />
          </div>
        </TabsContent>
        <TabsContent value="form" className="mt-4">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <div className="rounded-md border border-slate-200 bg-white p-5">
            <p className="eyebrow mb-4">Job basics</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <F id="job" label="Job name" value={form.job_name} onChange={set("job_name")} data-testid="intake-job-name-input" />
              <F id="cust" label="Customer" value={form.customer_name} onChange={set("customer_name")} data-testid="intake-customer-input" />
              <F id="start" label="Start date (week 1 begins)" type="date" value={form.start_date} onChange={set("start_date")} data-testid="intake-start-date-input" />
              <F id="weeks" label="Number of weeks" inputMode="numeric" value={form.weeks} onChange={set("weeks")} data-testid="intake-weeks-input" />
              <F id="ceil" label="Budget ceiling (USD)" inputMode="decimal" placeholder="180000" value={form.budget_ceiling} onChange={set("budget_ceiling")} data-testid="intake-budget-input" />
              <F id="owncost" label="Your own cost per site (USD)" inputMode="decimal" value={form.own_cost_per_site} onChange={set("own_cost_per_site")} data-testid="intake-own-cost-input" />
            </div>
            <div className="mt-4">
              <Label className="text-xs font-semibold text-slate-700">Your own crew capacity (sites per week)</Label>
              {w ? (
                <div className="mt-1 flex flex-wrap gap-2">
                  {Array.from({ length: w }).map((_, i) => (
                    <Input key={i} className="h-9 w-20 bg-white" placeholder={`Wk ${i + 1}`} inputMode="numeric" aria-label={`Own capacity week ${i + 1}`}
                      value={form.own_capacity[i] || ""} onChange={(e) => setCap(i, e.target.value)} data-testid={`intake-own-capacity-week-${i + 1}`} />
                  ))}
                </div>
              ) : <p className="mt-1 text-xs text-slate-500">Enter the number of weeks first.</p>}
            </div>
            <div className="mt-4">
              <Label htmlFor="scope" className="text-xs font-semibold text-slate-700">Scope summary</Label>
              <Textarea id="scope" className="mt-1 bg-white" rows={2} value={form.scope_summary} onChange={set("scope_summary")} data-testid="intake-scope-input" />
            </div>
          </div>
          <IntakeSites form={form} setForm={setForm} weeks={w} />
          <IntakePartners form={form} setForm={setForm} weeks={w} />
          <JobConditions form={form} setForm={setForm} />
        </div>
        <GapPanel gap={sheet.gap} dirty={dirty} />
      </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
