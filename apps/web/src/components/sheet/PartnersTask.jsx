import { toast } from "sonner";
import { Copy, Link2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import { STATUS, money, fmtDate, fmtTime, slug } from "@/lib/format";
import { TaskHeader } from "./Stepper";
import EmailInvite from "./EmailInvite";

function PartnerCard({ p, email, act, busy, blocked }) {
  const id = slug(p.partner_id);
  const url = p.link ? window.location.origin + p.link.path : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copied. Creating or copying a link does not send it."); }
    catch { toast.error("Copy failed. Select the link text and copy it manually."); }
  };
  const s = STATUS[p.status];
  return (
    <article data-testid={`partner-card-${id}`} className="lift rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
            {!["no_link", "link_not_shared"].includes(p.status) && <StatusPill testId={`partner-card-status-${id}`} tone={s.tone} label={s.label} />}
          </div>
          <p className="text-xs text-slate-600">{p.terms.sites.map((x) => `${x.name || x.site_id} (${x.week_start ? `week of ${fmtDate(x.week_start)}` : `wk ${x.week}`})`).join(" · ")}</p>
          <p className="text-xs text-slate-500">Advance {money(p.terms.advance_cents)} · balance {money(p.terms.balance_cents)} · to <span data-testid={`partner-card-recipient-${id}`} className="break-all font-mono text-slate-700">{p.link?.invite_email || email || "no email yet"}</span></p>
        </div>
        <span className="font-mono text-base font-semibold">{money(p.terms.price_total_cents)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
        {!p.link ? (
          <Button size="sm" disabled={busy || blocked} onClick={() => act("post", "/project/links", { partner_id: p.partner_id }, "Private link created. It is not sent until you share it.")} data-testid={`partner-card-create-link-${id}`}>
            <Link2 className="h-4 w-4" /> Request review
          </Button>
        ) : (
          <>
            <EmailInvite p={p} act={act} busy={busy} id={id} onCopy={copy} />
            <Button size="sm" variant="outline" onClick={copy} aria-label={`Copy review link for ${p.name}`} data-testid={`partner-card-copy-link-${id}`}><Copy className="h-4 w-4" /> Copy link</Button>
            {!p.link.shared_at && !p.response && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("post", `/project/links/${p.link.token}/shared`, {}, "Marked as shared")} data-testid={`partner-card-mark-shared-${id}`}>
                <Send className="h-4 w-4" /> I've shared it myself
              </Button>
            )}
            <p className="ml-auto text-[11px] text-slate-500" data-testid={`partner-card-history-${id}`}>
              {p.status === "needs_rereview" ? "Answered previous terms; revised terms await review."
                : p.response ? `Answered these terms ${fmtTime(p.response.created_at)}.`
                : p.link.emailed_at ? `Email accepted for sending ${fmtTime(p.link.emailed_at)} (delivery not confirmed). No answer yet.`
                : p.link.shared_at ? `Shared ${fmtTime(p.link.shared_at)}. No answer yet.` : "Not sent yet."}
            </p>
          </>
        )}
      </div>
    </article>
  );
}

export default function PartnersTask({ sheet, act, busy, goTo }) {
  const partners = sheet.current?.partners || [];
  const blocked = sheet.current?.checker.overall === "fail";
  return (
    <section data-testid="task-ask" className="space-y-6">
      <TaskHeader step={3} title="Invite" />
      {blocked && (
        <div data-testid="ask-blocked-notice" role="status" className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-semibold">Plan v{sheet.current.version.number} fails a check.</span></p>
          <Button size="sm" onClick={() => goTo("draft")} data-testid="ask-go-repair-button">Repair the draft</Button>
        </div>
      )}
      {!sheet.current ? (
        <p data-testid="ask-empty" className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No plan yet. Use Draft plan.</p>
      ) : (
        <div className="stagger space-y-3">
          {partners.map((p) => <PartnerCard key={p.partner_id} p={p} email={sheet.current.version.partners.find((x) => x.partner_id === p.partner_id)?.email} act={act} busy={busy} blocked={blocked} />)}
        </div>
      )}
    </section>
  );
}
