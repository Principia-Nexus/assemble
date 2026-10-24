import { useRef, useState } from "react";
import { FileUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { api, errList } from "@/lib/api";
import { samples } from "@/lib/samples";
import { ErrorList } from "./Stepper";

const TEXT_EXT = [".txt", ".md", ".eml", ".csv"];
const ALL_EXT = [...TEXT_EXT, ".pdf"];
const EMPTY = { kind: "brief", label: "", source_date: "", text: "", filename: null };

export default function ReadDocumentForm({ intake, synthetic, onRead }) {
  const [f, setF] = useState(EMPTY);
  const [pdf, setPdf] = useState(null);
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const takeFile = (file) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALL_EXT.includes(ext)) {
      setErrors([`"${file.name}" is not a supported file type. Use a PDF or a text file (${TEXT_EXT.join(", ")}).`]);
      return;
    }
    if (ext === ".pdf") {
      if (file.size > 10 * 1024 * 1024) { setErrors([`"${file.name}" is larger than 10 MB.`]); return; }
      setPdf(file);
      setF((prev) => ({ ...prev, label: prev.label || file.name }));
      setErrors([]);
      return;
    }
    if (file.size > 200000) { setErrors([`"${file.name}" is larger than 200 KB. Paste the relevant part instead.`]); return; }
    const reader = new FileReader();
    reader.onload = () => { setPdf(null); setF((prev) => ({ ...prev, text: String(reader.result), filename: file.name, label: prev.label || file.name })); setErrors([]); };
    reader.onerror = () => setErrors([`Could not read "${file.name}". Your other input is kept.`]);
    reader.readAsText(file);
  };

  const pickFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) takeFile(file);
  };

  const loadSamplePdf = async () => {
    try {
      const { data } = await api.get("/project/sample-pdf", { responseType: "blob" });
      const quoteDate = samples(intake).find((x) => x.key === "quote")?.source_date || "";
      setF({ ...EMPTY, kind: "quote", label: "Redwood quote PDF (Synthetic)", source_date: quoteDate });
      takeFile(new File([data], "redwood-quote-synthetic.pdf", { type: "application/pdf" }));
    } catch (e) { setErrors(errList(e)); }
  };

  const submit = async () => {
    setBusy(true);
    try {
      let data;
      if (pdf) {
        const fd = new FormData();
        fd.append("file", pdf);
        fd.append("kind", f.kind);
        fd.append("label", f.label);
        fd.append("source_date", f.source_date || "");
        ({ data } = await api.post("/project/sources/upload", fd));
      } else {
        ({ data } = await api.post("/project/sources", f));
      }
      const src = data.sources[data.sources.length - 1];
      onRead(data);
      setErrors([]);
      if (src?.status === "read") { setF(EMPTY); setPdf(null); }
    } catch (e) {
      setErrors(errList(e));
    } finally {
      setBusy(false);
    }
  };

  const sel = "mt-1 h-9 w-full rounded-md border border-input bg-white px-2 text-sm";
  return (
    <div data-testid="read-document-form" className="space-y-4 rounded-md border border-slate-200 bg-white p-5">
      <div>
        <p className="eyebrow">Read a brief, quote or email</p>
        <p className="mt-1 text-xs text-slate-500">AI proposes facts, each with its exact source excerpt. Nothing changes until you choose readings to use. Text inside documents is treated as data, never as instructions.</p>
      </div>
      {synthetic && (
        <div className="flex flex-wrap gap-2">
          {samples(intake).map((s) => (
            <Button key={s.key} size="sm" variant="outline" onClick={() => { setPdf(null); setF({ ...s, filename: null }); }} data-testid={`read-sample-${s.key}-button`}>{s.label}</Button>
          ))}
          <Button size="sm" variant="outline" onClick={loadSamplePdf} data-testid="read-sample-pdf-button">Redwood quote PDF (Synthetic)</Button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs font-semibold text-slate-700" htmlFor="doc-kind">Kind</Label>
          <select id="doc-kind" className={sel} value={f.kind} onChange={set("kind")} data-testid="read-kind-select">
            <option value="brief">Customer brief</option><option value="quote">Partner quote</option>
            <option value="email">Email</option><option value="other">Other document</option>
          </select>
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-700" htmlFor="doc-label">Label</Label>
          <Input id="doc-label" className="mt-1 h-9" value={f.label} onChange={set("label")} data-testid="read-label-input" />
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-700" htmlFor="doc-date">Document date (later ones win)</Label>
          <Input id="doc-date" type="date" className="mt-1 h-9" value={f.source_date || ""} onChange={set("source_date")} data-testid="read-date-input" />
        </div>
      </div>
      {pdf ? (
        <div data-testid="read-pdf-chosen" className="flex items-center justify-between gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm">
          <div>
            <p className="font-semibold text-slate-900">{pdf.name}</p>
            <p className="text-xs text-slate-500">PDF · {(pdf.size / 1024).toFixed(0)} KB. Its text will be pulled out page by page and kept with the original file. Scanned PDFs without text are refused.</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => setPdf(null)} aria-label="Remove PDF" data-testid="read-pdf-remove"><X className="h-4 w-4" /></Button>
        </div>
      ) : (
        <Textarea rows={7} className="font-mono text-xs" placeholder="Paste the document text here, or choose a PDF or text file…" value={f.text} onChange={set("text")} data-testid="read-text-input" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={submit} disabled={busy} data-testid="read-submit-button">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Reading… (up to 2 min)</> : "Read document"}
        </Button>
        <input ref={fileRef} type="file" accept={ALL_EXT.join(",")} className="hidden" onChange={pickFile} data-testid="read-file-input" />
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="read-file-button"><FileUp className="h-4 w-4" /> Choose PDF or text file</Button>
        {f.filename && !pdf && <span className="font-mono text-[11px] text-slate-500">{f.filename}</span>}
      </div>
      <ErrorList errors={errors} testId="read-errors" title="Not read. Your input is kept:" />
    </div>
  );
}
