import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BackToOrganizer } from "@/components/ReviewAs";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import AppHeader from "@/components/AppHeader";
import { StatusPill, SynthBadge } from "@/components/StatusPill";
import { ErrorList } from "@/components/sheet/Stepper";
import { api, errList, newKey } from "@/lib/api";
import { STATUS, money, fmtDate, fmtTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Loading } from "@/App";

const ACTION = { confirm: "Confirmed", request_change: "Requested a change", decline: "Declined" };

function Terms({ t, shared = [] }) {
  const row = (label, value, id) => (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-t border-slate-100 py-2 text-sm" data-testid={id}>
      <dt className="text-slate-500">{label}</dt><dd className="text-slate-900">{value || "Unknown"}</dd>
    </div>
  );
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead><tr className="text-left font-mono text-[10px] text-slate-500"><th className="p-3">Site</th><th className="p-3">Week</th><th className="p-3">Dates</th><th className="p-3">Scope</th></tr></thead>
          <tbody>
            {t.sites.map((s) => (
              <tr key={s.site_id} className="border-t border-slate-100" data-testid={`review-site-${s.site_id}`}>
                <td className="p-3"><span className="font-mono font-semibold">{s.site_id}</span> <span className="text-xs text-slate-500">{s.name}</span></td>
                <td className="p-3 font-mono">{s.week}</td>
                <td className="p-3 text-xs">{s.week_start ? `${fmtDate(s.week_start)} – ${fmtDate(s.week_end)}` : "Unknown"}</td>
                <td className="p-3 text-xs">{s.scope || "Unknown"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dl className="px-4 pb-2">
        {row("Your price", <span className="font-mono font-semibold">{money(t.price_total_cents)}</span>, "review-price")}
        {row("Per site", t.price_per_site_cents != null ? `${money(t.price_per_site_cents)}${t.adjustment_cents ? ` · adjustment ${money(t.adjustment_cents)}` : ""}` : null)}
        {row("Payer", t.payer)}
        {row("Advance", t.advance_cents != null ? `${money(t.advance_cents)} (${t.advance_pct}%)` : null, "review-advance")}
        {row("Balance", t.balance_cents != null ? `${money(t.balance_cents)} · ${t.balance_terms || "terms unknown"}` : t.balance_terms)}
        {row("Your scope", t.scope)}
        {row("Exclusions", t.exclusions)}
        {row("Conditions", t.conditions || "None stated")}
        {shared.length > 0 && row("Job-wide conditions", (
          <ul className="space-y-1">
            {shared.map((c) => (
              <li key={c.text} data-testid="review-shared-condition">
                {c.text} <span className={`text-xs font-semibold ${c.resolved ? "text-emerald-700" : "text-amber-800"}`}>{c.resolved ? "resolved" : "unresolved"}</span>
                {c.source && <span className="block text-xs text-slate-500">Source: {c.source}</span>}
              </li>
            ))}
          </ul>
        ), "review-shared-conditions")}
        {row("Valid until", t.valid_until ? `${fmtDate(t.valid_until)} (recheck after this date)` : null)}
      </dl>
    </div>
  );
}

function RespondBox({ data, token, onDone }) {
  const [mode, setMode] = useState(null);
  const [note, setNote] = useState("");
  const [conditions, setConditions] = useState("");
  const [proposed, setProposed] = useState("");
  const [errors, setErrors] = useState([]);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());

  const submit = async () => {
    setBusy(true);
    try {
      const { data: r } = await api.post(`/review/${token}/respond`, {
        version_id: data.version.version_id, terms_hash: data.terms_hash, action: mode,
        note, conditions: mode === "confirm" ? conditions : null, proposed_total: mode === "request_change" ? proposed : null,
        idempotency_key: key.current,
      });
      key.current = newKey();
      setErrors([]); setMode(null); setNote(""); setConditions(""); setProposed("");
      toast.success(r.duplicate ? "Already saved. Nothing was submitted twice." : "Response saved against these exact terms");
      onDone(r.review);
    } catch (e) {
      setErrors(errList(e));
      const isStale = e.response?.status === 409;
      setStale(isStale);
      if (isStale) { setMode(null); onDone(null); }
    } finally {
      setBusy(false);
    }
  };

  const choices = [
    ["confirm", "Confirm"],
    ["request_change", "Request a change"],
    ["decline", "Decline"],
  ];
  return (
    <div data-testid="review-respond-box" className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
      <p className="eyebrow">Your answer to v{data.version.number}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {choices.map(([k, label]) => (
          <Button key={k} variant={mode === k ? "default" : "outline"} className="h-auto whitespace-normal py-3" onClick={() => setMode(k)} data-testid={`partner-review-${k.replace("_", "-")}-button`}>{label}</Button>
        ))}
      </div>
      {mode === "confirm" && (
        <div className="space-y-2">
          <p className="text-xs text-slate-600">This confirms proposal-stage terms only. It does not hold crews, award the job, form a contract, resolve job-wide conditions, pay an advance or start mobilization.</p>
          <label htmlFor="rv-cond" className="block text-xs font-semibold text-slate-700">Your conditions (optional)</label>
          <Textarea id="rv-cond" rows={2} placeholder="Your answer stays conditional until these are resolved" value={conditions} onChange={(e) => setConditions(e.target.value)} data-testid="partner-review-conditions-input" />
        </div>
      )}
      {mode === "request_change" && (
        <div className="space-y-2">
          <label htmlFor="rv-note" className="block text-xs font-semibold text-slate-700">What needs to change?</label>
          <Textarea id="rv-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} data-testid="partner-review-note-input" />
          <label htmlFor="rv-total" className="block text-xs font-semibold text-slate-700">Your proposed total in USD (optional)</label>
          <Input id="rv-total" inputMode="decimal" value={proposed} onChange={(e) => setProposed(e.target.value)} data-testid="partner-review-proposed-input" />
        </div>
      )}
      {mode === "decline" && (
        <div className="space-y-2">
          <label htmlFor="rv-reason" className="block text-xs font-semibold text-slate-700">Reason (optional)</label>
          <Textarea id="rv-reason" rows={2} value={note} onChange={(e) => setNote(e.target.value)} data-testid="partner-review-decline-note-input" />
        </div>
      )}
      <ErrorList errors={errors} testId="partner-review-errors"
        title={stale ? "Your answer was not saved. The terms below are the current ones; review them and answer again." : undefined} />
      {mode && <Button onClick={submit} disabled={busy} data-testid="partner-review-submit-button">{busy ? "Saving…" : { confirm: "Send confirmation", request_change: "Send change request", decline: "Send decline" }[mode]}</Button>}
    </div>
  );
}

function VerifyEmail({ onDone }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); setMsg(""); try { await fn(); } catch (e) { setMsg(errList(e).join(" ")); } setBusy(false); };
  return (
    <div data-testid="review-verify-email" className="space-y-3 rounded-md border border-slate-200 bg-white p-5 text-sm">
      <p className="font-semibold text-slate-900">Verify your email to open this review</p>
      <p className="text-slate-600">The link only opens for the invited address, once you prove you can read its inbox.</p>
      {!sent ? (
        <Button disabled={busy} onClick={() => run(async () => { await api.post("/auth/verify-email/send"); setSent(true); })} data-testid="review-verify-send">Email me a code</Button>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="rv-code" className="block text-xs font-semibold text-slate-700">6-digit code</label>
            <Input id="rv-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} className="w-36" data-testid="review-verify-code" />
          </div>
          <Button disabled={busy || code.length !== 6} onClick={() => run(async () => { await api.post("/auth/verify-email/confirm", { code }); await onDone(); })} data-testid="review-verify-confirm">Verify</Button>
        </div>
      )}
      {msg && <p role="alert" className="text-red-700">{msg}</p>}
    </div>
  );
}

