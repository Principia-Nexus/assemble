import { useState } from "react";
import { FileDown, Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/StatusPill";
import { api, errText } from "@/lib/api";
import { fmtDate, fmtTime } from "@/lib/format";
import { toast } from "sonner";

const ST = {
  pending: { label: "Waiting", tone: "unknown" }, reading: { label: "Reading", tone: "pending" },
  read: { label: "Read", tone: "confirmed" }, failed: { label: "Failed: not read", tone: "declined" },
};

function SourceItem({ s, onRead }) {
  const [busy, setBusy] = useState(false);
  const retry = async () => {
    setBusy(true);
    try { const { data } = await api.post(`/project/sources/${s.source_id}/retry`); onRead(data); }
    catch (e) { toast.error(errText(e)); }
    finally { setBusy(false); }
  };
  const openPdf = async () => {
    try {
      const { data } = await api.get(`/project/sources/${s.source_id}/file`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = s.filename || "document.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast.error("Could not get the original PDF. Try again."); }
  };
  return (
    <li data-testid={`source-${s.source_id}`} className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{s.label}</p>
          <p className="font-mono text-[11px] text-slate-500">{s.kind}{s.page_count ? ` · PDF, ${s.page_count} page(s)` : ""} · dated {fmtDate(s.source_date)} · added {fmtTime(s.created_at)}{s.status === "read" ? ` · ${s.fact_count} fact(s)` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {s.file_id && (
            <Button size="sm" variant="ghost" onClick={openPdf} data-testid={`source-download-${s.source_id}`}><FileDown className="h-4 w-4" /> Download original PDF</Button>
          )}
          <StatusPill testId={`source-status-${s.source_id}`} tone={ST[s.status].tone} label={ST[s.status].label} />
          {s.status !== "reading" && (
            <Button size="sm" variant="ghost" onClick={retry} disabled={busy} data-testid={`source-retry-${s.source_id}`}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />} {s.status === "failed" ? "Retry" : "Read again"}
            </Button>
          )}
        </div>
      </div>
      {s.error && <p data-testid={`source-error-${s.source_id}`} className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">{s.error}</p>}
      {s.ignored_instructions?.length > 0 && (
        <p className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900" data-testid={`source-ignored-${s.source_id}`}>
          Instructions inside this document were ignored: {s.ignored_instructions.join(" · ")}
        </p>
      )}
      {(s.unknowns?.length > 0 || s.conflicts?.length > 0) && (
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold">Unknowns and conflicts noted ({(s.unknowns?.length || 0) + (s.conflicts?.length || 0)})</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {s.unknowns?.map((u) => <li key={u}>Unknown: {u}</li>)}
            {s.conflicts?.map((u) => <li key={u}>Conflict: {u}</li>)}
          </ul>
        </details>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-slate-500">Show original text</summary>
        <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-700">{s.text}</pre>
      </details>
    </li>
  );
}

export default function SourcesList({ sources, onRead }) {
  if (!sources.length) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white">
      <p className="eyebrow border-b border-slate-200 p-4">Documents ({sources.length})</p>
      <ul className="divide-y divide-slate-100">{sources.map((s) => <SourceItem key={s.source_id} s={s} onRead={onRead} />)}</ul>
    </div>
  );
}
