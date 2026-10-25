import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, errList } from "@/lib/api";

const MODE = { explain: "Answer · no changes", revise: "Private draft edit", intake: "New information", question: "Question", error: "Not completed" };

function Msg({ m, onRead, reading, done }) {
  if (m.role === "user") return <div className="ml-6 rounded-md bg-slate-900 px-3 py-2 text-sm text-white" data-testid="assistant-user-msg">{m.text}</div>;
  return (
    <div className="mr-2 space-y-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" data-testid="assistant-reply">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500" data-testid="assistant-reply-mode">{MODE[m.mode] || m.mode}{m.wrote ? " · saved" : ""}</p>
      <p className="whitespace-pre-wrap">{m.text}</p>
      {m.errors?.length > 0 && <p className="text-xs text-red-700" data-testid="assistant-reply-errors">{m.errors.join(" ")}</p>}
      {m.cites?.length > 0 && <p className="text-[11px] text-slate-500">Based on: {m.cites.join(" · ")}</p>}
      {m.mode === "intake" && m.source && onRead && (
        <Button size="sm" variant="outline" disabled={reading || done} onClick={() => onRead(m)} data-testid="assistant-read-source">
          {done ? "Read as a source" : reading ? "Reading…" : "Read it as a source"}
        </Button>
      )}
      {m.meta && <p className="text-[10px] text-slate-400" data-testid="assistant-reply-meta">{m.meta.model} · {(m.meta.elapsed_ms / 1000).toFixed(1)}s</p>}
    </div>
  );
}

export default function AssistantPanel({ sheet, onSheet, reload, className = "" }) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [readIds, setReadIds] = useState([]);
  const sentRef = useRef(false);
  const end = useRef(null);
  const pid = sheet.project.project_id;
  useEffect(() => {
    api.get("/project/assistant").then((r) => { if (!sentRef.current) setMsgs(r.data.messages); }).catch(() => {});
  }, [pid]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [msgs.length]);
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    const sent = text;
    sentRef.current = true;
    setBusy(true); setError("");
    setMsgs((m) => [...m, { msg_id: `tmp-${m.length}`, role: "user", text: sent }]);
    try {
      const { data } = await api.post("/project/assistant", { message: sent, rev: sheet.project.rev });
      setMsgs((m) => [...m, { ...data.reply, userText: sent }]);
      setText("");
      if (data.sheet) onSheet(data.sheet);
    } catch (err) {
      setMsgs((m) => m.slice(0, -1));
      setError(errList(err).join(" "));
      if (err.response?.status === 409) await reload();
    } finally { setBusy(false); }
  };
  const readSource = async (m) => {
    const idx = msgs.indexOf(m);
    const userMsg = [...msgs.slice(0, idx)].reverse().find((x) => x.role === "user");
    setReading(true); setError("");
    try {
      await api.post("/project/sources", { kind: ["brief", "quote", "email"].includes(m.source.kind) ? m.source.kind : "other", label: m.source.label || "Pasted information",
        text: m.userText || userMsg?.text, source_date: new Date().toISOString().slice(0, 10) });
      setReadIds((r) => [...r, m.msg_id]);
      toast.success("Read as a source. Review its readings in Check.");
      await reload();
    } catch (err) { setError(errList(err).join(" ")); }
    finally { setReading(false); }
  };
  return (
    <section data-testid="assistant-panel" aria-label="Assistant" className={`flex min-h-[280px] flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50 ${className}`}>
      <div className="border-b border-slate-200 bg-white px-4 py-2.5">
        <p className="text-sm font-semibold text-slate-900">Assistant</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" data-testid="assistant-transcript">
        {msgs.length === 0 && <p className="text-xs text-slate-500">Try “Why is this firm needed?” or “Move S09 and S10 to week 1 with Dogwood”.</p>}
        {msgs.map((m) => <Msg key={m.msg_id} m={m} onRead={readSource} reading={reading} done={readIds.includes(m.msg_id)} />)}
        {busy && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working…</p>}
        <div ref={end} />
      </div>
      {error && <p role="alert" data-testid="assistant-error" className="border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 bg-white p-2">
        <label htmlFor="assistant-input" className="sr-only">Message the assistant</label>
        <Textarea id="assistant-input" rows={2} value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) send(e); }} className="min-h-[44px] resize-none text-sm" data-testid="assistant-input" />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={busy || !text.trim()} aria-label="Send to assistant" data-testid="assistant-send">
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}
