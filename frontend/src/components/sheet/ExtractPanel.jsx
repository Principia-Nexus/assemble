import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errText } from "@/lib/api";
import { ErrorList } from "./Stepper";
import ReadDocumentForm from "./ReadDocumentForm";
import SourcesList from "./SourcesList";
import ReadingsTable from "./ReadingsTable";

export default function ExtractPanel({ sheet, act, busy }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState([]);
  const [errors, setErrors] = useState([]);

  useEffect(() => {
    api.get("/project/readings").then((r) => setData(r.data)).catch((e) => setError(errText(e)));
  }, []);
  const reading = (data?.sources || []).some((s) => s.coverage?.queued > 0);
  useEffect(() => {
    if (!reading) return undefined;
    const t = setInterval(() => api.get("/project/readings").then((r) => setData(r.data)).catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [reading]);

  const onRead = (d) => {
    setData({ sources: d.sources, readings: d.readings });
    const ok = new Set(d.readings.filter((r) => r.reading && ["proposed", "corrected"].includes(r.reading.status)).map((r) => r.reading.fact_id));
    setSelected((s) => s.filter((id) => ok.has(id)));
  };

  const apply = async () => {
    const r = await act("post", "/project/readings/apply", { rev: sheet.project.rev, fact_ids: selected });
    if (r.ok) { toast.success(`Readings used. ${r.data.recalc}`); }
    else setErrors(r.errors);
  };

  const usable = (data?.readings || []).filter((r) => r.reading && ["proposed", "corrected"].includes(r.reading.status));
  if (error) return <p className="text-sm text-red-700" data-testid="extract-load-error">{error}</p>;
  if (!data) return <p className="text-sm text-slate-500">Loading documents…</p>;
  return (
    <div data-testid="extract-panel" className="space-y-4">
      <ReadDocumentForm intake={sheet.intake} synthetic={sheet.project.synthetic} onRead={onRead} />
      <SourcesList sources={data.sources} onRead={onRead} />
      {usable.length > 0 && (
        <div data-testid="readings-action-bar" className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-900 bg-slate-900 p-3 text-white shadow-lg">
          <p className="text-xs" data-testid="readings-selected-count">{selected.length} of {usable.length} reading(s) selected. Using them updates the job details and recalculates the candidate.</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelected(usable.map((r) => r.reading.fact_id))} data-testid="readings-select-all">Select all</Button>
            <Button size="sm" variant="secondary" disabled={busy || !selected.length} onClick={apply} data-testid="readings-apply-button">Use selected readings</Button>
          </div>
        </div>
      )}
      <ErrorList errors={errors} testId="readings-apply-errors" />
      <ReadingsTable readings={data.readings} selected={selected} setSelected={setSelected} onRead={onRead} />
    </div>
  );
}
