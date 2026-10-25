import { useEffect, useState } from "react";
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
const usableOf = (r) => r.reading && ["proposed", "corrected"].includes(r.reading.status);
const rank = (r) => (r.conflict || r.facts.some((f) => f.status === "invalid") ? 0 : usableOf(r) ? 1 : 2);
const tid = (t) => t.replace(/[^a-z0-9]+/gi, "-");

function FactLine({ f, current, onRead }) {
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(f.value);
  const [err, setErr] = useState("");
  useEffect(() => { setVal(f.value); }, [f.value]);
  const save = async () => {
    try { const { data } = await api.put(`/project/facts/${f.fact_id}`, { value: val }); onRead(data); setEdit(false); setErr(""); }
    catch (e) { setErr(errList(e).join(" ")); }
  };
  const reject = async () => {
    try { const { data } = await api.post(`/project/facts/${f.fact_id}/reject`); onRead(data); } catch (e) { toast.error(errList(e).join(" ")); }
  };
  const where = f.location ? `${f.location.page ? `page ${f.location.page}, ` : ""}line ${f.location.line}` : "location not found";
  return (
    <div data-testid={`fact-${f.fact_id}`} className={current ? "" : "opacity-60"}>
      <div className="flex flex-wrap items-center gap-2">
        {edit ? (
          <>
            <Input className="h-8 w-40" value={val} onChange={(e) => setVal(e.target.value)} aria-label={`Corrected value for ${f.label}`} data-testid={`fact-edit-input-${f.fact_id}`} />
            <Button size="sm" onClick={save} data-testid={`fact-edit-save-${f.fact_id}`}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)} data-testid={`fact-edit-cancel-${f.fact_id}`}>Cancel</Button>
          </>
        ) : (
          <>
            <span className={`font-mono text-sm font-semibold ${current ? "" : "line-through"}`}>{f.value || "(empty)"}</span>
            <StatusPill tone={FS[f.status].tone} label={FS[f.status].label} />
            {!current && <span className="text-[11px] text-slate-500">superseded by a later source</span>}
            {f.status !== "applied" && f.status !== "rejected" && (
              <>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEdit(true)} aria-label={`Correct ${f.label} from ${f.source_label}`} data-testid={`fact-edit-${f.fact_id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={reject} aria-label={`Reject ${f.label} from ${f.source_label}`} data-testid={`fact-reject-${f.fact_id}`}><X className="h-3.5 w-3.5" /></Button>
              </>
            )}
          </>
        )}
      </div>
      {err && <p className="text-xs text-red-700">{err}</p>}
      <details className="mt-0.5 text-[11px] text-slate-500">
        <summary className="cursor-pointer" data-testid={`fact-evidence-${f.fact_id}`}>{f.source_label} · {where}</summary>
        <q className="italic text-slate-700">{f.excerpt || "no excerpt"}</q>
      </details>
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

function Reading({ r, selected, toggle, onRead }) {
  const usable = usableOf(r);
  return (
    <li data-testid={`reading-${tid(r.target)}`} className="flex gap-3 p-4">
      <div className="pt-1">
        <Checkbox disabled={!usable} checked={usable && selected.includes(r.reading.fact_id)} onCheckedChange={() => toggle(r.reading.fact_id)}
          aria-label={`Use ${r.label} for ${who(r)}`} data-testid={`reading-select-${r.reading?.fact_id || r.target}`} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-900">{r.label}</p>
          <span className="text-xs text-slate-500">{who(r)}</span>
          {r.conflict && <StatusPill tone="pending" label="Sources differ · latest dated source proposed" />}
          {r.corroborated && <StatusPill tone="confirmed" label={`Same value in ${new Set(r.facts.map((f) => f.source_id)).size} sources`} />}
        </div>
        {[...r.facts].reverse().map((f) => (
          <FactLine key={f.fact_id} f={f} current={r.reading?.fact_id === f.fact_id || f.status === "invalid" || (r.corroborated && f.status !== "rejected")} onRead={onRead} />
        ))}
      </div>
    </li>
  );
}

function Group({ field, items, selected, setSelected, toggle, onRead }) {
  const ids = items.filter(usableOf).map((r) => r.reading.fact_id);
  const all = ids.length > 0 && ids.every((id) => selected.includes(id));
  const setAll = () => setSelected(all ? selected.filter((x) => !ids.includes(x)) : [...new Set([...selected, ...ids])]);
  return (
    <li data-testid={`reading-group-${tid(field)}`} className="p-4">
      <details>
        <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
          <Checkbox disabled={!ids.length} checked={all} onCheckedChange={setAll} onClick={(e) => e.stopPropagation()} aria-label={`Use all ${items[0].label} readings`} data-testid={`reading-group-select-${tid(field)}`} />
          <span className="font-semibold text-slate-900">{items[0].label} · {items.length} sites</span>
          <span className="font-mono text-xs text-slate-500">{items.map((r) => `${r.site_id} ${r.reading?.value ?? "?"}`).join(", ")}</span>
        </summary>
        <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
          {items.map((r) => <Reading key={r.target} r={r} selected={selected} toggle={toggle} onRead={onRead} />)}
        </ul>
      </details>
    </li>
  );
}

export default function ReadingsTable({ readings, selected, setSelected, onRead }) {
  if (!readings.length) return null;
  const toggle = (id) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const sorted = [...readings].sort((a, b) => rank(a) - rank(b));
  const siteGroups = {};
  sorted.forEach((r) => { if (r.scope === "site" && rank(r) > 0) (siteGroups[r.field] = siteGroups[r.field] || []).push(r); });
  const grouped = new Set(Object.values(siteGroups).filter((g) => g.length > 3).flat().map((r) => r.target));
  const shownGroups = new Set();
  return (
    <div data-testid="readings-table" className="rounded-md border border-slate-200 bg-white">
      <p className="eyebrow border-b border-slate-200 p-4">Readings · items needing attention first</p>
      <ul className="stagger divide-y divide-slate-100">
        {sorted.map((r) => {
          if (!grouped.has(r.target)) return <Reading key={r.target} r={r} selected={selected} toggle={toggle} onRead={onRead} />;
          if (shownGroups.has(r.field)) return null;
          shownGroups.add(r.field);
          return <Group key={r.field} field={r.field} items={siteGroups[r.field]} selected={selected} setSelected={setSelected} toggle={toggle} onRead={onRead} />;
        })}
      </ul>
    </div>
  );
}
