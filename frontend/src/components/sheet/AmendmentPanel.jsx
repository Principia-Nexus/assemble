import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { c2s } from "@/lib/format";
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
          <thead><tr className="text-left font-mono text-[10px] uppercase tracking-wider text-slate-500"><th className="p-2">Site</th><th className="p-2">Scope owner</th><th className="p-2">Week</th><th className="p-2">Due by week</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.site_id} className="border-t border-slate-100">
                <td className="p-2 font-mono font-semibold">{r.site_id}</td>
                <td className="p-2"><select className={sel} value={r.owner} onChange={(e) => upd(i, "owner", e.target.value)} data-testid={`amend-owner-${r.site_id}`}>
                  <option value="">Choose…</option><option value="own">Your crew</option>
                  {v.partners.map((p) => <option key={p.partner_id} value={p.partner_id}>{p.name}</option>)}
                </select></td>
                <td className="p-2"><select className={sel} value={r.week} onChange={(e) => upd(i, "week", e.target.value)} data-testid={`amend-week-${r.site_id}`}>
                  {weeks.map((w) => <option key={w} value={w}>{w}</option>)}</select></td>
                <td className="p-2"><select className={sel} value={r.deadline_week} onChange={(e) => upd(i, "deadline_week", e.target.value)} data-testid={`amend-deadline-${r.site_id}`}>
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
              <Input className="h-8" inputMode="decimal" placeholder="0" value={adj[p.partner_id] || ""} onChange={(e) => setAdj({ ...adj, [p.partner_id]: e.target.value })} data-testid={`amend-adjust-${p.partner_id}`} />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AmendmentPanel({ sheet, act, busy }) {
  const pv = sheet.preview;
  const v = pv.version;
  const [rows, setRows] = useState(() => toRows(v));
  const [adj, setAdj] = useState(() => Object.fromEntries(Object.entries(v.adjustments || {}).map(([k, c]) => [k, c2s(c)])));
  const [errors, setErrors] = useState([]);
  useEffect(() => { setRows(toRows(v)); setAdj(Object.fromEntries(Object.entries(v.adjustments || {}).map(([k, c]) => [k, c2s(c)]))); }, [v]);

  const save = async () => {
    const r = await act("put", "/project/preview", { rev: sheet.project.rev, sites: rows, adjustments: adj }, "Preview rechecked");
    setErrors(r.ok ? [] : r.errors);
  };
  const review = pv.diff?.partners.filter((p) => p.state !== "unchanged" && p.state !== "removed") || [];

  return (
    <div data-testid="amendment-panel" className="space-y-5 rounded-md border-2 border-amber-300 bg-amber-50/40 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow text-amber-800">Amendment preview v{v.number}</p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">Revised terms, not yet selected</h3>
          <p className="text-xs text-slate-600">The current plan v{sheet.current.version.number} and every valid response stay in force until you select this.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => act("post", "/project/preview/discard", { rev: sheet.project.rev }, "Preview discarded; earlier consents kept")} data-testid="amend-discard-button">Discard preview</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button disabled={busy} data-testid="amend-select-button">Select revised terms</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Select v{v.number} as the current plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  v{sheet.current.version.number} and its responses are kept as history. {review.length ? `${review.map((p) => p.name).join(", ")} must review again.` : "No partner's terms changed."} Unchanged partners carry their response over only if it is still valid.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel data-testid="amend-select-cancel">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => act("post", "/project/preview/select", { rev: sheet.project.rev }, "Revised terms selected")} data-testid="amend-select-confirm">Select</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {pv.diff && <DiffView diff={pv.diff} />}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <ScheduleGrid version={v} checker={pv.checker} testPrefix="preview" />
          <details className="group" open>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800" data-testid="amend-editor-toggle">Edit the preview</summary>
            <div className="mt-3 space-y-3">
              <Editor v={v} rows={rows} setRows={setRows} adj={adj} setAdj={setAdj} />
              <ErrorList errors={errors} testId="amend-errors" />
              <Button onClick={save} disabled={busy} data-testid="amend-save-button">Save edits and recheck</Button>
            </div>
          </details>
        </div>
        <CheckerPanel checker={pv.checker} notes={v.generator_notes} title={`Checker · preview v${v.number}`} testPrefix="preview" />
      </div>
    </div>
  );
}
