import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export default function JobConditions({ form, setForm }) {
  const list = form.job_conditions;
  const upd = (i, k, v) => setForm({ ...form, job_conditions: list.map((c, j) => (j === i ? { ...c, [k]: v } : c)) });
  const add = () => setForm({ ...form, job_conditions: [...list, { text: "", source: "", resolved: false }] });
  const remove = (i) => setForm({ ...form, job_conditions: list.filter((_, j) => j !== i) });
  return (
    <div data-testid="job-conditions" className="rounded-md border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">Job-wide conditions</p>
        <Button size="sm" variant="ghost" onClick={add} data-testid="job-condition-add-button"><Plus className="h-4 w-4" /> Add condition</Button>
      </div>
      {list.length === 0 && <p className="text-xs text-slate-500">None yet. Prerequisites for the whole job, such as site access or permits, go here.</p>}
      <ul className="space-y-2">
        {list.map((c, i) => (
          <li key={c.id || i} className="flex flex-wrap items-center gap-2" data-testid={`job-condition-row-${i}`}>
            <Input className="h-9 min-w-0 flex-1 bg-white" value={c.text} placeholder="What must be true for the job?" aria-label={`Job condition ${i + 1}`}
              onChange={(e) => upd(i, "text", e.target.value)} data-testid={`job-condition-text-${i}`} />
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <Checkbox checked={!!c.resolved} onCheckedChange={(v) => upd(i, "resolved", !!v)} aria-label={`Mark job condition ${i + 1} resolved`} data-testid={`job-condition-resolved-${i}`} /> Resolved
            </label>
            <Button size="sm" variant="ghost" className="h-9" onClick={() => remove(i)} aria-label={`Remove job condition ${i + 1}`} data-testid={`job-condition-remove-${i}`}><Trash2 className="h-4 w-4" /></Button>
            {c.source && <p className="w-full text-[11px] text-slate-500">From {c.source}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
