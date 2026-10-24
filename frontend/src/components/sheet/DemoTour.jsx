import { useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "assemble_tour_step";

const sitesWith = (v, owners) => v.sites.map((s) => ({
  site_id: s.site_id, owner: owners[s.site_id] || v.assignments[s.site_id]?.owner,
  week: String(v.assignments[s.site_id]?.week), deadline_week: s.deadline_week == null ? "" : String(s.deadline_week),
}));

export const TOUR = [
  { title: "Check this job", task: "intake", focus: "gap-analysis-panel",
    body: "Twelve synthetic branches over three weeks with a $180,000 ceiling. The gap analysis is provisional and shows anything unknown, before any partner signs up." },
  { title: "Read a quote PDF", task: "intake", tab: "read", focus: "read-sample-scanned-pdf-button",
    body: "Load the scanned Redwood quote, then press Read document. Each proposed fact keeps its page, line and exact words. A \"2-man crew\" is never read as capacity, and nothing changes until you choose readings to use." },
  { title: "The cheap plan fails", task: "draft", focus: "current-checker-panel",
    body: "Alder + Redwood costs $156,000, but the independent checker fails weeks 1 and 2 on capacity. A failed candidate is never called impossible.",
    run: (s, act) => act("post", "/project/draft", { rev: s.project.rev, partner_ids: ["alder", "redwood"], include_own: true }, "Cheap candidate checked") },
  { title: "Baseline plan passes", task: "draft", focus: "current-schedule-grid",
    body: "Alder, Birch and Cedar: $168,000 with 4 / 4 / 4 sites per week. Every rule passes, and headroom is never shown as profit.",
    run: (s, act) => act("post", "/project/draft", { rev: s.project.rev, partner_ids: ["alder", "birch", "cedar"], include_own: true }, "Baseline candidate checked") },
  { title: "Ask each partner privately", task: "ask", focus: "partner-card-alder",
    body: "Create a private link for each partner and share it yourself; creating a link does not send it. Then use \"Sign in as this partner\" on a card to confirm as Alder, Birch and Cedar.",
    run: async (s, act) => {
      for (const p of s.current?.partners || []) {
        const r = p.link ? { ok: true, data: { link: p.link } } : await act("post", "/project/links", { partner_id: p.partner_id });
        if (r.ok && !r.data.link.shared_at) await act("post", `/project/links/${r.data.link.token}/shared`, {});
      }
    } },
  { title: "A customer change arrives", task: "decide", focus: "amendment-panel",
    body: "The customer asks to move S09 and S10 into week 1. It is saved apart from the plan, then opened as a preview: the load becomes 6 / 4 / 2 with a two-slot gap in week 1.",
    run: async (s, act) => {
      const r = await act("post", "/project/change-requests", { note: "Customer asks to move S09 and S10 into week 1 (Synthetic)", moves: [{ site_id: "S09", new_week: "1" }, { site_id: "S10", new_week: "1" }] });
      if (!r.ok) return;
      const cr = r.data.sheet.change_requests.find((c) => c.status === "open");
      await act("post", "/project/preview", { rev: r.data.sheet.project.rev, change_request_id: cr.cr_id }, "Amendment preview opened");
    } },
  { title: "Repair with Dogwood", task: "decide", focus: "amend-diff-view",
    body: "Dogwood takes S09 and S10 for $172,000, and the plan passes again. The diff shows Alder changed, Dogwood new, and Birch and Cedar unchanged.",
    run: (s, act) => s.preview && act("put", "/project/preview", { rev: s.project.rev, sites: sitesWith(s.preview.version, { S09: "dogwood", S10: "dogwood" }), adjustments: {} }, "Repair checked") },
  { title: "Select the revised terms", task: "decide", focus: "decide-next-action",
    body: "Selecting keeps the old terms and answers as history. Birch and Cedar carry over only if their terms are unchanged and still valid. Alder and Dogwood must review again.",
    run: (s, act) => s.preview && act("post", "/project/preview/select", { rev: s.project.rev }, "Revised terms selected") },
  { title: "History is the receipt", task: "decide", focus: "decide-summary-link",
    body: "Open History in the header for every change and response, or the printable summary for a dated record of checks, contributions, exact responses and open conditions. Reset my demo copy starts over without touching anyone else." },
];

export function focusEl(testId) {
  setTimeout(() => {
    const el = document.querySelector(`[data-testid="${testId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("tour-focus");
    setTimeout(() => el.classList.remove("tour-focus"), 2600);
  }, 450);
}

export default function DemoTour({ sheet, act, busy, goTo, onClose }) {
  const [i, setI] = useState(() => Math.min(+(localStorage.getItem(KEY) || 0), TOUR.length - 1));
  const step = TOUR[i];
  const go = (n) => { setI(n); localStorage.setItem(KEY, String(n)); };
  const show = (st = step) => {
    goTo(st.task);
    if (st.tab) { sessionStorage.setItem("assemble_intake_tab", st.tab); window.dispatchEvent(new CustomEvent("assemble:intake-tab", { detail: st.tab })); }
    focusEl(st.focus);
  };
  const run = async () => { await step.run(sheet, act); show(); };

  return (
    <aside data-testid="demo-tour" className="no-print fixed inset-x-3 bottom-3 z-40 rounded-md border border-slate-900 bg-white shadow-2xl sm:left-auto sm:right-5 sm:w-96">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          <Sparkles className="h-3.5 w-3.5" /> Guided tour · step {i + 1} of {TOUR.length}
        </p>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} aria-label="Close tour" data-testid="demo-tour-close"><X className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-2 p-4">
        <h3 data-testid="demo-tour-title" className="text-base font-bold text-slate-900">{step.title}</h3>
        <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
        <div className="h-1 overflow-hidden rounded bg-slate-100"><div className="h-full bg-slate-900 transition-[width] duration-300" style={{ width: `${((i + 1) / TOUR.length) * 100}%` }} /></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
        <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => { go(i - 1); show(TOUR[i - 1]); }} data-testid="demo-tour-back"><ChevronLeft className="h-4 w-4" /> Back</Button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => show()} data-testid="demo-tour-show">Show me</Button>
          {step.run && <Button size="sm" variant="outline" disabled={busy} onClick={run} data-testid="demo-tour-run">Do it for me</Button>}
          {i < TOUR.length - 1 ? (
            <Button size="sm" onClick={() => { go(i + 1); show(TOUR[i + 1]); }} data-testid="demo-tour-next">Next <ChevronRight className="h-4 w-4" /></Button>
          ) : (
            <Button size="sm" onClick={() => { go(0); onClose(); }} data-testid="demo-tour-finish">Finish</Button>
          )}
        </div>
      </div>
    </aside>
  );
}
