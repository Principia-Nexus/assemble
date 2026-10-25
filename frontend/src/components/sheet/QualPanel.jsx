import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { firmName } from "@/components/ws/derive";

const ST = { suggested: ["Review needed", "text-[#B4690E]"], required: ["Required", "text-[#1A2838]"], document: ["Required by source", "text-[#1A2838]"], confirmed: ["Confirmed by organizer", "text-[#1E7B5C]"], dismissed: ["Dismissed", "text-[#94A3B8]"] };
const row = "flex flex-wrap items-start gap-2 border-b border-slate-100 py-2.5 last:border-0";

function Requirement({ r, act, busy, sheet }) {
  const [why, setWhy] = useState(null);
  const [st, cls] = ST[r.origin === "document" && r.status === "required" ? "document" : r.status];
  return (
    <li className={row} data-testid={`req-${r.req_id}`}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{r.label} <span className={`ml-1 text-xs font-medium ${cls}`} data-testid={`req-status-${r.req_id}`}>{st}</span></p>
        <p className="text-xs text-slate-500">{r.firm ? `${firmName(sheet, r.firm)} · ` : ""}{r.reason || r.source?.label}{r.source?.page ? ` · page ${r.source.page}` : ""}{r.sites !== "all" ? ` · ${r.sites.join(", ")}` : ""}{r.dismiss_reason ? ` · dismissed: ${r.dismiss_reason}` : ""}</p>
      </div>
      {(r.status === "suggested" || (r.status === "required" && r.origin === "organizer")) && why === null && (
        <div className="flex gap-1.5">
          {r.status === "suggested" && <Button size="sm" variant="outline" disabled={busy} onClick={() => act("post", `/project/requirements/${r.req_id}/confirm`, {}, "Review recorded")} data-testid={`req-confirm-${r.req_id}`}>Confirm</Button>}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setWhy("")} data-testid={`req-dismiss-${r.req_id}`}>Dismiss</Button>
        </div>
      )}
      {why !== null && (
        <form className="flex w-full gap-2" onSubmit={async (e) => { e.preventDefault(); const x = await act("post", `/project/requirements/${r.req_id}/dismiss`, { reason: why }, "Dismissed"); if (x.ok) setWhy(null); }}>
          <Input autoFocus value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why it doesn't apply" data-testid={`req-dismiss-reason-${r.req_id}`} />
          <Button size="sm" type="submit" disabled={busy || why.trim().length < 5} data-testid={`req-dismiss-save-${r.req_id}`}>Dismiss</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setWhy(null)} data-testid={`req-dismiss-cancel-${r.req_id}`}>Cancel</Button>
        </form>
      )}
    </li>
  );
}

