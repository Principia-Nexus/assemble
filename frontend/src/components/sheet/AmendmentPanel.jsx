import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { c2s, money } from "@/lib/format";
import { ErrorList } from "./Stepper";
import DiffView from "./DiffView";
import ScheduleGrid from "./ScheduleGrid";
import CheckerPanel from "./CheckerPanel";

const toRows = (v) => v.sites.map((s) => ({
  site_id: s.site_id, owner: v.assignments[s.site_id]?.owner || "",
  week: String(v.assignments[s.site_id]?.week ?? ""), deadline_week: s.deadline_week == null ? "" : String(s.deadline_week),
}));

function Editor({ v, rows, setRows, adj, setAdj }) {
  const upd = (i, k, val) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: val } : r)));
  const sel = "h-8 rounded border border-slate-200 bg-white px-1.5 text-xs";
  const weeks = Array.from({ length: v.weeks }, (_, i) => String(i + 1));
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full min-w-[480px] text-xs">
          <thead><tr className="text-left font-mono text-[10px] text-slate-500"><th className="p-2">Site</th><th className="p-2">Scope owner</th><th className="p-2">Week</th><th className="p-2">Due by week</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.site_id} className="border-t border-slate-100">
                <td className="p-2 font-mono font-semibold">{r.site_id}</td>
                <td className="p-2"><select className={sel} value={r.owner} onChange={(e) => upd(i, "owner", e.target.value)} data-testid={`amend-owner-${r.site_id}`} aria-label={`${r.site_id} scope owner`}>
                  <option value="">Choose…</option><option value="own">Your crew</option>
                  {v.partners.map((p) => <option key={p.partner_id} value={p.partner_id}>{p.name}</option>)}
                </select></td>
                <td className="p-2"><select className={sel} value={r.week} onChange={(e) => upd(i, "week", e.target.value)} data-testid={`amend-week-${r.site_id}`} aria-label={`${r.site_id} week`}>
                  {weeks.map((w) => <option key={w} value={w}>{w}</option>)}</select></td>
                <td className="p-2"><select className={sel} value={r.deadline_week} onChange={(e) => upd(i, "deadline_week", e.target.value)} data-testid={`amend-deadline-${r.site_id}`} aria-label={`${r.site_id} due by week`}>
                  <option value="">unknown</option>{weeks.map((w) => <option key={w} value={w}>{w}</option>)}</select></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-slate-700">Price adjustments to a partner's total (USD, may be negative)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {v.partners.map((p) => (
            <label key={p.partner_id} className="flex items-center gap-2 text-xs">
              <span className="w-40 truncate">{p.name}</span>
              <Input className="h-8" inputMode="decimal" placeholder="0" aria-label={`Price adjustment for ${p.name}`} value={adj[p.partner_id] || ""} onChange={(e) => setAdj({ ...adj, [p.partner_id]: e.target.value })} data-testid={`amend-adjust-${p.partner_id}`} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

const CARRY = ["confirmed", "confirmed_conditional", "declined", "change_requested"];

