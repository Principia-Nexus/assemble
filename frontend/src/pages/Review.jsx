import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import AppHeader from "@/components/AppHeader";
import { StatusPill } from "@/components/StatusPill";
import { ErrorList } from "@/components/sheet/Stepper";
import { api, errList, newKey, visitorId } from "@/lib/api";
import { STATUS, money, fmtDate, fmtTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Loading } from "@/App";

const ACTION = { confirm: "Confirmed", request_change: "Requested a change", decline: "Declined" };

function Terms({ t }) {
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
    ["confirm", "Confirm these proposed terms"],
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
          <p className="text-xs text-slate-600">This confirms proposal-stage terms only. It does not hold crews, award the job, form a contract or start mobilization.</p>
          <Textarea rows={2} placeholder="Optional: any conditions (your answer stays conditional until resolved)" value={conditions} onChange={(e) => setConditions(e.target.value)} data-testid="partner-review-conditions-input" />
        </div>
      )}
      {mode === "request_change" && (
        <div className="space-y-2">
          <Textarea rows={3} placeholder="What needs to change?" value={note} onChange={(e) => setNote(e.target.value)} data-testid="partner-review-note-input" />
          <Input inputMode="decimal" placeholder="Optional: your proposed total in USD" value={proposed} onChange={(e) => setProposed(e.target.value)} data-testid="partner-review-proposed-input" />
        </div>
      )}
      {mode === "decline" && (
        <Textarea rows={2} placeholder="Optional: reason" value={note} onChange={(e) => setNote(e.target.value)} data-testid="partner-review-decline-note-input" />
      )}
      <ErrorList errors={errors} testId="partner-review-errors"
        title={stale ? "Your answer was not saved. The terms below are the current ones; review them and answer again." : undefined} />
      {mode && <Button onClick={submit} disabled={busy} data-testid="partner-review-submit-button">{busy ? "Saving…" : "Send answer to organizer"}</Button>}
    </div>
  );
}

export default function Review() {
  const { token } = useParams();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const { data: d } = await api.get(`/review/${token}`); setData(d); setError(""); }
    catch (e) { setError(errList(e).join(" ")); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const backToOrganizer = async () => {
    const { data: demo } = await api.get("/auth/demo-accounts");
    const org = demo.accounts.find((a) => a.role === "Organizer");
    const { data: u } = await api.post("/auth/login", { email: org.email, password: demo.password, visitor_id: visitorId() });
    setUser(u);
    navigate("/projects");
  };

  const s = data && STATUS[data.status];
  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />
      {user?.sandbox_id && (
        <div>
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs text-slate-600 sm:px-6">
            <span>Signed in as {user.email}</span>
            <Button size="sm" variant="ghost" className="h-7" onClick={backToOrganizer} data-testid="review-back-to-organizer-button">Sign in as organizer (demo)</Button>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {error && <div data-testid="review-error" className="rounded-md border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}</div>}
        {!data && !error && <Loading label="Loading your review" />}
        {data && (
          <>
            <div className="rise">
              <p className="eyebrow flex items-center gap-2">Private review · from {data.job.organizer_firm}</p>
              <h1 data-testid="review-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{data.partner.name}: your part of {data.job.job_name}</h1>
              <p className="mt-1 text-sm text-slate-600">Customer: {data.job.customer_name || "Unknown"}. You see only your own sites and terms.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusPill testId="review-status" tone={s.tone} label={s.label} />
                {data.version && <span className="font-mono text-xs text-slate-500">Terms v{data.version.number} · {fmtTime(data.version.created_at)}</span>}
              </div>
            </div>
            {data.terms ? (
              <>
                <Terms t={data.terms} />
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
