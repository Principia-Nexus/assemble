import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { F } from "./IntakeTask";
import { slug } from "@/lib/format";

const BLANK = { name: "", email: "", price_per_site: "", capacity: [], max_sites: "", payer: "", advance_pct: "",
  balance_terms: "", conditions: "", exclusions: "", scope: "", valid_until: "" };

function PartnerFields({ p, i, upd, weeks }) {
  const t = (k) => `intake-partner-${i}-${k}`;
  const field = (k, label, extra = {}) => (
    <F id={t(k)} label={label} value={p[k]} onChange={(e) => upd(i, k, e.target.value)} data-testid={t(k)} {...extra} />
  );
  const setCap = (w, v) => { const c = [...(p.capacity || [])]; c[w] = v; upd(i, "capacity", c); };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {field("name", "Firm name")}
      {field("email", "Contact email (review link opens only for it)", { type: "email" })}
      {field("price_per_site", "Price per site (USD)", { inputMode: "decimal" })}
      {field("max_sites", "Quoted site limit", { inputMode: "numeric" })}
      {field("payer", "Who pays this partner")}
      {field("advance_pct", "Advance (% of their total)", { inputMode: "numeric" })}
      {field("balance_terms", "Balance terms")}
      {field("valid_until", "Quote valid until", { type: "date" })}
      {field("conditions", "Conditions / prerequisites")}
      {field("exclusions", "Exclusions")}
      {field("scope", "Their scope", { className: "sm:col-span-2" })}
      <div className="sm:col-span-2">
        <Label className="text-xs font-semibold text-slate-700">Crew capacity (sites per week)</Label>
        {weeks ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {Array.from({ length: weeks }).map((_, w) => (
              <Input key={w} className="h-9 w-20 bg-white" placeholder={`Wk ${w + 1}`} inputMode="numeric" aria-label={`Capacity week ${w + 1}`}
                value={(p.capacity || [])[w] || ""} onChange={(e) => setCap(w, e.target.value)} data-testid={`${t("capacity")}-week-${w + 1}`} />
            ))}
          </div>
        ) : <p className="mt-1 text-xs text-slate-500">Enter the number of weeks first.</p>}
      </div>
    </div>
  );
}

export default function IntakePartners({ form, setForm, weeks }) {
  const upd = (i, k, v) => setForm({ ...form, partners: form.partners.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
  const add = () => setForm({ ...form, partners: [...form.partners, { ...BLANK }] });
  const remove = (i) => setForm({ ...form, partners: form.partners.filter((_, j) => j !== i) });
  return (
    <div className="rounded-md border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Known partners ({form.partners.length})</p>
        <Button size="sm" variant="outline" onClick={add} data-testid="intake-add-partner-button"><Plus className="h-4 w-4" /> Add partner</Button>
      </div>
      {form.partners.length === 0 && (
        <p data-testid="intake-partners-empty" className="rounded border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No partners yet. Add each trusted firm you might ask.</p>
      )}
      <Accordion type="multiple">
        {form.partners.map((p, i) => (
          <AccordionItem key={p.partner_id || `new-${i}`} value={p.partner_id || `new-${i}`}>
            <AccordionTrigger className="py-3 text-sm" data-testid={`intake-partner-toggle-${slug(p.name) || i}`}>
              <span className="flex flex-col items-start text-left">
                <span className="font-semibold">{p.name || "New partner"}</span>
                <span className="font-mono text-[11px] font-normal text-slate-500">
                  {p.price_per_site ? `$${p.price_per_site}/site` : "price unknown"} · capacity {(p.capacity || []).slice(0, weeks).map((c) => c || "?").join("/") || "unknown"}
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <PartnerFields p={p} i={i} upd={upd} weeks={weeks} />
              <Button size="sm" variant="ghost" className="mt-3 text-red-700" onClick={() => remove(i)} data-testid={`intake-partner-remove-${i}`}>
                <Trash2 className="h-4 w-4" /> Remove partner
              </Button>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