export default function Review() {
  const { token } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const { data: d } = await api.get(`/review/${token}`); setData(d); setError(""); }
    catch (e) { setError(errList(e).join(" ")); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const s = data && STATUS[data.status];
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {error.startsWith("VERIFY_EMAIL") && <VerifyEmail onDone={load} />}
        {error && !error.startsWith("VERIFY_EMAIL") && (
          <div data-testid="review-error" className="rounded-md border border-red-200 bg-red-50 p-5 text-sm text-red-800">
            {error}
            {user && <div className="mt-3"><Button size="sm" variant="outline" className="bg-white" onClick={async () => { await logout(); navigate(`/login?next=${encodeURIComponent(`/review/${token}`)}`); }} data-testid="review-switch-account">Sign in as the invited firm</Button></div>}
          </div>
        )}
        <BackToOrganizer />
        {!data && !error && <Loading label="Loading your review" />}
        {data && (
          <>
            <div className="rise">
              <p className="eyebrow flex items-center gap-2">From {data.job.organizer_firm}</p>
              <h1 data-testid="review-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{data.partner.name}: your part of {data.job.job_name}{data.job.synthetic && <SynthBadge />}</h1>
              <p className="mt-1 text-sm text-slate-600">Customer: {data.job.customer_name || "Unknown"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!["link_not_shared", "no_link"].includes(data.status) && <StatusPill testId="review-status" tone={s.tone} label={s.label} />}
                {data.version && <span className="font-mono text-xs text-slate-500">Terms v{data.version.number} · {fmtTime(data.version.created_at)}</span>}
              </div>
            </div>
            {data.terms ? (
              <>
                <Terms t={data.terms} shared={data.shared_conditions} />
                {data.expired ? (
                  <p data-testid="review-expired" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">These terms passed their validity date. Ask the organizer to recheck before answering.</p>
                ) : (
                  <RespondBox data={data} token={token} onDone={(r) => (r ? setData(r) : load())} />
                )}
              </>
            ) : (
              <p data-testid="review-removed" className="rounded-md border border-slate-200 bg-white p-5 text-sm text-slate-600">You have no sites in the organizer's current plan. Nothing needs your answer.</p>
            )}
            <details className="rounded-md border border-slate-200 bg-white p-4" data-testid="review-history">
              <summary className="cursor-pointer text-sm font-semibold">Your answers ({data.responses.length})</summary>
              <ul className="mt-3 space-y-2">
                {data.responses.map((r) => (
                  <li key={r.response_id} className="border-t border-slate-100 pt-2 text-xs">
                    <span className="font-semibold">{ACTION[r.action]}</span> on v{r.version_number} · {fmtTime(r.created_at)}{r.carried_from ? " · carried over unchanged" : ""}
                    {r.conditions && <p className="text-amber-800">Conditions: {r.conditions}</p>}
                    {r.note && <p className="text-slate-600">{r.note}</p>}
                    {r.proposed_total_cents != null && <p className="font-mono">Proposed total {money(r.proposed_total_cents)}</p>}
                  </li>
                ))}
                {data.responses.length === 0 && <li className="text-xs text-slate-500">No answers yet.</li>}
              </ul>
            </details>
          </>
        )}
      </main>
    </div>
  );
}