export default function AmendmentPanel({ sheet, act, busy }) {
  const pv = sheet.preview;
  const v = pv.version;
  const adjOf = (ver) => Object.fromEntries(Object.entries(ver.adjustments || {}).map(([k, c]) => [k, c2s(c)]));
  const [rows, setRows] = useState(() => toRows(v));
  const [adj, setAdj] = useState(() => adjOf(v));
  const [errors, setErrors] = useState([]);
  useEffect(() => { setRows(toRows(v)); setAdj(adjOf(v)); }, [v]);
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, x]) => x && x !== "0"));
  const dirty = JSON.stringify(rows) !== JSON.stringify(toRows(v)) || JSON.stringify(clean(adj)) !== JSON.stringify(clean(adjOf(v)));
  const failing = pv.checker.overall === "fail";

  const save = async () => {
    const r = await act("put", "/project/preview", { rev: sheet.project.rev, sites: rows, adjustments: adj }, "Preview rechecked");
    setErrors(r.ok ? [] : r.errors);
  };
  const review = pv.diff?.partners.filter((p) => p.state !== "unchanged" && p.state !== "removed") || [];
  const pending = pv.diff?.partners.filter((p) => p.state === "unchanged" && !CARRY.includes(p.current_status)) || [];
  const d = pv.diff;
  const delta = d && d.total_after_cents != null && d.total_before_cents != null ? d.total_after_cents - d.total_before_cents : null;
  const lead = d ? [
    `${d.sites.length} site${d.sites.length === 1 ? "" : "s"} change${d.sites.length === 1 ? "s" : ""}`,
    delta == null ? "total unknown" : delta === 0 ? "total unchanged" : `${delta > 0 ? "+" : "-"}${money(Math.abs(delta))}`,
    review.length ? `${review.map((p) => p.name).join(", ")} must review` : "no partner's terms change",
    ...(pending.length ? [`${pending.length} already awaiting a response`] : []),
  ].join(" · ") : null;
  const selectBlock = dirty ? "Save and recheck your edits before selecting." : failing ? "This preview fails a check. Repair it before selecting." : null;

  return (
    <div data-testid="amendment-panel" className="space-y-5 rounded-md border-2 border-amber-300 bg-amber-50/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow text-amber-800">Proposed changes · preview v{v.number} · not selected</p>
          <h3 data-testid="amend-lead" className="mt-1 text-lg font-bold tabular-nums text-slate-900">{lead || "Revised terms, not yet selected"}</h3>
          <p className="text-xs text-slate-600">Current plan v{sheet.current.version.number} and every valid response stay in force until you select this.</p>
        </div>
        <div className="flex flex-col items-stretch gap-1 sm:items-end">
          <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => act("post", "/project/preview/discard", { rev: sheet.project.rev }, "Preview discarded; earlier consents kept")} data-testid="amend-discard-button">Discard preview</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button disabled={busy || !!selectBlock} data-testid="amend-select-button">Select checked revision</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Select checked preview v{v.number} as the current plan?</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2 text-sm text-slate-600" data-testid="amend-select-summary">
                    <p>Total <span className="font-semibold tabular-nums text-slate-900">{money(pv.checker.total_cents)}</span>{delta != null && ` (${delta >= 0 ? "+" : "-"}${money(Math.abs(delta))} vs v${sheet.current.version.number})`} · checker: {pv.checker.overall}.</p>
                    <p>{review.length ? `Changed by this amendment, must review: ${review.map((p) => p.name).join(", ")}.` : "No partner's terms change."}</p>
                    {pending.length > 0 && <p>Already awaiting a response (not caused by this change): {pending.map((p) => p.name).join(", ")}.</p>}
                    <p>Unchanged partners keep a valid response.</p>
                    <p>v{sheet.current.version.number} and its responses are kept as history.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="amend-select-cancel">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => act("post", "/project/preview/select", { rev: sheet.project.rev, expected_version_id: v.version_id }, "Revised terms selected")} data-testid="amend-select-confirm">Select v{v.number}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
          {selectBlock && <p data-testid="amend-select-blocked" className="text-xs font-medium text-amber-900">{selectBlock}</p>}
        </div>
      </div>
      {pv.diff && <DiffView diff={pv.diff} />}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <details className="group rounded-md border border-slate-200 bg-white p-4" open={dirty || errors.length > 0 || undefined}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800" data-testid="amend-editor-toggle">Edit details · full proposed schedule</summary>
            <div className="mt-3 space-y-3">
              <ScheduleGrid version={v} checker={pv.checker} testPrefix="preview" />
              <Editor v={v} rows={rows} setRows={setRows} adj={adj} setAdj={setAdj} />
              <ErrorList errors={errors} testId="amend-errors" />
              <div className="flex items-center gap-3">
                <Button onClick={save} disabled={busy} data-testid="amend-save-button">Save edits and recheck</Button>
                {dirty && <span data-testid="amend-unsaved-badge" className="rounded-sm bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Unsaved edits · checks below are for the last saved preview</span>}
              </div>
            </div>
          </details>
        </div>
        <CheckerPanel checker={pv.checker} notes={v.generator_notes} title={`Checker · preview v${v.number}`} testPrefix="preview" />
      </div>
    </div>
  );
}
