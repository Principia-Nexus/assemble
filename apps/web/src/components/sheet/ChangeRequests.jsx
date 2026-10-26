import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import { money, fmtTime } from "@/lib/format";

const CR_STATUS = {
  open: { label: "Open", tone: "pending" },
  in_preview: { label: "In amendment preview", tone: "pending" },
  applied: { label: "Applied in a selected version", tone: "confirmed" },
  closed: { label: "Closed without change", tone: "unknown" },
};

export default function ChangeRequests({ sheet, act, busy }) {
  const crs = sheet.change_requests;
  if (!crs.length) return null;
  return (
    <div data-testid="change-requests-list" className="rounded-md border border-slate-200 bg-white">
      <p className="eyebrow border-b border-slate-200 p-4">Change requests · saved apart from the plan and the preview</p>
      <ul className="divide-y divide-slate-100">
        {crs.map((c) => {
          const gone = c.partner_id && !sheet.current?.partners.some((p) => p.partner_id === c.partner_id);
          return (
          <li key={c.cr_id} data-testid={`change-request-${c.cr_id}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-slate-900">{c.source === "partner" ? c.partner_name : "Customer (logged by you)"} · against v{c.version_number}</p>
              <p className="mt-0.5 text-slate-700">{c.note}</p>
              <p className="mt-1 font-mono text-[11px] text-slate-500">
                {c.moves.map((m) => `${m.site_id} → week ${m.new_week}`).join(", ")}
                {c.proposed_total_cents != null && `Proposed total ${money(c.proposed_total_cents)}`} · {fmtTime(c.created_at)}
              </p>
              {gone && c.status === "open" && <p data-testid={`change-request-inapplicable-${c.cr_id}`} className="mt-1 text-xs text-slate-600">Historical: {c.partner_name} has no sites in the current plan v{sheet.current.version.number}, so this request can't change it. Close it.</p>}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <StatusPill tone={CR_STATUS[c.status].tone} label={CR_STATUS[c.status].label} />
              {c.status === "open" && !sheet.preview && (
                <>
                  {!gone && <Button size="sm" disabled={busy} onClick={() => act("post", "/project/preview", { rev: sheet.project.rev, change_request_id: c.cr_id }, "Opened as amendment preview")} data-testid={`change-request-open-${c.cr_id}`}>Open as preview</Button>}
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("post", `/project/change-requests/${c.cr_id}/close`, {}, "Request closed")} data-testid={`change-request-close-${c.cr_id}`}>Close</Button>
                </>
              )}
            </div>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