function AddEvidence({ sheet, act, busy, firm }) {
  const blank = { license_class: "", license_number: "", expires: "", entity_name: "", source_record: "", observed_status: "active", observed_on: "" };
  const [f, setF] = useState({ partner_id: firm || "", ...blank });
  const firms = [...(sheet.intake.partners || []).map((p) => [p.partner_id, p.name]), ["own", "Your firm"]];
  const save = async (e) => {
    e.preventDefault();
    const r = await act("post", "/project/evidence", { ...f, expires: f.expires || null, observed_on: f.observed_on || null, entity_name: f.entity_name || null }, "Evidence recorded as reviewed by you");
    if (r.ok) setF({ partner_id: f.partner_id, ...blank });
  };
  return (
    <form onSubmit={save} className="grid gap-2 sm:grid-cols-4" data-testid="evidence-form">
      <Select value={f.partner_id} onValueChange={(v) => setF({ ...f, partner_id: v })}>
        <SelectTrigger className="h-9" aria-label="Firm" data-testid="evidence-firm"><SelectValue placeholder="Firm…" /></SelectTrigger>
        <SelectContent>{firms.map(([id, n]) => <SelectItem key={id} value={id} data-testid={`evidence-firm-${id}`}>{n}</SelectItem>)}</SelectContent>
      </Select>
      <Input placeholder="Class, e.g. C-10" value={f.license_class} onChange={(e) => setF({ ...f, license_class: e.target.value })} aria-label="Licence class" data-testid="evidence-class" />
      <Input placeholder="Licence no." value={f.license_number} onChange={(e) => setF({ ...f, license_number: e.target.value })} aria-label="Licence number" data-testid="evidence-number" />
      <Input type="date" value={f.expires} onChange={(e) => setF({ ...f, expires: e.target.value })} aria-label="Expires" title="Expires" data-testid="evidence-expires" />
      <Input className="sm:col-span-2" placeholder="Licence holder on the record" value={f.entity_name} onChange={(e) => setF({ ...f, entity_name: e.target.value })} aria-label="Licence holder" data-testid="evidence-entity" />
      <Input className="sm:col-span-2" placeholder="Source record, e.g. CSLB detail page screenshot" value={f.source_record} onChange={(e) => setF({ ...f, source_record: e.target.value })} aria-label="Source record" data-testid="evidence-source" />
      <Select value={f.observed_status} onValueChange={(v) => setF({ ...f, observed_status: v })}>
        <SelectTrigger className="h-9" aria-label="Observed status" data-testid="evidence-status"><SelectValue /></SelectTrigger>
        <SelectContent>{["active", "expired", "suspended", "inactive", "revoked"].map((x) => <SelectItem key={x} value={x} data-testid={`evidence-status-${x}`}>Status shown: {x}</SelectItem>)}</SelectContent>
      </Select>
      <Input type="date" max={new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" })} value={f.observed_on} onChange={(e) => setF({ ...f, observed_on: e.target.value })} aria-label="Observed on" title="Observed on" data-testid="evidence-observed-on" />
      <Button size="sm" type="submit" className="h-9 sm:col-span-2" disabled={busy || !f.partner_id || !f.license_class.trim() || !f.source_record.trim() || !f.observed_on} data-testid="evidence-save">Record reviewed evidence</Button>
    </form>
  );
}

export default function QualPanel({ sheet, act, busy, firm }) {
  const q = sheet.qual;
  const [req, setReq] = useState("");
  const [ex, setEx] = useState({ text: "", level: "job", target: "" });
  const targets = ex.level === "scope" ? (sheet.intake.sites || []).map((s) => [s.site_id, `${s.site_id} ${s.name || ""}`]) : ex.level === "firm" ? (sheet.intake.partners || []).map((p) => [p.partner_id, p.name]) : [];
  return (
    <section className="space-y-6" data-testid="qual-panel">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Requirements</h3>
        <ul data-testid="req-list">{q.requirements.map((r) => <Requirement key={r.req_id} r={r} act={act} busy={busy} sheet={sheet} />)}</ul>
        <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); const r = await act("post", "/project/requirements", { code: req, sites: "all" }, "Requirement added"); if (r.ok) setReq(""); }}>
          <Input value={req} onChange={(e) => setReq(e.target.value)} placeholder="Add a requirement, e.g. C-39" data-testid="req-add-input" />
          <Button size="sm" type="submit" className="h-9" disabled={busy || !req.trim()} data-testid="req-add">Add</Button>
        </form>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Licence evidence</h3>
        <ul className="mb-2" data-testid="evidence-list">
          {q.evidence.map((e) => (
            <li key={e.ev_id} className={row} data-testid={`evidence-${e.ev_id}`}>
              <p className="min-w-0 flex-1 text-sm text-slate-800"><span className="font-semibold">{e.partner_id === "own" ? "Your firm" : firmName(sheet, e.partner_id)}</span> · {e.license_class}{e.license_number ? ` #${e.license_number}` : ""}{e.expires ? ` · expires ${e.expires}` : ""}
                <span className="block text-xs text-slate-500">{e.observed_status ? `Status ${e.observed_status} observed ${e.observed_on} · ${e.source_record}${e.entity_name ? ` · holder: ${e.entity_name}${e.entity_match === false ? " (name differs)" : ""}` : ""}` : "Current status not recorded"}</span>
                <span className="block text-xs text-slate-400">Evidence reviewed by {e.reviewed_by}, {e.reviewed_at.slice(0, 10)}</span></p>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("delete", `/project/evidence/${e.ev_id}`, undefined, "Removed")} data-testid={`evidence-remove-${e.ev_id}`}>Remove</Button>
            </li>
          ))}
        </ul>
        <AddEvidence sheet={sheet} act={act} busy={busy} firm={firm} />
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-900">Exclusions</h3>
        <ul data-testid="exclusion-list">
          {q.exclusions.map((x) => (
            <li key={x.ex_id} className={row} data-testid={`exclusion-${x.ex_id}`}>
              <p className="min-w-0 flex-1 text-sm text-slate-800">{x.text} <span className="text-xs text-slate-500">· {x.level === "job" ? "whole job" : x.level === "scope" ? x.target : firmName(sheet, x.target)}{x.source ? ` · from ${x.source}` : ""}</span></p>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("delete", `/project/exclusions/${x.ex_id}`, undefined, "Removed")} data-testid={`exclusion-remove-${x.ex_id}`}>Remove</Button>
            </li>
          ))}
        </ul>
        <form className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]" onSubmit={async (e) => { e.preventDefault(); const r = await act("post", "/project/exclusions", { ...ex, target: ex.target || null }, "Exclusion added"); if (r.ok) setEx({ ...ex, text: "" }); }}>
          <Input value={ex.text} onChange={(e) => setEx({ ...ex, text: e.target.value })} placeholder="What is excluded" data-testid="exclusion-text" />
          <Select value={ex.level} onValueChange={(v) => setEx({ ...ex, level: v, target: "" })}>
            <SelectTrigger className="h-9 w-32" aria-label="Applies to" data-testid="exclusion-level"><SelectValue /></SelectTrigger>
            <SelectContent>{[["job", "Whole job"], ["scope", "Scope"], ["firm", "Firm"]].map(([k, l]) => <SelectItem key={k} value={k} data-testid={`exclusion-level-${k}`}>{l}</SelectItem>)}</SelectContent>
          </Select>
          {targets.length > 0 && (
            <Select value={ex.target} onValueChange={(v) => setEx({ ...ex, target: v })}>
              <SelectTrigger className="h-9 w-44" aria-label="Target" data-testid="exclusion-target"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>{targets.map(([id, n]) => <SelectItem key={id} value={id} data-testid={`exclusion-target-${id}`}>{n}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Button size="sm" type="submit" className="h-9" disabled={busy || !ex.text.trim() || (ex.level !== "job" && !ex.target)} data-testid="exclusion-add">Add</Button>
        </form>
      </div>
      <p className="text-[11px] text-slate-400">Rules {sheet.rules?.qualification}. Evidence reviewed by you is not an official registry check.</p>
    </section>
  );
}
