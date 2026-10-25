import { api, errText } from "@/lib/api";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { KIND_LABEL, STATUS_OPTIONS, statusText } from "./useItems";
import { firmName } from "./derive";
import { respText } from "./Cards";

const REL = { prerequisite: "must finish before", uses_input: "is input to", produces_output: "produces output for", relates_to: "relates to" };
const sel = "h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-2 text-sm text-[#1A2838] focus:outline-none focus:ring-2 focus:ring-[#215273]";
const Lbl = ({ children, htmlFor }) => <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{children}</label>;

function ItemForm({ it, sheet, items, edges, run, onSheet }) {
  const [f, setF] = useState(it);
  const [errors, setErrors] = useState([]);
  useEffect(() => { setF(it); setErrors([]); }, [it]);
  const save = async (fields, label) => {
    const changed = Object.fromEntries(Object.entries(fields).filter(([k, v]) => (v ?? null) !== (it[k] ?? null)));
    if (!Object.keys(changed).length) return;
    const r = await run([{ op: "update", item_id: it.item_id, fields: changed }], label || `Edited “${it.title}”`);
    setErrors(r.ok ? [] : r.errors);
  };
  const txt = (k) => ({ value: f[k] || "", onChange: (e) => setF({ ...f, [k]: e.target.value }), onBlur: () => save({ [k]: f[k] || null }) });
  const sites = sheet.intake.sites || [], firms = sheet.intake.partners || [];
  const groups = items.filter((g) => g.kind === "group" && g.item_id !== it.item_id);
  const mine = edges.filter((e) => e.from_id === it.item_id || e.to_id === it.item_id);
  const [link, setLink] = useState({ to: "", kind: "prerequisite" });
  const title = (id) => items.find((x) => x.item_id === id)?.title || id;

  // Site work follows the plan: changing the firm moves the site in the plan (as a private draft until you select it).
  const assign = async (owner) => {
    if (!owner) { toast.error("Planned site work needs a firm. Choose one, or remove the site from the plan in Draft plan."); return; }
    try {
      const { data } = await api.post("/project/plan/assign", { rev: sheet.project.rev, site_id: it.plan_site, owner });
      onSheet(data.sheet);
      toast.success(`${it.plan_site} moved in the plan`);
    } catch (e) { toast.error(errText(e)); }
  };
  return (
    <div className="space-y-4">
      <div><Lbl htmlFor="insp-title">Title</Lbl><Input id="insp-title" className="bg-white" {...txt("title")} data-testid="inspector-title-input" /></div>
      {it.kind !== "group" && (
        <div><Lbl htmlFor="insp-status">Status</Lbl>
          <select id="insp-status" className={sel} value={f.status} onChange={(e) => save({ status: e.target.value })} data-testid="inspector-status-select">
            {STATUS_OPTIONS[it.kind].map((s) => <option key={s} value={s}>{statusText(s)}</option>)}
          </select>
          {it.kind === "task" && <p className="mt-1 text-[11px] text-[#64748B]">Marking a task done does not confirm terms or certify design.</p>}
        </div>
      )}
      <div><Lbl htmlFor="insp-firm">{it.kind === "group" ? "Proposed responsible firm" : "Assignee firm"}</Lbl>
        <select id="insp-firm" className={sel} value={f.firm_id || ""} onChange={(e) => (it.plan_site ? assign(e.target.value) : save({ firm_id: e.target.value || null }))} data-testid="inspector-firm-select">
          <option value="">Unassigned</option><option value="own">Own crews</option>
          {firms.map((p) => <option key={p.partner_id} value={p.partner_id}>{p.name}</option>)}
        </select>
      </div>
      {it.kind !== "group" && (
        <div><Lbl htmlFor="insp-parent">Group</Lbl>
          <select id="insp-parent" className={sel} value={f.parent_id || ""} onChange={(e) => save({ parent_id: e.target.value || null }, `Moved “${it.title}”`)} data-testid="inspector-parent-select">
            <option value="">No group</option>
            {groups.map((g) => <option key={g.item_id} value={g.item_id}>{g.title}</option>)}
          </select>
        </div>
      )}
      {sites.length > 0 && (
        <div><Lbl>Sites</Lbl>
          <div className="flex flex-wrap gap-1.5">
            {sites.map((s) => {
              const on = (f.site_ids || []).includes(s.site_id);
              return <button key={s.site_id} type="button" aria-pressed={on} title={s.name} data-testid={`inspector-site-${s.site_id}`}
                onClick={() => save({ site_ids: on ? f.site_ids.filter((x) => x !== s.site_id) : [...(f.site_ids || []), s.site_id] })}
                className={`rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors ${on ? "border-[#1A2838] bg-[#1A2838] text-white" : "border-[#E2E8F0] bg-white text-[#2F4A66] hover:border-[#215273]"}`}>{s.site_id}</button>;
            })}
          </div>
        </div>
      )}
      {it.kind !== "group" && (
        <div className="grid grid-cols-2 gap-2">
          <div><Lbl htmlFor="insp-start">Start</Lbl><Input id="insp-start" type="date" className="bg-white" value={f.start_date || ""} onChange={(e) => save({ start_date: e.target.value || null })} data-testid="inspector-start-input" /></div>
          <div><Lbl htmlFor="insp-due">Due</Lbl><Input id="insp-due" type="date" className="bg-white" value={f.due_date || ""} onChange={(e) => save({ due_date: e.target.value || null })} data-testid="inspector-due-input" /></div>
          <div className="col-span-2"><Lbl htmlFor="insp-dk">Date is</Lbl>
            <select id="insp-dk" className={sel} value={f.date_kind || ""} onChange={(e) => save({ date_kind: e.target.value || null })} data-testid="inspector-datekind-select">
              <option value="">Not specified</option><option value="target">A target</option><option value="stated">Stated in a source</option><option value="provisional">A provisional estimate</option>
            </select>
          </div>
        </div>
      )}
      {it.kind === "milestone" && <div><Lbl htmlFor="insp-crit">Criteria</Lbl><Textarea id="insp-crit" rows={2} className="resize-none bg-white" {...txt("criteria")} data-testid="inspector-criteria-input" /></div>}
      {it.kind === "ai_task" && <div><Lbl htmlFor="insp-res">Result · model finding, not a decision</Lbl><Textarea id="insp-res" rows={6} className="bg-white text-[13px]" {...txt("result")} data-testid="inspector-result-input" /></div>}
      <div><Lbl htmlFor="insp-notes">Notes</Lbl><Textarea id="insp-notes" rows={3} className="resize-none bg-white" {...txt("notes")} data-testid="inspector-notes-input" /></div>
      {it.kind !== "group" && (
        <div><Lbl>Relationships</Lbl>
          <ul className="space-y-1">
            {mine.map((e) => (
              <li key={e.edge_id} className="flex items-center gap-2 text-[12.5px] text-[#1A2838]" data-testid={`inspector-edge-${e.edge_id}`}>
                <span className="min-w-0 flex-1 truncate">{e.from_id === it.item_id ? `This ${REL[e.kind]} ${title(e.to_id)}` : `${title(e.from_id)} ${REL[e.kind]} this`}{e.proposed && <span className="ml-1 text-[#B4690E]">(proposed)</span>}</span>
                {e.proposed && <button type="button" className="text-xs text-[#215273] hover:underline" onClick={() => run([{ op: "unlink", edge_id: e.edge_id }, { op: "link", from_id: e.from_id, to_id: e.to_id, kind: e.kind, proposed: false }], "Accepted relationship")} data-testid={`inspector-edge-accept-${e.edge_id}`}>Keep</button>}
                <button type="button" className="text-xs text-[#A93A3A] hover:underline" onClick={() => run([{ op: "unlink", edge_id: e.edge_id }], "Removed relationship")} data-testid={`inspector-edge-remove-${e.edge_id}`}>Remove</button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-1.5">
            <select className={sel} value={link.kind} onChange={(e) => setLink({ ...link, kind: e.target.value })} aria-label="Relationship kind" data-testid="inspector-link-kind">
              <option value="prerequisite">Must finish before</option><option value="uses_input">Is input to</option><option value="relates_to">Relates to</option>
            </select>
            <select className={sel} value={link.to} onChange={(e) => setLink({ ...link, to: e.target.value })} aria-label="Related item" data-testid="inspector-link-target">
              <option value="">Choose item…</option>
              {items.filter((x) => x.kind !== "group" && x.item_id !== it.item_id).map((x) => <option key={x.item_id} value={x.item_id}>{x.title}</option>)}
            </select>
            <Button size="sm" variant="outline" className="h-9 bg-white" disabled={!link.to} data-testid="inspector-link-add"
              onClick={async () => { const r = await run([{ op: "link", from_id: it.item_id, to_id: link.to, kind: link.kind, proposed: false }], "Added relationship"); if (r.ok) setLink({ ...link, to: "" }); else setErrors(r.errors); }}>Add</Button>
          </div>
        </div>
      )}
      {errors.length > 0 && <ul className="rounded-md border border-[#A93A3A]/30 bg-[#FBEFEF] p-2 text-xs text-[#A93A3A]" data-testid="inspector-errors" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <p className="text-[11px] text-[#64748B]">{it.origin === "assistant" ? "Created by the assistant" : "Created by"} {it.created_by} · {it.created_at?.slice(0, 16).replace("T", " ")}</p>
      <Button variant="outline" size="sm" className="w-full border-[#A93A3A]/40 bg-white text-[#A93A3A] hover:bg-[#FBEFEF]" data-testid="inspector-delete"
        onClick={() => run([{ op: "delete", item_id: it.item_id }], `Deleted “${it.title}”`)}><Trash2 className="h-4 w-4" /> Delete{it.kind === "group" ? " group (keeps its work)" : ""}</Button>
    </div>
  );
}

function PackageDetail({ pkg, openTool }) {
  return (
    <div className="space-y-4">
      {pkg.reasons?.length > 0 && <ul className="space-y-1 text-[12px] text-[#334155]" data-testid="inspector-qual-reasons">{pkg.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      {respText(pkg.response) && <p className="rounded-md bg-[#FDF5E6] px-2 py-1.5 text-xs font-medium text-[#B4690E]" data-testid="inspector-package-response">{respText(pkg.response)}</p>}
      <table className="w-full text-[12.5px]"><tbody>
        {pkg.sites.map((s) => <tr key={s.site_id} className="border-b border-[#F1F5F9]"><td className="py-1 font-mono text-[11px]">{s.site_id}</td><td className="py-1">{s.name}</td><td className="py-1 text-right text-[#64748B]">{s.week ? `wk ${s.week}` : ""}{s.deadline_week ? ` · due wk ${s.deadline_week}` : ""}</td></tr>)}
      </tbody></table>
      <div className="flex flex-col gap-2">
        <Button size="sm" variant="outline" className="bg-white" onClick={() => openTool("check")} data-testid="inspector-open-plan">Edit allocation</Button>
        <Button size="sm" variant="outline" className="bg-white" onClick={() => openTool("qualify")} data-testid="inspector-open-qualify">Requirements and evidence</Button>
      </div>
    </div>
  );
}

export default function Inspector({ target, sheet, items, edges, run, onSheet, onClose, openTool }) {
  const it = target?.item_id ? target : null;
  const head = it ? KIND_LABEL[it.kind] : target.kind === "package" ? "Scope package" : "Condition";
  return (
    <aside className="ws-panel-in flex h-full w-full flex-col border-l border-[#E2E8F0] bg-[#FFFFFF] min-[720px]:w-[360px]" data-testid="inspector-panel" aria-label="Inspector">
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">{head}</p>
        {(target.firm_id || target.firm) && <p className="truncate text-xs text-[#2F4A66]">{target.firm || firmName(sheet, target.firm_id)}</p>}
        <Button size="sm" variant="ghost" className="ml-auto h-8 px-2" onClick={onClose} aria-label="Close inspector" data-testid="inspector-close"><X className="h-4 w-4" /><span className="min-[720px]:hidden">Back</span></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!it && <h2 className="mb-3 text-[15px] font-semibold leading-snug text-[#1A2838]">{target.title}</h2>}
        {it ? <ItemForm it={it} sheet={sheet} items={items} edges={edges} run={run} onSheet={onSheet} />
          : target.kind === "package" ? <PackageDetail pkg={target} openTool={openTool} />
            : (
              <div className="space-y-3 text-sm text-[#1A2838]">
                {target.scope && <p className="text-[#64748B]">Applies to {target.scope}</p>}
                {target.source && <p className="text-xs text-[#64748B]">Source: {typeof target.source === "string" ? target.source : target.source.label || target.source.doc_id}</p>}
                {target.kind === "open_scope" ? (
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline" className="bg-white" onClick={() => openTool("details")} data-testid="inspector-open-add-firm">Add a known firm</Button>
                    <Button size="sm" variant="outline" className="bg-white" onClick={() => openTool("qualify")} data-testid="inspector-open-evidence">Attach evidence</Button>
                    <Button size="sm" variant="outline" className="bg-white" onClick={() => openTool("check")} data-testid="inspector-open-assign">Assign in the plan</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="w-full bg-white" onClick={() => openTool({ finding: "check", requirement: "qualify" }[target.kind] || "details")} data-testid="inspector-resolve">
                    {{ finding: "Edit allocation", requirement: "Review requirement" }[target.kind] || "Edit job details"}
                  </Button>
                )}
              </div>
            )}
      </div>
    </aside>
  );
}
