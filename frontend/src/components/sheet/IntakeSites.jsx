import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function IntakeSites({ form, setForm, weeks }) {
  const upd = (i, k, v) => {
    const sites = form.sites.map((s, j) => (j === i ? { ...s, [k]: v } : s));
    setForm({ ...form, sites });
  };
  const add = () => {
    const n = form.sites.length + 1;
    setForm({ ...form, sites: [...form.sites, { site_id: `S${String(n).padStart(2, "0")}`, name: "", deadline_week: "", scope: "" }] });
  };
  const remove = (i) => setForm({ ...form, sites: form.sites.filter((_, j) => j !== i) });

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">Sites ({form.sites.length})</p>
        <Button size="sm" variant="outline" onClick={add} data-testid="intake-add-site-button"><Plus className="h-4 w-4" /> Add site</Button>
      </div>
      {form.sites.length === 0 ? (
        <p data-testid="intake-sites-empty" className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No sites yet. Add each branch or location as one row.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <th className="pb-2 pr-2 font-semibold">ID</th><th className="pb-2 pr-2 font-semibold">Name</th>
                <th className="pb-2 pr-2 font-semibold">Due by week{weeks ? ` (1–${weeks})` : ""}</th><th className="pb-2 pr-2 font-semibold">Scope</th><th />
              </tr>
            </thead>
            <tbody>
              {form.sites.map((s, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2"><Input className="h-8 w-20 font-mono" value={s.site_id} onChange={(e) => upd(i, "site_id", e.target.value)} data-testid={`intake-site-id-${i}`} /></td>
                  <td className="py-1.5 pr-2"><Input className="h-8" value={s.name} onChange={(e) => upd(i, "name", e.target.value)} data-testid={`intake-site-name-${i}`} /></td>
                  <td className="py-1.5 pr-2"><Input className="h-8 w-20" inputMode="numeric" placeholder="unknown" value={s.deadline_week} onChange={(e) => upd(i, "deadline_week", e.target.value)} data-testid={`intake-site-deadline-${i}`} /></td>
                  <td className="py-1.5 pr-2"><Input className="h-8" value={s.scope} onChange={(e) => upd(i, "scope", e.target.value)} data-testid={`intake-site-scope-${i}`} /></td>
                  <td className="py-1.5"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(i)} aria-label="Remove site" data-testid={`intake-site-remove-${i}`}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
