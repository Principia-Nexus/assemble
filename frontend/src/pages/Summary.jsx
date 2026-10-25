import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Printer, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, errText } from "@/lib/api";
import { STATUS, money, fmtDate, fmtTime } from "@/lib/format";
import { Loading } from "@/App";
import { RouteDenied } from "@/components/RouteDenied";
import { ruleView } from "@/components/sheet/CheckerPanel";
import { answered, nextStep, openConditions, scopedResult } from "@/lib/planState";

const ACTION = { confirm: "Confirmed proposed terms", request_change: "Requested a change", decline: "Declined" };

function Section({ title, children, testId }) {
  return (
    <section data-testid={testId} className="break-inside-avoid border-t border-slate-300 pt-5">
      <h2 className="mb-3 font-mono text-xs font-semibold text-slate-600">{title}</h2>
      {children}
    </section>
  );
}

function Contributions({ cur }) {
  return (
    <>
    <ul className="space-y-2 text-sm sm:hidden print:hidden">
      {cur.partners.map((p) => (
        <li key={p.partner_id} className="border-t border-slate-200 pt-2">
          <p className="font-semibold">{p.name} · <span className="font-mono">{money(p.terms.price_total_cents)}</span></p>
          <p className="font-mono text-xs">{p.terms.sites.map((s) => `${s.site_id} (${s.week})`).join(", ")}</p>
          <p className="text-xs text-slate-600">Advance {money(p.terms.advance_cents)} / balance {money(p.terms.balance_cents)} · {STATUS[p.status].label}</p>
        </li>
      ))}
    </ul>
    <table className="hidden w-full text-sm sm:table print:table">
      <thead><tr className="text-left font-mono text-[11px] text-slate-500"><th className="py-1">Crew</th><th>Sites (week)</th><th>Total</th><th>Advance / balance</th><th>Status</th></tr></thead>
      <tbody>
        {cur.partners.map((p) => (
          <tr key={p.partner_id} className="border-t border-slate-200 align-top">
            <td className="py-1.5 pr-2 font-semibold">{p.name}</td>
            <td className="pr-2 font-mono text-xs">{p.terms.sites.map((s) => `${s.site_id} (${s.week})`).join(", ")}</td>
            <td className="pr-2 font-mono">{money(p.terms.price_total_cents)}</td>
            <td className="pr-2 font-mono text-xs">{money(p.terms.advance_cents)} / {money(p.terms.balance_cents)}</td>
            <td className="text-xs">{STATUS[p.status].label}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}

function Responses({ cur }) {
  return (
    <ul className="space-y-2 text-sm">
      {cur.partners.map((p) => (
        <li key={p.partner_id} className="border-l-2 border-slate-300 pl-3">
          <p className="font-semibold">{p.name}</p>
          {p.response ? (
            <p className="text-xs text-slate-700">
              {ACTION[p.response.action]} on v{p.response.version_number} by {p.response.user_name} ({p.response.user_email}), {fmtTime(p.response.created_at)}
              {p.response.carried_from ? ", carried over unchanged from an earlier version" : ""}. Terms fingerprint <span className="font-mono">{p.response.terms_hash}</span>.
              {p.response.conditions && <><br />Conditions: {p.response.conditions}</>}
              {p.response.note && <><br />Note: {p.response.note}</>}
            </p>
          ) : <p className="text-xs text-slate-500">No response to these terms. No response is not agreement.</p>}
        </li>
      ))}
    </ul>
  );
}

export default function Summary() {
  const [sheet, setSheet] = useState(null);
  const [error, setError] = useState("");
  const [printedAt] = useState(() => new Date().toISOString());
  useEffect(() => {
    api.get("/project").then((r) => (r.data.sheet ? setSheet(r.data.sheet) : setError("No job yet."))).catch((e) => setError(errText(e)));
  }, []);
  if (error) return <RouteDenied message={error} />;
  if (!sheet) return <Loading label="Preparing summary" />;
  const cur = sheet.current;
  const it = sheet.intake;
  const open = [
    ...(cur?.checker.open_conditions || sheet.gap.open_conditions || []).map((c) => `${c.scope}: ${c.text}${c.source ? ` (${c.source})` : ""}`),
    ...(cur?.partners || []).filter((p) => p.response?.conditions).map((p) => `${p.name} (their response): ${p.response.conditions}`),
    ...sheet.change_requests.filter((c) => ["open", "in_preview"].includes(c.status)).map((c) => `Change request (${c.source === "partner" ? c.partner_name : "customer"}): ${c.note}`),
  ];
  return (
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="no-print mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Button variant="ghost" size="sm" asChild data-testid="summary-back-link"><Link to=".." relative="path"><ArrowLeft className="h-4 w-4" /> Back to sheet</Link></Button>
        <Button size="sm" onClick={() => window.print()} data-testid="summary-print-button"><Printer className="h-4 w-4" /> Print</Button>
      </div>
      <article data-testid="summary-document" className="mx-auto max-w-4xl space-y-6 bg-white p-8 shadow-sm print:max-w-none print:p-0 print:shadow-none sm:p-12">
        <header className="space-y-1">
          <p className="flex items-center gap-2 font-mono text-[10px] text-slate-500">Assemble · organizer summary · not for partners</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{it.job_name || sheet.project.name}</h1>
          <p className="text-sm text-slate-600">Customer: {it.customer_name || "Unknown"} · Starts {fmtDate(it.start_date)} · {it.weeks ?? "?"} weeks · Ceiling {money(it.budget_ceiling_cents)}</p>
          <p data-testid="summary-date" className="text-xs text-slate-500">Prepared {fmtTime(printedAt, true)}{cur ? ` · current plan v${cur.version.number}` : ""}{sheet.preview ? ` · amendment preview v${sheet.preview.version.number} open (not included)` : ""}</p>
        </header>
        {cur && (
          <Section title="Decision" testId="summary-decision">
            <p className="text-sm font-semibold">{scopedResult(cur.checker).label} · {money(cur.checker.total_cents)} of {money(cur.checker.ceiling_cents)}</p>
            <p className="mt-1 text-sm text-slate-700">{cur.partners.filter(answered).length} of {cur.partners.length} partners answered these terms · {open.length ? `${open.length} item${open.length > 1 ? "s" : ""} outstanding` : "nothing outstanding recorded"}</p>
            <p className="mt-1 text-sm text-slate-700">Next: {nextStep(sheet).text}</p>
          </Section>
        )}
        <Section title="Outstanding work" testId="summary-conditions">
          {open.length ? <ul className="list-disc space-y-1 pl-5 text-sm">{open.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="text-sm text-slate-500">None recorded.</p>}
        </Section>
        {!cur ? <p className="text-sm text-slate-500">No candidate plan yet.</p> : (
          <>
            <Section title="Contributions" testId="summary-contributions"><Contributions cur={cur} /></Section>
            <Section title="Exact responses" testId="summary-responses"><Responses cur={cur} /></Section>
            <Section title="Supporting checks" testId="summary-checks">
              <ul className="space-y-1 text-xs">
                {cur.checker.rules.map((r) => <li key={r.key}><span className="font-semibold">{ruleView(r, cur.checker, openConditions(cur).length).label}: {r.label}.</span> {r.details.join(" ")}</li>)}
              </ul>
              {cur.checker.note && <p className="mt-2 text-[11px] text-slate-500">{cur.checker.note}</p>}
            </Section>
          </>
        )}
        <footer className="border-t border-slate-300 pt-4 text-[11px] leading-relaxed text-slate-500">
          Confirmations cover proposal-stage terms only. They do not hold crews, award the job, form a contract or start mobilization. Full history is kept in Assemble.
        </footer>
      </article>
    </div>
  );
}
