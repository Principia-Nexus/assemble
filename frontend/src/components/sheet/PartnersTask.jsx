import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Copy, Link2, Send, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import { api, errText, visitorId } from "@/lib/api";
import { STATUS, money, fmtTime, slug } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { TaskHeader } from "./Stepper";

function PartnerCard({ p, act, busy, demoPassword, blocked }) {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const id = slug(p.partner_id);
  const url = p.link ? window.location.origin + p.link.path : "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success("Link copied. Creating or copying a link does not send it."); }
    catch { toast.error("Copy failed. Select the link text and copy it manually."); }
  };
  const reviewAsDemo = async () => {
    try {
      const { data } = await api.post("/auth/login", { email: p.link.invite_email, password: demoPassword, visitor_id: visitorId() });
      setUser(data);
      navigate(p.link.path);
    } catch (e) { toast.error(errText(e)); }
  };
  const s = STATUS[p.status];
  return (
    <article data-testid={`partner-card-${id}`} className="lift flex flex-col rounded-md border border-slate-200 bg-white">
      <div className="space-y-2 border-b border-slate-100 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">{p.name}</h3>
          <span className="font-mono text-sm font-semibold">{money(p.terms.price_total_cents)}</span>
        </div>
        <StatusPill testId={`partner-card-status-${id}`} tone={s.tone} label={s.label} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 p-4 text-xs">
        <dt className="text-slate-500">Sites</dt><dd className="font-mono">{p.terms.sites.map((x) => `${x.site_id}·w${x.week}`).join(", ")}</dd>
        <dt className="text-slate-500">Advance / balance</dt><dd className="font-mono">{money(p.terms.advance_cents)} / {money(p.terms.balance_cents)}</dd>
        <dt className="text-slate-500">Invite email</dt><dd className="truncate font-mono">{p.link?.invite_email || "set when link is created"}</dd>
      </dl>
      <div className="mt-auto space-y-2 border-t border-slate-100 p-4">
        {!p.link ? (
          <Button className="w-full" disabled={busy || blocked} onClick={() => act("post", "/project/links", { partner_id: p.partner_id }, "Private link created. It is not sent until you share it.")} data-testid={`partner-card-create-link-${id}`}>
            <Link2 className="h-4 w-4" /> Create private review link
          </Button>
        ) : (
          <>
            <div className="flex gap-2">
              <input readOnly value={url} className="h-9 min-w-0 flex-1 rounded border border-slate-200 bg-slate-50 px-2 font-mono text-[11px]" data-testid={`partner-card-link-${id}`} onFocus={(e) => e.target.select()} />
              <Button size="sm" variant="outline" className="h-9" onClick={copy} data-testid={`partner-card-copy-link-${id}`}><Copy className="h-4 w-4" /></Button>
            </div>
            {p.link.shared_at ? (
              <p className="text-[11px] text-slate-500">You marked this as shared {fmtTime(p.link.shared_at)}.</p>
            ) : p.response || p.status === "needs_rereview" ? (
              <p className="text-[11px] text-slate-500">They have opened and answered this link.</p>
            ) : (
              <Button size="sm" variant="outline" className="w-full" disabled={busy} onClick={() => act("post", `/project/links/${p.link.token}/shared`, {}, "Marked as shared")} data-testid={`partner-card-mark-shared-${id}`}>
                <Send className="h-4 w-4" /> I've shared it with them
              </Button>
            )}
            {demoPassword && (
              <Button size="sm" variant="ghost" className="w-full text-slate-600" onClick={reviewAsDemo} data-testid={`partner-card-demo-review-${id}`}>
                <UserCheck className="h-4 w-4" /> Sign in as this partner (demo) to review
              </Button>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export default function PartnersTask({ sheet, act, busy, goTo }) {
  const [demoPassword, setDemoPassword] = useState(null);
  useEffect(() => {
    if (sheet.project.synthetic) api.get("/auth/demo-accounts").then((r) => setDemoPassword(r.data.password)).catch(() => {});
  }, [sheet.project.synthetic]);
  const partners = sheet.current?.partners || [];
  const blocked = sheet.current?.checker.overall === "fail";
  return (
    <section data-testid="task-ask" className="space-y-6">
      <TaskHeader step={3} title="Ask each partner" lead="Create a private link for each partner and share it yourself.">
        <Button variant="outline" onClick={() => goTo("decide")} data-testid="ask-next-button">Go to decide</Button>
      </TaskHeader>
      {blocked && (
        <div data-testid="ask-blocked-notice" role="status" className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between">
          <p><span className="font-semibold">Plan v{sheet.current.version.number} fails a check.</span></p>
          <Button size="sm" onClick={() => goTo("draft")} data-testid="ask-go-repair-button">Repair the draft</Button>
        </div>
      )}
      {!sheet.current ? (
        <p data-testid="ask-empty" className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Prepare a draft first.</p>
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {partners.map((p) => <PartnerCard key={p.partner_id} p={p} act={act} busy={busy} demoPassword={demoPassword} blocked={blocked} />)}
        </div>
      )}
    </section>
  );
}
