import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/AppHeader";
import { api, errText } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const BULLETS = ["Add job details and partner quotes", "Build and edit a plan", "Check dates, capacity and costs", "Ask partners to review their terms", "Save responses and plan changes"];

function Shell({ children, testId }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5 py-10">
      <section data-testid={testId} className="stagger w-full max-w-md space-y-6">
        <div className="flex justify-center"><Brand large /></div>
        {children}
      </section>
    </div>
  );
}


export function PilotOffer({ notice }) {
  const { user, logout } = useAuth();
  const [access, setAccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { api.get("/billing/access").then((r) => setAccess(r.data)).catch((e) => setError(errText(e))); }, []);
  if (access && (access.active || !access.required)) return <Navigate to={user?.firm_id ? "/projects" : "/reviews"} replace />;
  const start = async () => {
    setBusy(true); setError("");
    try { const { data } = await api.post("/billing/checkout", { origin_url: window.location.origin }); window.location.href = data.checkout_url; }
    catch (e) { setError(errText(e)); setBusy(false); }
  };
  const tryDemo = async () => { await logout(); window.location.href = "/login"; };
  return (
    <Shell testId="pilot-offer">
      {notice && <p data-testid="pilot-notice" role="status" className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center text-sm text-slate-700">{notice}</p>}
      <div className="rounded-md border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold text-slate-900">Assemble pilot</h1>
        <p data-testid="pilot-price" className="mt-2 text-3xl font-bold tabular-nums text-slate-900">$99 <span className="text-base font-medium text-slate-600">one-time</span></p>
        <p className="mt-1 text-sm text-slate-600">Full access for your business.</p>
        <ul className="mt-5 space-y-2 text-sm text-slate-800">
          {BULLETS.map((b) => <li key={b} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />{b}</li>)}
        </ul>
        <p className="mt-5 text-xs text-slate-500">Partners join free. No subscription. No automatic renewal.</p>
        <Button className="mt-5 h-11 w-full" disabled={busy || !access} onClick={start} data-testid="pilot-checkout-button">{busy ? "Opening checkout…" : "Continue to test checkout"}</Button>
        <p className="mt-2 text-center text-xs text-slate-500">Test mode. No real charge. Use a test card.</p>
        {error && <p data-testid="pilot-error" className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
      <button type="button" onClick={tryDemo} className="mx-auto block text-sm font-medium text-slate-700 underline-offset-4 hover:underline" data-testid="pilot-try-demo">Try the demo</button>
    </Shell>
  );
}

export function PaymentSuccess() {
  const [params] = useSearchParams();
  const sid = params.get("session_id");
  const [state, setState] = useState({ phase: "checking" });
  const tries = useRef(0);
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/billing/status/${sid}`);
        if (stop) return;
        if (data.payment_status === "paid" && data.access.active) return setState({ phase: "paid" });
        if (["expired", "failed"].includes(data.payment_status)) return setState({ phase: "failed" });
        if (++tries.current >= 10) return setState({ phase: "pending" });
        setTimeout(poll, 2000);
      } catch (e) { if (!stop) setState({ phase: "error", msg: errText(e) }); }
    };
    if (sid) poll(); else setState({ phase: "error", msg: "Missing payment reference." });
    return () => { stop = true; };
  }, [sid, state.retry]);
  return (
    <Shell testId="payment-success">
      <div data-testid={`payment-phase-${state.phase}`} role="status" className="space-y-4 rounded-md border border-slate-200 bg-white p-6 text-center">
        {state.phase === "checking" && <p className="text-sm text-slate-700">Confirming your payment…</p>}
        {state.phase === "paid" && (
          <>
            <p className="text-xl font-semibold text-slate-900">Pilot access active</p>
            <p className="text-sm text-slate-600">Test payment complete. No money was charged.</p>
            <Button asChild className="h-11 w-full" data-testid="payment-open-workspace"><Link to="/projects">Open workspace</Link></Button>
          </>
        )}
        {state.phase === "pending" && (
          <>
            <p className="text-sm text-slate-700">Your payment is still being confirmed. Please don't pay again.</p>
            <Button variant="outline" onClick={() => { tries.current = 0; setState({ phase: "checking", retry: Date.now() }); }} data-testid="payment-refresh-status">Refresh status</Button>
          </>
        )}
        {state.phase === "failed" && (
          <>
            <p className="text-sm text-slate-700">That checkout didn't complete. Your account is unchanged.</p>
            <Button asChild data-testid="payment-try-again"><Link to="/pilot">Try again</Link></Button>
          </>
        )}
        {state.phase === "error" && (
          <>
            <p className="text-sm text-red-700">{state.msg}</p>
            <div className="flex justify-center gap-2">
              <Button asChild variant="outline" data-testid="payment-back-to-pilot"><Link to="/pilot">Back to pilot</Link></Button>
              <Button asChild data-testid="payment-error-open-workspace"><Link to="/projects">Open workspace</Link></Button>
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

export function PaymentCancel() {
  return <PilotOffer notice="Checkout canceled. Your account is ready when you are." />;
}
