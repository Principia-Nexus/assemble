import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoContent } from "@/lib/demoContent";

const KEY = "assemble_tour_step";

const reassigned = (v, owners) => v.sites.map((s) => ({
  site_id: s.site_id, owner: owners[s.site_id] || v.assignments[s.site_id]?.owner,
  week: String(v.assignments[s.site_id]?.week), deadline_week: s.deadline_week == null ? "" : String(s.deadline_week),
}));

// Generic tour actions; which partners/sites they touch comes from the fixture in MongoDB.
const ACTIONS = {
  draft: (a, s, act) => act("post", "/project/draft", { rev: s.project.rev, partner_ids: a.partner_ids, include_own: true }, "Candidate checked"),
  share_links: async (a, s, act) => {
    for (const p of s.current?.partners || []) {
      const r = p.link ? { ok: true, data: { link: p.link } } : await act("post", "/project/links", { partner_id: p.partner_id });
      if (r.ok && !r.data.link.shared_at) await act("post", `/project/links/${r.data.link.token}/shared`, {});
    }
  },
  customer_change: async (a, s, act, demo) => {
    const r = await act("post", "/project/change-requests", demo.customer_change);
    if (!r.ok) return;
    const cr = r.data.sheet.change_requests.find((c) => c.status === "open");
    await act("post", "/project/preview", { rev: r.data.sheet.project.rev, change_request_id: cr.cr_id }, "Amendment preview opened");
  },
  reassign: (a, s, act) => s.preview && act("put", "/project/preview", { rev: s.project.rev, sites: reassigned(s.preview.version, a.owners), adjustments: {} }, "Repair checked"),
  select: (a, s, act) => s.preview && act("post", "/project/preview/select", { rev: s.project.rev }, "Revised terms selected"),
};

export function focusEl(testId) {
  setTimeout(() => {
    const el = document.querySelector(`[data-testid="${testId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("tour-focus");
    setTimeout(() => el.classList.remove("tour-focus"), 2600);
  }, 450);
}

export default function DemoTour({ sheet, act, busy, goTo, onClose }) {
  const demo = useDemoContent(true);
  const tour = demo?.tour || [];
  const [i, setI] = useState(() => +(localStorage.getItem(KEY) || 0));
  const [min, setMin] = useState(false);
  if (!tour.length) return null;
  const idx = Math.min(i, tour.length - 1);
  const step = tour[idx];
  const go = (n) => { setI(n); localStorage.setItem(KEY, String(n)); };
  const show = (st = step) => {
    goTo(st.task);
    if (st.tab) { sessionStorage.setItem("assemble_intake_tab", st.tab); window.dispatchEvent(new CustomEvent("assemble:intake-tab", { detail: st.tab })); }
    if (st.focus) focusEl(st.focus);
  };
  const run = async () => { await ACTIONS[step.action.type](step.action, sheet, act, demo); show(); };

  return (
    <aside data-testid="demo-tour" className="no-print fixed inset-x-3 bottom-3 z-40 rounded-md border border-slate-900 bg-white shadow-2xl sm:left-auto sm:right-5 sm:w-96">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <p className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
          <Sparkles className="h-3.5 w-3.5" /> Guided tour · step {idx + 1} of {tour.length}{min ? ` · ${step.title}` : ""}
        </p>
        <div className="flex">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMin(!min)} aria-label={min ? "Expand tour" : "Minimize tour"} data-testid="demo-tour-minimize">{min ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose} aria-label="Close tour" data-testid="demo-tour-close"><X className="h-4 w-4" /></Button>
        </div>
      </div>
      {!min && (
        <>
          <div className="space-y-2 p-4">
            <h3 data-testid="demo-tour-title" className="text-base font-bold text-slate-900">{step.title}</h3>
            <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
            <div className="h-1 overflow-hidden rounded bg-slate-100"><div className="h-full bg-slate-900 transition-[width] duration-300" style={{ width: `${((idx + 1) / tour.length) * 100}%` }} /></div>
          </div>
          <div className="flex items-center justify-between gap-1 border-t border-slate-200 px-3 py-3">
            <Button size="sm" variant="ghost" className="px-2" disabled={idx === 0} onClick={() => { go(idx - 1); show(tour[idx - 1]); }} data-testid="demo-tour-back"><ChevronLeft className="h-4 w-4" /> Back</Button>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="px-2.5" onClick={() => show()} data-testid="demo-tour-show">Show me</Button>
              {step.action && ACTIONS[step.action.type] && <Button size="sm" variant="outline" className="px-2.5" disabled={busy} onClick={run} data-testid="demo-tour-run">Do it for me</Button>}
              {idx < tour.length - 1 ? (
                <Button size="sm" className="px-2.5" onClick={() => { go(idx + 1); show(tour[idx + 1]); }} data-testid="demo-tour-next">Next <ChevronRight className="h-4 w-4" /></Button>
              ) : (
                <Button size="sm" className="px-2.5" onClick={() => { go(0); onClose(); }} data-testid="demo-tour-finish">Finish</Button>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
