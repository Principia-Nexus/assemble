import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { api, errText } from "@/lib/api";
import { fmtTime } from "@/lib/format";

export default function HistoryDrawer({ open, onOpenChange, rev }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    api.get("/project/history").then((r) => { setData(r.data); setError(""); }).catch((e) => setError(errText(e)));
  }, [open, rev]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="history-drawer">
        <SheetHeader>
          <SheetTitle>History</SheetTitle>
        </SheetHeader>
        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
        {!data && !error && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
        {data && (
          <>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {data.versions.map((v) => (
                <span key={v.version_id} className="rounded-sm border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">v{v.number} · {v.state}</span>
              ))}
            </div>
            <ol className="relative mt-5 space-y-4 border-l border-slate-200 pl-5">
              {data.events.map((e) => (
                <li key={e.event_id} data-testid="history-event" className="relative">
                  <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-slate-400" />
                  <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    {fmtTime(e.at)} · <span className={e.actor_kind === "partner" ? "text-amber-700" : "text-slate-700"}>{e.actor_kind}</span> · {e.actor_name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-800">{e.summary}</p>
                  {e.details?.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-500">{e.details.map((d) => <li key={d}>· {d}</li>)}</ul>
                  )}
                </li>
              ))}
            </ol>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
