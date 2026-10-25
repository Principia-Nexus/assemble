import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errList } from "@/lib/api";

const STATE = { draft: "Private draft", issued: "Issued · awaiting customer", changes_requested: "Customer requested changes", declined: "Declined",
  withdrawn: "Withdrawn", expired: "Expired", accepted: "Accepted", superseded: "Replaced by a newer quote" };
const usd = (c) => (c == null ? "unknown" : `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
const F = [["customer_name", "Customer"], ["customer_email", "Customer email"], ["site", "Site / address"], ["timing", "Timing"],
  ["tax_basis", "Tax treatment"], ["payment_terms", "Payment terms"]];
const lines = (v) => (v || []).join("\n");

function Draft({ q, onSaved }) {
  const local = (v) => { if (!v) return ""; const d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
  const [f, setF] = useState({ ...q, valid_until: local(q.valid_until), price: q.price_cents != null ? q.price_cents / 100 : "", inc: lines(q.inclusions), exc: lines(q.exclusions), cond: lines(q.conditions) });
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState([]);
  const save = async () => {
    const fields = { ...Object.fromEntries(F.map(([k]) => [k, f[k] || null])), scope: f.scope || null, terms: f.terms || null, valid_until: f.valid_until ? new Date(f.valid_until).toISOString() : null,
      price_cents: f.price === "" ? null : Math.round(Number(f.price) * 100), inclusions: f.inc.split("\n"), exclusions: f.exc.split("\n"), conditions: f.cond.split("\n") };
    try {
      const { data } = await api.put(`/project/quotes/${q.quote_id}`, { fields });
      setErrors([]);
      const pv = (await api.get(`/project/quotes/${q.quote_id}/preview`)).data;
      setPreview(pv);
      onSaved(data.quote, false);
    } catch (e) { setErrors(errList(e)); }
  };
  const [ack, setAck] = useState(!!q.partial_ack);
  const decisions = () => Object.fromEntries((preview?.readiness?.conditions || []).filter((c) => c.decision).map((c) => [c.text, c.decision]));
  const decide = async (patch) => {
    try {
      const { data } = await api.put(`/project/quotes/${q.quote_id}`, { fields: patch });
      setPreview((await api.get(`/project/quotes/${q.quote_id}/preview`)).data);
      onSaved(data.quote, false);
    } catch (e) { setErrors(errList(e)); }
  };
  const issue = async () => {
    try {
      await api.post(`/project/quotes/${q.quote_id}/issue`, { digest: preview.digest });
      toast.success(`Quote ${q.number} issued. It is not sent until you send or copy the link.`);
      onSaved(null, true);
    } catch (e) { setErrors(errList(e)); }
  };
  const inp = (k) => ({ value: f[k] ?? "", onChange: (e) => { setF({ ...f, [k]: e.target.value }); setPreview(null); } });
  return (
    <div className="space-y-3" data-testid="quote-draft">
      {q.kind === "amendment" && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Amendment to accepted {q.baseline_number}. {q.baseline_number} stays in force unless the customer accepts this amendment.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {F.map(([k, l]) => <label key={k} className="text-xs font-semibold text-slate-700">{l}<Input className="mt-1" {...inp(k)} data-testid={`quote-${k}`} /></label>)}
        <label className="text-xs font-semibold text-slate-700">Customer price (USD, you authorize this)<Input className="mt-1" inputMode="decimal" placeholder="unknown" {...inp("price")} data-testid="quote-price" /></label>
        <label className="text-xs font-semibold text-slate-700">Valid until<Input type="datetime-local" className="mt-1" {...inp("valid_until")} data-testid="quote-valid-until" /></label>
      </div>
      <label className="block text-xs font-semibold text-slate-700">Scope<Textarea rows={2} className="mt-1" {...inp("scope")} data-testid="quote-scope" /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-semibold text-slate-700">Included (one per line)<Textarea rows={3} className="mt-1" {...inp("inc")} data-testid="quote-inclusions" /></label>
        <label className="text-xs font-semibold text-slate-700">Excluded (one per line)<Textarea rows={3} className="mt-1" {...inp("exc")} data-testid="quote-exclusions" /></label>
        <label className="text-xs font-semibold text-slate-700">Conditions (one per line)<Textarea rows={3} className="mt-1" {...inp("cond")} data-testid="quote-conditions" /></label>
      </div>
      <label className="block text-xs font-semibold text-slate-700">Other terms<Textarea rows={2} className="mt-1" {...inp("terms")} data-testid="quote-terms" /></label>
      {errors.length > 0 && <ul role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800" data-testid="quote-errors">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} data-testid="quote-save-preview">Save and preview</Button>
        <Button variant="outline" onClick={async () => { try { await api.delete(`/project/quotes/${q.quote_id}`); onSaved(null, true); } catch (e) { setErrors(errList(e)); onSaved(null, true); } }} data-testid="quote-discard">Discard draft</Button>
      </div>
      {preview && (
        <div className="rounded-md border border-slate-200 bg-white p-4" data-testid="quote-preview">
          <p className="text-sm font-semibold">Customer will see {preview.snapshot.number}: {usd(preview.snapshot.price_cents)}</p>
          {[["Excluded", preview.snapshot.exclusions, "quote-preview-exclusions"], ["Conditions", preview.snapshot.conditions, "quote-preview-conditions"], ["Not covered", preview.snapshot.not_covered, "quote-preview-not-covered"]]
            .filter(([, xs]) => xs?.length).map(([l, xs, id]) => <p key={id} className="mt-1 text-xs text-slate-700" data-testid={id}><b>{l}:</b> {xs.join("; ")}</p>)}
          {preview.support?.firms.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs" data-testid="quote-support">
              {preview.support.firms.map((x) => <li key={x.partner_id} className={["confirmed", "confirmed_conditional"].includes(x.status) ? "text-emerald-800" : "text-amber-800"} data-testid={`quote-support-${x.partner_id}`}>{x.name}: {x.text}</li>)}
            </ul>
          )}
          {preview.readiness?.not_covered.length > 0 && (
            <label className="mt-2 flex items-start gap-2 text-xs text-slate-700" data-testid="quote-partial">
              <input type="checkbox" className="mt-0.5" checked={ack} onChange={(e) => { setAck(e.target.checked); decide({ partial_ack: e.target.checked }); }} data-testid="quote-partial-ack" />
              <span>Partial quote. It states it does not cover: <b>{preview.readiness.not_covered.join(", ")}</b>. I reviewed the included work, exclusions and dependencies.</span>
            </label>
          )}
          {preview.readiness?.conditions.length > 0 && (
            <ul className="mt-2 space-y-1.5" data-testid="quote-condition-decisions">
              {preview.readiness.conditions.map((c, i) => (
                <li key={c.text} className="flex flex-wrap items-center gap-2 text-xs text-slate-700" data-testid={`quote-condition-${i}`}>
                  <span className="min-w-0 flex-1">{c.text}</span>
                  {[["in_offer", "Put in offer"], ["resolved", "Resolved"]].map(([k, l]) => (
                    <button key={k} type="button" onClick={() => decide({ condition_decisions: { ...decisions(), [c.text]: k } })} data-testid={`quote-condition-${i}-${k}`}
                      className={`rounded-full border px-2 py-0.5 transition-colors ${c.decision === k ? "border-[#1A2838] bg-[#1A2838] text-white" : "border-slate-200 hover:border-slate-400"}`}>{l}</button>
                  ))}
                </li>
              ))}
            </ul>
          )}
          {preview.readiness?.blockers.length > 0 && !preview.missing.length && (
            <ul className="mt-2 space-y-0.5 text-xs font-medium text-amber-800" data-testid="quote-blockers">{preview.readiness.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          )}
          {preview.missing.length ? <p className="mt-1 text-xs text-amber-800" data-testid="quote-missing">Before issuing, add {preview.missing.join(", ")}.</p> : (preview.readiness?.blockers.length > 0) ? null : (
            <>
              {preview.support && !preview.support.ok ? <p className="mt-2 text-xs font-medium text-amber-800" data-testid="quote-support-blocked">Every firm doing this work must confirm before you can issue.</p>
                : <Button className="mt-3" onClick={issue} data-testid="quote-issue">Issue {preview.snapshot.number} to {preview.snapshot.customer_email}</Button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Issued({ q, onChange }) {
  const [link, setLink] = useState(null);
  useEffect(() => { api.get(`/project/quotes/${q.quote_id}/link`).then((r) => setLink(r.data)).catch(() => {}); }, [q.quote_id]);
  const url = link && `${window.location.origin}${link.path}`;
  const s = q.snapshot;
  const open = ["issued", "changes_requested"].includes(q.state);
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4" data-testid={`quote-issued-${q.number}`}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{q.number}{q.kind === "amendment" ? ` · amends ${q.baseline_number}` : ""} · {usd(s.price_cents)}</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold" data-testid={`quote-state-${q.number}`}>{STATE[q.state]}</span>
      </div>
      <p className="mt-1 text-xs text-slate-500">To {q.recipient} · issued {new Date(q.issued_at).toLocaleString()} · valid until {s.valid_until ? new Date(s.valid_until).toLocaleString() : ""}{q.sends?.length ? ` · emailed ${q.sends.length}×` : " · not sent"}</p>
      {(q.responses || []).map((r) => (
        <p key={r.receipt_id} className="mt-2 rounded bg-slate-50 px-2 py-1 text-xs" data-testid={`quote-response-${r.receipt_id}`}>
          {r.signer_name}{r.authority ? ` (${r.authority})` : ""} · {r.email} · {{ accept: "accepted", decline: "declined", request_changes: "requested changes to" }[r.action] || r.action} {r.version} · {new Date(r.at).toLocaleString()}{r.note ? ` — “${r.note}”` : ""}
        </p>
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        {open && url && <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(url); toast.success("Link copied. Sharing it does not record a response."); }} data-testid={`quote-copy-${q.number}`}><Copy className="h-4 w-4" /> Copy link</Button>}
        {open && link?.sendable && <Button size="sm" variant="outline" onClick={async () => { try { await api.post(`/project/quotes/${q.quote_id}/send`); toast.success("Accepted for sending. Delivery is not confirmed."); onChange(); } catch (e) { toast.error(errList(e).join(" ")); } }} data-testid={`quote-send-${q.number}`}><Mail className="h-4 w-4" /> Email quote</Button>}
        {open && link && !link.sendable && <span className="self-center text-xs text-slate-500">Synthetic address: copy the link instead of emailing.</span>}
        {open && <Button size="sm" variant="outline" onClick={async () => { try { await api.post(`/project/quotes/${q.quote_id}/withdraw`); onChange(); } catch (e) { toast.error(errList(e).join(" ")); } }} data-testid={`quote-withdraw-${q.number}`}>Withdraw</Button>}
      </div>
    </div>
  );
}

export default function QuotePanel() {
  const [quotes, setQuotes] = useState(null);
  const load = useCallback(() => api.get("/project/quotes").then((r) => setQuotes(r.data.quotes)), []);
  useEffect(() => { load(); }, [load]);
  if (!quotes) return <p className="text-sm text-slate-500">Loading quotes…</p>;
  const draft = quotes.find((q) => q.state === "draft");
  const last = [...quotes].reverse().find((q) => q.state !== "draft");
  const start = async () => { try { await api.post("/project/quotes", { amend_of: last?.quote_id || null }); load(); } catch (e) { toast.error(errList(e).join(" ")); } };
  return (
    <div className="space-y-4" data-testid="quote-panel">
      <p className="text-xs text-slate-500">Internal planning totals and firm prices are not customer prices. You set and authorize the price the customer sees.</p>
      {draft ? <Draft key={draft.quote_id} q={draft} onSaved={(_, reload) => reload && load()} />
        : <Button onClick={start} data-testid="quote-new">{quotes.some((q) => q.state === "accepted") ? "Draft an amendment" : last ? "Draft a revised quote" : "Draft customer quote"}</Button>}
      {[...quotes].reverse().filter((q) => q.state !== "draft").map((q) => <Issued key={q.quote_id} q={q} onChange={load} />)}
    </div>
  );
}
