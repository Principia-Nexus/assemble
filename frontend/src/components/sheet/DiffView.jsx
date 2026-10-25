import { StatusPill } from "@/components/StatusPill";
import { fmtDate, money, slug } from "@/lib/format";

const STATE = {
  unchanged: { label: "Unchanged", tone: "confirmed" },
  changed: { label: "Changed by this amendment: must review", tone: "pending" },
  added: { label: "New: must review", tone: "pending" },
  removed: { label: "Removed from plan", tone: "declined" },
};
const CARRY = ["confirmed", "confirmed_conditional", "declined", "change_requested"];

function Side({ t, kind }) {
  if (!t) return <p className="text-xs italic text-slate-400">{kind === "before" ? "Not in plan" : "Removed"}</p>;
  return (
    <div className="space-y-0.5 text-xs">
      <p className="font-mono">{t.sites.join(", ") || "no sites"}</p>
      <p>Total <span className="font-mono font-semibold">{money(t.price_total_cents)}</span> · advance {money(t.advance_cents)}</p>
    </div>
  );
}

export default function DiffView({ diff }) {
  return (
    <div data-testid="amend-diff-view" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="eyebrow">Total</p>
          <p className="mt-1 font-mono text-sm"><span className="text-slate-400 line-through">{money(diff.total_before_cents)}</span> → <span data-testid="amend-diff-total-after" className="font-semibold">{money(diff.total_after_cents)}</span></p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-3">
          <p className="eyebrow">Weekly load</p>
          <p className="mt-1 font-mono text-sm"><span className="text-slate-400">{diff.weekly_before.map((w) => w.load).join(" / ")}</span> → <span data-testid="amend-diff-weekly-after" className="font-semibold">{diff.weekly_after.map((w) => w.load).join(" / ")}</span></p>
        </div>
      </div>
      {diff.sites.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full min-w-[480px] text-xs">
            <thead><tr className="text-left font-mono text-[10px] text-slate-500"><th className="p-2">Site</th><th className="p-2">Current plan</th><th className="p-2">Proposed</th></tr></thead>
            <tbody>
              {diff.sites.map((s) => (
                <tr key={s.site_id} className="border-t border-slate-100" data-testid={`amend-diff-site-${s.site_id}`}>
                  <td className="p-2"><span className="font-semibold">{s.after?.name || s.before?.name || s.site_id}</span> <span className="font-mono text-[10px] text-slate-500">{s.site_id}</span></td>
                  <td className="p-2 text-red-700 line-through decoration-red-300">{s.before ? `${s.before.owner_name} · ${s.before.week_start ? `week of ${fmtDate(s.before.week_start)}` : `wk ${s.before.week}`} · due ${s.before.deadline_end ? fmtDate(s.before.deadline_end) : s.before.deadline_week ?? "?"}` : "—"}</td>
                  <td className="p-2 text-emerald-800">{s.after ? `${s.after.owner_name} · ${s.after.week_start ? `week of ${fmtDate(s.after.week_start)}` : `wk ${s.after.week}`} · due ${s.after.deadline_end ? fmtDate(s.after.deadline_end) : s.after.deadline_week ?? "?"}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PartnerDiffs list={diff.partners.filter((p) => p.state !== "unchanged")} />
      {diff.partners.some((p) => p.state === "unchanged") && (
        <details className="rounded-md border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700" data-testid="amend-diff-unchanged-toggle">Unchanged partners · {diff.partners.filter((p) => p.state === "unchanged").length}</summary>
          <div className="mt-3"><PartnerDiffs list={diff.partners.filter((p) => p.state === "unchanged")} /></div>
        </details>
      )}
    </div>
  );
}

function PartnerDiffs({ list }) {
  return (
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((p) => {
          const carries = p.state === "unchanged" && CARRY.includes(p.current_status);
          return (
            <div key={p.partner_id} data-testid={`amend-diff-partner-${slug(p.partner_id)}`} className="rounded-md border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">{p.name}</p>
                <StatusPill testId={`amend-diff-partner-state-${slug(p.partner_id)}`} tone={STATE[p.state].tone} label={STATE[p.state].label} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div><p className="eyebrow mb-1">Current plan</p><Side t={p.before} kind="before" /></div>
                <div><p className="eyebrow mb-1">Proposed</p><Side t={p.after} kind="after" /></div>
              </div>
              {p.state === "unchanged" && (
                <p className="mt-2 text-[11px] text-slate-500">{carries ? "Their current response carries over if still valid." : "Already awaiting a response; not caused by this change."}</p>
              )}
              {(p.reasons?.length ? p.reasons : p.changes).length > 0 && p.state === "changed" && <p data-testid={`amend-diff-reasons-${slug(p.partner_id)}`} className="mt-2 text-[11px] text-amber-800">Why: {p.reasons?.length ? p.reasons.join("; ") : p.changes.join(", ").replaceAll("_cents", "").replaceAll("_", " ")}</p>}
            </div>
          );
        })}
      </div>
  );
}
