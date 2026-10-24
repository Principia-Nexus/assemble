import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusPill } from "@/components/StatusPill";
import { api, errList } from "@/lib/api";
import { fmtTime } from "@/lib/format";
import { toast } from "sonner";

const FS = {
  proposed: { label: "Proposed", tone: "pending" }, corrected: { label: "Corrected by you", tone: "pending" },
  applied: { label: "Used in job details", tone: "confirmed" }, invalid: { label: "Needs correction", tone: "declined" },
  rejected: { label: "Rejected", tone: "unknown" },
};

const who = (r) => [r.partner_name, r.site_id, r.week ? `week ${r.week}` : null].filter(Boolean).join(" · ") || "Job";

function FactLine({ f, current, onRead }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(f.value);
  const [err, setErr] = useState("");
  const save = async () => {
    try { const { data } = await api.put(`/project/facts/${f.fact_id}`, { value: val }); onRead(data); setEdit(false); setErr(""); }
    catch (e) { setErr(errList(e).join(" ")); }
  };
  const reject = async () => {
    try { const { data } = await api.post(`/project/facts/${f.fact_id}/reject`); onRead(data); } catch (e) { toast.error(errList(e).join(" ")); }
  };
  return (
    <div data-testid={`fact-${f.fact_id}`} className={current ? "" : "opacity-60"}>
      <div className="flex flex-wrap items-center gap-2">
        {edit ? (
          <>
            <Input className="h-8 w-40" value={val} onChange={(e) => setVal(e.target.value)} data-testid={`fact-edit-input-${f.fact_id}`} />
            <Button size="sm" onClick={save} data-testid={`fact-edit-save-${f.fact_id}`}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
          </>
        ) : (
          <>
            <span className={`font-mono text-sm font-semibold ${current ? "" : "line-through"}`}>{f.value || "(empty)"}</span>
            <StatusPill tone={FS[f.status].tone} label={FS[f.status].label} />
            {!current && <span className="text-[11px] text-slate-500">superseded by a later source</span>}
            {f.status !== "applied" && f.status !== "rejected" && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEdit(true)} aria-label="Correct" data-testid={`fact-edit-${f.fact_id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={reject} aria-label="Reject" data-testid={`fact-reject-${f.fact_id}`}><X className="h-3.5 w-3.5" /></Button>
              </>
            )}
          </>
        )}
      </div>
      {err && <p className="text-xs text-red-700">{err}</p>}
      <p className="mt-0.5 text-[11px] text-slate-500">
        {f.source_label} · {f.location ? `line ${f.location.line}` : "location not found"}: <q className="italic text-slate-700">{f.excerpt || "no excerpt"}</q>
      </p>
      {f.issues?.length > 0 && <p className="text-[11px] text-red-700">{f.issues.join(" ")}</p>}
      {f.note && <p className="text-[11px] text-slate-500">Reader note: {f.note}</p>}
      {f.corrections?.length > 0 && (
        <ul className="mt-0.5 text-[11px] text-slate-500">
          <li>Original reading: "{f.original_value}"</li>
          {f.corrections.map((c) => <li key={c.at}>{c.by} changed "{c.prior_value}" → "{c.new_value}" · {fmtTime(c.at)}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function ReadingsTable({ readings, selected, setSelected, onRead }) {
  if (!readings.length) return null;
  const toggle = (id) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div data-testid="readings-table" className="rounded-md border border-slate-200 bg-white">
      <p className="eyebrow border-b border-slate-200 p-4">Readings · the latest dated source wins; conflicts stay visible</p>
      <ul className="divide-y divide-slate-100">
        {readings.map((r) => {
          const usable = r.reading && ["proposed", "corrected"].includes(r.reading.status);
          return (
            <li key={r.target} data-testid={`reading-${r.target.replace(/[^a-z0-9]+/gi, "-")}`} className="flex gap-3 p-4">
              <div className="pt-1">
                <Checkbox disabled={!usable} checked={usable && selected.includes(r.reading.fact_id)} onCheckedChange={() => toggle(r.reading.fact_id)}
                  aria-label={`Use ${r.label}`} data-testid={`reading-select-${r.reading?.fact_id || r.target}`} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{r.label}</p>
                  <span className="text-xs text-slate-500">{who(r)}</span>
                  {r.conflict && <StatusPill tone="pending" label="Sources disagree" />}
                </div>
                {[...r.facts].reverse().map((f) => (
                  <FactLine key={f.fact_id} f={f} current={r.reading?.fact_id === f.fact_id || f.status === "invalid"} onRead={onRead} />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
