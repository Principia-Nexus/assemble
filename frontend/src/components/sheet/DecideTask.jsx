import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusPill } from "@/components/StatusPill";
import { STATUS, money, fmtTime, slug } from "@/lib/format";
import { TaskHeader, ErrorList } from "./Stepper";
import AmendmentPanel from "./AmendmentPanel";
import ChangeRequests from "./ChangeRequests";

function nextAction(sheet) {
  const cur = sheet.current;
  if (!cur) return "Prepare a draft first.";
  if (sheet.preview) return "Review the amendment preview below, then discard it or select the revised terms.";
  if (cur.checker.overall === "fail") return "The current plan fails a check. Start an amendment to repair it; nothing is claimed impossible.";
  const open = sheet.change_requests.filter((c) => c.status === "open");
  if (open.length) return `Resolve ${open.length} open change request(s): open one as an amendment preview or close it.`;
  const st = cur.partners.map((p) => p.status);
  if (st.includes("declined")) return "A partner declined. Their sites now have no confirmed owner; amend the plan to cover the gap.";
  if (st.some((s) => ["no_link", "link_not_shared", "awaiting", "needs_rereview", "expired"].includes(s)))
    return "Some partners have not answered these exact terms yet. No response is not agreement.";
  if (cur.checker.overall === "unknown") return "Every partner answered, but some checks cannot run because inputs are unknown.";
  if (st.includes("confirmed_conditional")) return "Every partner confirmed, some with conditions that stay open until you resolve them.";
  return "Every partner confirmed these proposal-stage terms and the plan passes every check. This is not an award, contract or crew hold.";
}

function CustomerChangeForm({ sheet, act, busy, onDone }) {
  const sites = sheet.current.version.sites;
  const weeks = sheet.current.version.weeks;
  const [note, setNote] = useState("");
  const [moves, setMoves] = useState([{ site_id: sites[0]?.site_id, new_week: "1" }]);
  const [errors, setErrors] = useState([]);
  const upd = (i, k, v) => setMoves(moves.map((m, j) => (j === i ? { ...m, [k]: v } : m)));
  const sample = () => { setNote("Customer asks to move S09 and S10 into week 1 (Synthetic)"); setMoves([{ site_id: "S09", new_week: "1" }, { site_id: "S10", new_week: "1" }]); };
  const submit = async () => {
    const r = await act("post", "/project/change-requests", { note, moves }, "Change request saved apart from the plan");
    setErrors(r.ok ? [] : r.errors);
    if (r.ok) onDone();
  };
  const sel = "h-9 rounded border border-slate-200 bg-white px-2 text-sm";
  return (
    <div data-testid="customer-change-form" className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between"><p className="eyebrow">Log a customer change request</p>
        {sheet.project.synthetic && <Button size="sm" variant="ghost" onClick={sample} data-testid="customer-change-sample-button">Fill synthetic sample</Button>}</div>
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
  if (!cur) return <p data-testid="decide-empty" className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Prepare a draft first.</p>;
  const declined = cur.partners.filter((p) => p.status === "declined");
  const conds = cur.partners.filter((p) => p.response?.conditions || p.terms.conditions);
  return (
    <section data-testid="task-decide" className="space-y-6">
      <TaskHeader step={4} title="Decide next action" lead="Each partner's status against the exact terms they saw, open conditions, and any gap. Changes go through an amendment preview first.">
        {!sheet.preview && <Button onClick={() => act("post", "/project/preview", { rev: sheet.project.rev }, "Amendment preview opened")} disabled={busy} data-testid="decide-start-amendment-button">Start amendment preview</Button>}
        {!sheet.preview && <Button variant="outline" onClick={() => setShowForm(!showForm)} data-testid="decide-log-change-button">Log customer change</Button>}
      </TaskHeader>
      <div data-testid="decide-next-action" className="rounded-md border-l-4 border-slate-900 bg-white p-4 text-sm text-slate-800"><span className="eyebrow mr-2">Next</span>{nextAction(sheet)}</div>
      {showForm && !sheet.preview && <CustomerChangeForm sheet={sheet} act={act} busy={busy} onDone={() => setShowForm(false)} />}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full min-w-[620px] text-sm">
          <thead><tr className="text-left font-mono text-[10px] uppercase tracking-wider text-slate-500"><th className="p-3">Partner · plan v{cur.version.number}</th><th className="p-3">Status</th><th className="p-3">Sites</th><th className="p-3">Their total</th><th className="p-3">Answered</th></tr></thead>
          <tbody>
            {cur.partners.map((p) => (
              <tr key={p.partner_id} className="border-t border-slate-100" data-testid={`decide-partner-row-${slug(p.partner_id)}`}>
                <td className="p-3 font-semibold">{p.name}</td>
                <td className="p-3"><StatusPill testId={`decide-partner-status-${slug(p.partner_id)}`} tone={STATUS[p.status].tone} label={STATUS[p.status].label} /></td>
                <td className="p-3 font-mono text-xs">{p.terms.sites.map((s) => s.site_id).join(", ")}</td>
                <td className="p-3 font-mono">{money(p.terms.price_total_cents)}</td>
                <td className="p-3 text-xs text-slate-500">{p.response ? `${fmtTime(p.response.created_at)}${p.response.carried_from ? " · carried over" : ""}` : "No response"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(declined.length > 0 || conds.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {declined.length > 0 && (
            <div data-testid="decide-decline-gaps" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p className="font-semibold">Gap opened by a decline</p>
              {declined.map((p) => <p key={p.partner_id} className="mt-1 text-xs">{p.name}: {p.terms.sites.map((s) => s.site_id).join(", ")} have no confirmed owner.</p>)}
            </div>
          )}
          {conds.length > 0 && (
            <div data-testid="decide-open-conditions" className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Unresolved conditions</p>
              {conds.map((p) => <p key={p.partner_id} className="mt-1 text-xs">{p.name}: {[p.terms.conditions, p.response?.conditions].filter(Boolean).join(" · ")}</p>)}
            </div>
          )}
        </div>
      )}
      <ChangeRequests sheet={sheet} act={act} busy={busy} />
      {sheet.preview && <AmendmentPanel {...props} />}
    </section>
  );
}
