import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/StatusPill";
import { STATUS, money, fmtTime, slug } from "@/lib/format";
import { openConditions } from "@/lib/planState";
import { TaskHeader, ErrorList } from "./Stepper";
import { useDemoContent } from "@/lib/demoContent";
import AmendmentPanel from "./AmendmentPanel";
import ChangeRequests from "./ChangeRequests";

function nextAction(sheet) {
  const cur = sheet.current;
  if (!cur) return "Make a draft first.";
  if (sheet.preview) return "Review the amendment preview below. Save and recheck any edits, then discard it or select it.";
  if (cur.checker.overall === "fail") return "The current plan fails";
  const open = sheet.change_requests.filter((c) => c.status === "open");
  if (open.length) return `Resolve ${open.length} open change request(s): open one as an amendment preview or close it.`;
  const st = cur.partners.map((p) => p.status);
  if (st.includes("declined")) return "A partner declined. Their sites now have no confirmed owner; amend the plan to cover the gap.";
  if (st.some((s) => ["no_link", "link_not_shared", "awaiting", "needs_rereview", "expired"].includes(s)))
    return "Some partners have not answered these exact terms yet. No response is not agreement.";
  if (cur.checker.overall === "unknown") return "Every partner answered, but some checks cannot run because inputs are unknown.";
  const n = openConditions(cur).length;
  if (n) return `Every partner confirmed these terms and the checks pass, but ${n} condition${n > 1 ? "s are" : " is"} still open. Resolve ${n > 1 ? "them" : "it"} with the customer and partners before you commit to the bid.`;
  return "Every partner confirmed these proposal-stage terms, and this version passes recorded checks. This is not an award, contract or crew hold.";
}

