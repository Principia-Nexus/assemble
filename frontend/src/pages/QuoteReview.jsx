import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SynthBadge } from "@/components/StatusPill";
import { api, errList, newKey } from "@/lib/api";

const usd = (c) => (c == null ? "unknown" : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
const STATE = { issued: "Awaiting your decision", changes_requested: "You requested changes", declined: "Declined", withdrawn: "Withdrawn by the seller",
  expired: "Expired", accepted: "Accepted", superseded: "Replaced by a newer quote" };

function List({ title, items, testId }) {
  if (!items?.length) return null;
  return <div data-testid={testId}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><ul className="mt-1 list-disc pl-5 text-sm">{items.map((x) => <li key={x}>{x}</li>)}</ul></div>;
}

function Verify({ token, intro, onSession }) {
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const send = async () => { try { setSent((await api.post(`/quote/${token}/code`)).data); setErr(""); } catch (e) { setErr(errList(e).join(" ")); } };
  const verify = async (e) => {
    e.preventDefault();
    try { const { data } = await api.post(`/quote/${token}/verify`, { code }); sessionStorage.setItem(`qs_${token}`, data.session); onSession(data.session); }
    catch (er) { setErr(errList(er).join(" ")); }
  };
  return (
    <div className="space-y-4" data-testid="quote-verify">
      <p className="text-sm text-slate-700">{intro.seller} sent quote {intro.number} to {intro.recipient_masked}. Confirm a code sent to that address to open it.</p>
      {!sent ? <Button onClick={send} data-testid="quote-send-code">Email me a code</Button> : (
        <form onSubmit={verify} className="space-y-3">
          {sent.synthetic_code && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900" data-testid="quote-synthetic-code">{sent.note} Code: <b className="font-mono">{sent.synthetic_code}</b></p>}
          <Input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" aria-label="Code" className="h-11 text-center font-mono text-lg tracking-[0.4em]" data-testid="quote-code-input" />
          <Button type="submit" className="w-full" disabled={code.length !== 6} data-testid="quote-verify-button">Open quote</Button>
          <button type="button" className="text-xs text-slate-500 underline" onClick={send}>Send a new code</button>
        </form>
      )}
      {err && <p role="alert" className="text-sm text-red-700" data-testid="quote-verify-error">{err}</p>}
    </div>
  );
}

function Respond({ token, q, session, onDone }) {
  const [action, setAction] = useState(null);
  const [f, setF] = useState({ signer_name: "", authority: "", note: "", intent: false });
  const [err, setErr] = useState("");
  const key = useRef(newKey());
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/quote/${token}/respond`, { action, digest: q.digest, ...f, key: key.current }, { headers: { "X-Quote-Session": session } });
      onDone();
    } catch (er) { setErr(errList(er).join(" ")); }
  };
  if (!action) return (
    <div className="flex flex-wrap gap-2 no-print" data-testid="quote-actions">
      {q.state === "issued" && <Button onClick={() => setAction("accept")} data-testid="quote-accept">Accept {q.number}</Button>}
      {q.state === "issued" && <Button variant="outline" onClick={() => setAction("request_changes")} data-testid="quote-request-changes">Request changes</Button>}
      <Button variant="outline" onClick={() => setAction("decline")} data-testid="quote-decline">Decline</Button>
    </div>
  );
  return (
    <form onSubmit={submit} className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 no-print" data-testid="quote-respond-form">
      <Input placeholder="Your full name" value={f.signer_name} onChange={(e) => setF({ ...f, signer_name: e.target.value })} aria-label="Full name" data-testid="quote-signer-name" />
      <Input placeholder="Role / authority to decide for the customer (optional)" value={f.authority} onChange={(e) => setF({ ...f, authority: e.target.value })} aria-label="Authority" data-testid="quote-authority" />
      {action !== "accept" && <Textarea rows={3} placeholder={action === "decline" ? "Reason (optional)" : "What should change?"} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} data-testid="quote-note" />}
      {action === "accept" && (
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.intent} onChange={(e) => setF({ ...f, intent: e.target.checked })} data-testid="quote-intent" />
          I accept quote {q.number} exactly as shown, for {usd(q.snapshot.price_cents)}.</label>
      )}
      {err && <p role="alert" className="text-sm text-red-700" data-testid="quote-respond-error">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" data-testid="quote-respond-submit">{{ accept: "Accept", decline: "Decline", request_changes: "Send change request" }[action]}</Button>
        <Button type="button" variant="ghost" onClick={() => { setAction(null); setErr(""); }}>Cancel</Button>
      </div>
    </form>
  );
}

export default function QuoteReview() {
  const { token } = useParams();
  const [intro, setIntro] = useState(null);
  const [error, setError] = useState("");
  const [session, setSession] = useState(() => sessionStorage.getItem(`qs_${token}`));
  const [q, setQ] = useState(null);
  useEffect(() => { api.get(`/quote/${token}`).then((r) => setIntro(r.data)).catch((e) => setError(errList(e).join(" "))); }, [token]);
  const load = useCallback(() => {
    if (!session) return;
    api.get(`/quote/${token}/view`, { headers: { "X-Quote-Session": session } }).then((r) => setQ(r.data))
      .catch(() => { sessionStorage.removeItem(`qs_${token}`); setSession(null); });
  }, [token, session]);
  useEffect(() => { load(); }, [load]);
  const s = q?.snapshot;
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <main className="mx-auto max-w-2xl rounded-lg border border-slate-200 bg-white p-5 sm:p-8" data-testid="quote-page">
        <p className="text-2xl font-semibold tracking-tight text-[#1A2838]">Assemble</p>
        {error && <p className="mt-4 text-sm text-red-700" data-testid="quote-error">{error}</p>}
        {intro && !q && <div className="mt-6"><Verify token={token} intro={intro} onSession={setSession} /></div>}
        {s && (
          <article className="mt-6 space-y-4" data-testid="quote-document">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold">Quote {s.number}{s.kind === "amendment" ? ` · amendment to ${s.baseline_number}` : ""}{s.synthetic && <SynthBadge />}</h1>
                <p className="text-sm text-slate-600">{s.seller} → {s.customer_name} · {s.project}</p>
              </div>
              <Button size="sm" variant="outline" className="no-print" onClick={() => window.print()} data-testid="quote-print"><Printer className="h-4 w-4" /> Print / PDF</Button>
            </div>
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold" data-testid="quote-state">{STATE[q.state] || q.state}</p>
            {q.baseline && <p className="text-xs text-slate-600">Your accepted {q.baseline.number} ({usd(q.baseline.price_cents)}) stays in force unless you accept this amendment.</p>}
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-slate-500">Price</dt><dd className="text-lg font-semibold" data-testid="quote-price-view">{usd(s.price_cents)} {s.currency}</dd></div>
              <div><dt className="text-xs text-slate-500">Tax</dt><dd>{s.tax_basis}</dd></div>
              <div><dt className="text-xs text-slate-500">Site</dt><dd>{s.site}</dd></div>
              <div><dt className="text-xs text-slate-500">Timing</dt><dd>{s.timing}</dd></div>
              <div><dt className="text-xs text-slate-500">Payment</dt><dd>{s.payment_terms}</dd></div>
              <div><dt className="text-xs text-slate-500">Valid until</dt><dd>{s.valid_until ? new Date(s.valid_until).toLocaleString() : ""}</dd></div>
            </dl>
            <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scope</p><p className="mt-1 whitespace-pre-wrap text-sm">{s.scope}</p></div>
            <List title="Included" items={s.inclusions} testId="quote-inclusions-view" />
            <List title="Excluded" items={s.exclusions} testId="quote-exclusions-view" />
            <List title="Conditions" items={s.conditions} testId="quote-conditions-view" />
            {s.terms && <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Terms</p><p className="mt-1 whitespace-pre-wrap text-sm">{s.terms}</p></div>}
            <p className="font-mono text-[11px] text-slate-400">Version {s.number} · {q.digest}</p>
            {(q.responses || []).map((r) => <p key={r.receipt_id} className="rounded bg-slate-50 px-3 py-2 text-xs" data-testid="quote-receipt">{r.signer_name} ({r.email}) {r.action.replace("_", " ")} {r.version} at {new Date(r.at).toLocaleString()}. Receipt {r.receipt_id}.</p>)}
            {["issued", "changes_requested"].includes(q.state) && <Respond token={token} q={q} session={session} onDone={load} />}
          </article>
        )}
      </main>
    </div>
  );
}