function Fact({ label, value, tone, testId }) {
  const tones = { ok: "text-emerald-800", bad: "text-red-800", wait: "text-amber-800", none: "text-slate-700" };
  return (
    <div className="min-w-0 px-4 py-3" data-testid={testId}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold tabular-nums ${tones[tone]}`}>{value}</dd>
    </div>
  );
}

function SummaryStrip({ cur }) {
  const rule = (k) => cur.checker.rules.find((r) => r.key === k)?.status;
  const sched = ["capacity", "crew_week", "deadlines", "owner"].map(rule);
  const fits = sched.includes("fail") ? "bad" : sched.includes("unknown") ? "wait" : "ok";
  const budget = rule("ceiling");
  const confirmed = cur.partners.filter((p) => ["confirmed", "confirmed_conditional"].includes(p.status)).length;
  const open = openConditions(cur).length;
  return (
    <dl data-testid="decide-summary-strip" className="stagger grid grid-cols-2 divide-x divide-y divide-slate-100 rounded-md border border-slate-200 bg-white md:grid-cols-4 md:divide-y-0">
      <Fact testId="decide-q-schedule" label="Does the schedule fit?" value={{ ok: "Yes", bad: "No", wait: "Not known yet" }[fits]} tone={fits} />
      <Fact testId="decide-q-budget" label="Within budget?" value={budget === "pass" ? `Yes · ${money(cur.checker.total_cents)} of ${money(cur.checker.ceiling_cents)}` : budget === "fail" ? `No · ${money(cur.checker.total_cents)}` : "Not known yet"} tone={budget === "pass" ? "ok" : budget === "fail" ? "bad" : "wait"} />
      <Fact testId="decide-q-confirmed" label="Confirmed these terms" value={`${confirmed} of ${cur.partners.length} partners`} tone={confirmed === cur.partners.length && confirmed > 0 ? "ok" : "wait"} />
      <Fact testId="decide-q-open" label="Still unresolved" value={open ? `${open} condition${open > 1 ? "s" : ""}` : "None stated"} tone={open ? "wait" : "none"} />
    </dl>
  );
}

function CustomerChangeForm({ sheet, act, busy, onDone }) {
  const sites = sheet.current.version.sites;
  const weeks = sheet.current.version.weeks;
  const [note, setNote] = useState("");
  const [moves, setMoves] = useState([{ site_id: sites[0]?.site_id, new_week: "1" }]);
  const [errors, setErrors] = useState([]);
  const upd = (i, k, v) => setMoves(moves.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const demo = useDemoContent(sheet.project.synthetic);
  const sample = () => { const c = demo?.customer_change; if (!c) return; setNote(c.note); setMoves(c.moves); };
  const submit = async () => {
    const r = await act("post", "/project/change-requests", { note, moves }, "Change request saved apart from the plan");
    setErrors(r.ok ? [] : r.errors);
    if (r.ok) onDone();
  };
  const sel = "h-9 rounded border border-slate-200 bg-white px-2 text-sm";
  return (
    <div data-testid="customer-change-form" className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between"><p className="eyebrow">Log a customer change request</p>
        {demo?.customer_change && <Button size="sm" variant="ghost" onClick={sample} data-testid="customer-change-sample-button">Fill sample</Button>}</div>
      <Textarea rows={2} placeholder="What did the customer ask for?" value={note} onChange={(e) => setNote(e.target.value)} data-testid="customer-change-note-input" />
      {moves.map((m, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Move</span>
          <select className={sel} value={m.site_id} onChange={(e) => upd(i, "site_id", e.target.value)} data-testid={`customer-change-site-${i}`}>
            {sites.map((s) => <option key={s.site_id} value={s.site_id}>{s.site_id}</option>)}
          </select>
          <span className="text-slate-500">due and done in week</span>
          <select className={sel} value={m.new_week} onChange={(e) => upd(i, "new_week", e.target.value)} data-testid={`customer-change-week-${i}`}>
            {Array.from({ length: weeks }).map((_, w) => <option key={w} value={String(w + 1)}>{w + 1}</option>)}
          </select>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => setMoves([...moves, { site_id: sites[0]?.site_id, new_week: "1" }])} data-testid="customer-change-add-move"><Plus className="h-4 w-4" /> Another site</Button>
      <ErrorList errors={errors} testId="customer-change-errors" />
      <Button onClick={submit} disabled={busy} data-testid="customer-change-submit-button">Save request</Button>
    </div>
  );
}

export default function DecideTask(props) {
  const { sheet, act, busy } = props;
  const [showForm, setShowForm] = useState(false);
  const cur = sheet.current;
  if (!cur) return <p data-testid="decide-empty" className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Make a draft first.</p>;
  const declined = cur.partners.filter((p) => p.status === "declined");
  const conds = openConditions(cur);
  return (
    <section data-testid="task-decide" className="space-y-6">
      <TaskHeader step={4} title="Decide" lead="Each partner's status against the exact terms they saw, open conditions, and any gap.">
        {!sheet.preview && <Button onClick={() => act("post", "/project/preview", { rev: sheet.project.rev }, "Amendment preview opened")} disabled={busy} data-testid="decide-start-amendment-button">Start amendment preview</Button>}
        {!sheet.preview && <Button variant="outline" onClick={() => setShowForm(!showForm)} data-testid="decide-log-change-button">Log customer change</Button>}
        <Button variant="ghost" asChild data-testid="decide-summary-link"><Link to="summary"><FileText className="h-4 w-4" /> Printable summary</Link></Button>
      </TaskHeader>
      <div data-testid="decide-next-action" className="rounded-md border-l-4 border-slate-900 bg-white p-4 text-sm text-slate-800"><span className="eyebrow mr-2">Next</span>{nextAction(sheet)}</div>
      <SummaryStrip cur={cur} />
      {conds.length > 0 && (
        <div data-testid="decide-open-conditions" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Unresolved conditions</p>
          <ul className="mt-1 space-y-1 text-xs">
            {conds.map((c, i) => <li key={i} data-testid={`decide-condition-${i}`}><span className="font-semibold">{c.scope}:</span> {c.text}{c.source && <span className="text-amber-700"> · {c.source}</span>}</li>)}
          </ul>
        </div>
      )}
      {showForm && !sheet.preview && <CustomerChangeForm sheet={sheet} act={act} busy={busy} onDone={() => setShowForm(false)} />}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full min-w-[620px] text-sm">
          <thead><tr className="text-left font-mono text-[10px] text-slate-500"><th className="p-3">Partner · plan v{cur.version.number}</th><th className="p-3">Status</th><th className="p-3">Sites</th><th className="p-3">Their total</th><th className="p-3">Answered</th></tr></thead>
          <tbody>
            {cur.partners.map((p) => (
              <tr key={p.partner_id} className="border-t border-slate-100" data-testid={`decide-partner-row-${slug(p.partner_id)}`}>
                <td className="p-3 font-semibold">{p.name}</td>
                <td className="p-3"><StatusPill testId={`decide-partner-status-${slug(p.partner_id)}`} tone={STATUS[p.status].tone} label={STATUS[p.status].label} /></td>
                <td className="p-3 font-mono text-xs">{p.terms.sites.map((s) => s.site_id).join(", ")}</td>
                <td className="p-3 font-mono tabular-nums">{money(p.terms.price_total_cents)}</td>
                <td className="p-3 text-xs text-slate-500">{p.response ? (p.response.carried_from ? `${fmtTime(p.response.responded_at || p.response.created_at)} · carried to v${cur.version.number} ${fmtTime(p.response.created_at)}` : fmtTime(p.response.created_at)) : "No response"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {declined.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {declined.length > 0 && (
            <div data-testid="decide-decline-gaps" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-semibold">Gap opened by a decline</p>
              {declined.map((p) => <p key={p.partner_id} className="mt-1 text-xs">{p.name}: {p.terms.sites.map((s) => s.site_id).join(", ")} have no confirmed owner.</p>)}
            </div>
          )}
        </div>
      )}
      <ChangeRequests sheet={sheet} act={act} busy={busy} />
      {sheet.preview && <AmendmentPanel {...props} />}
    </section>
  );
}
