import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ArrowUp, Camera, ChevronDown, ChevronUp, Loader2, Mic, Paperclip, Plus, Square } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api, errText } from "@/lib/api";

function Receipt({ batch, onUndo, onShow, undone }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs text-[#1A2838]" data-testid={`receipt-${batch.batch_id}`}>
      <span className="min-w-0 flex-1">Saved privately · {batch.touched.length} item{batch.touched.length === 1 ? "" : "s"}</span>
      <button type="button" className="font-medium text-[#215273] hover:underline" onClick={() => onShow(batch)} data-testid="receipt-show-changes">Show changes</button>
      <button type="button" className="font-medium text-[#A93A3A] hover:underline disabled:opacity-50" disabled={undone} onClick={() => onUndo(batch)} data-testid="receipt-undo">{undone ? "Undone" : "Undo"}</button>
    </div>
  );
}

const Composer = forwardRef(function Composer({ sheet, onSheet, onAdopt, onUndo, onShow, onAdd, suggestions, onTrayChange }, ref) {
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [undone, setUndone] = useState({});
  const input = useRef(null), end = useRef(null), photo = useRef(null), rec = useRef(null);
  const [voice, setVoice] = useState(null);
  const [utterance, setUtterance] = useState(null);
  const note = (text, mode = "explain") => { setOpen(true); setMsgs((m) => [...m, { msg_id: `n-${Date.now()}`, role: "assistant", mode, text }]); };
  const record = async () => {
    if (voice === "recording") { rec.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream), chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setVoice("transcribing");
        const fd = new FormData();
        fd.append("file", new Blob(chunks, { type: mr.mimeType.split(";")[0] || "audio/webm" }), "speech.webm");
        try {
          const { data } = await api.post("/project/transcribe", fd);
          setText((t) => (t ? `${t} ${data.text}` : data.text));
          setUtterance(data.utterance_id);
          input.current?.focus();
        } catch (e) { note(errText(e), "error"); }
        setVoice(null);
      };
      rec.current = mr;
      mr.start();
      setVoice("recording");
    } catch { note("Microphone is not available in this browser. Type instead.", "error"); }
  };
  const addPhoto = async (file) => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/project/photos", fd);
      const ph = data.photo;
      if (ph.status !== "read") note(`I stored ${ph.name} but could not read it reliably. Describe what it shows here so I can use it.`);
      else note(`Photo ${ph.name} (${ph.photo_id}) — visible: ${ph.observations.map((o) => `${o.text}${o.region ? ` [${o.region}]` : ""}`).join("; ") || "nothing specific"}.${ph.readable_text.length ? ` Readable text: ${ph.readable_text.join("; ")}.` : ""}${ph.unknown.length ? ` Unknown from the photo: ${ph.unknown.join("; ")}.` : ""}`);
      if (ph.status === "read") setText(`Use the observations from photo ${ph.photo_id} in the scope.`);
    } catch (e) { note(errText(e), "error"); }
    setBusy(false);
  };
  useImperativeHandle(ref, () => ({ openMenu: () => setMenu(true), focus: () => input.current?.focus(), close: () => setOpen(false), isOpen: () => open }));

  useEffect(() => { api.get("/project/assistant").then((r) => setMsgs(r.data.messages)).catch(() => {}); }, []);
  useEffect(() => { onTrayChange?.(open); }, [open, onTrayChange]);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "end" }); }, [msgs, open, busy]);

  const send = async (raw) => {
    const message = (raw ?? text).trim();
    if (!message || busy) return;
    setBusy(true);
    setOpen(true);
    setMsgs((m) => [...m, { msg_id: `local-${Date.now()}`, role: "user", text: message }]);
    try {
      const { data } = await api.post("/project/assistant", { message, rev: sheet.project.rev, utterance_id: raw ? null : utterance });
      setUtterance(null);
      setMsgs((m) => [...m, data.reply]);
      setText("");
      if (data.sheet) onSheet(data.sheet);
      if (data.reply.batch) onAdopt(data.reply.batch);
    } catch (e) {
      setMsgs((m) => [...m, { msg_id: `err-${Date.now()}`, role: "assistant", mode: "error", text: errText(e) }]);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };
  const undo = async (b) => { const r = await onUndo(b.batch_id); if (r.ok) setUndone((u) => ({ ...u, [b.batch_id]: true })); };

  return (
    <div className="relative z-20 flex shrink-0 flex-col items-center px-3 pb-3 pt-2 sm:px-6 sm:pb-4" data-testid="composer-dock">
      <div className="w-full max-w-[760px]">
        {open && (
          <div className="ws-tray-in mb-2 flex max-h-[40vh] flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF]/95 shadow-[0_8px_30px_-12px_rgba(26,40,56,.3)] backdrop-blur" data-testid="conversation-tray">
            <div className="flex items-center border-b border-[#F1F5F9] px-3 py-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Conversation</p>
              <button type="button" className="ml-auto rounded p-1 text-[#64748B] hover:bg-[#F1F5F9]" onClick={() => setOpen(false)} aria-label="Collapse conversation" data-testid="tray-collapse"><ChevronDown className="h-4 w-4" /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2" role="log" aria-live="polite">
              {msgs.map((m) => (
                <div key={m.msg_id} className={m.role === "user" ? "flex justify-end" : ""} data-testid={`msg-${m.role}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed ${m.role === "user" ? "bg-[#1A2838] text-white" : m.mode === "error" ? "bg-[#FBEFEF] text-[#A93A3A]" : "bg-white text-[#1A2838]"}`}>
                    {m.text}
                    {m.errors?.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-[#A93A3A]">{m.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
                    {m.batch && m.wrote && <Receipt batch={m.batch} onUndo={undo} onShow={onShow} undone={undone[m.batch.batch_id]} />}
                  </div>
                </div>
              ))}
              {busy && <p className="flex items-center gap-2 text-xs text-[#64748B]" data-testid="assistant-working"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the project…</p>}
              <div ref={end} />
            </div>
          </div>
        )}
        {!open && suggestions.length > 0 && (
          <div className="mb-2 flex flex-wrap justify-center gap-2">
            {suggestions.slice(0, 2).map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1 text-[12.5px] font-medium text-[#1A2838] shadow-sm transition-colors hover:bg-white" data-testid={`suggestion-${s.slice(0, 12).replace(/\W+/g, "-").toLowerCase()}`}>{s}</button>
            ))}
            {msgs.length > 0 && <button type="button" onClick={() => setOpen(true)} className="rounded-full px-2 py-1 text-[12px] text-[#64748B] hover:text-[#1A2838]" data-testid="tray-expand"><ChevronUp className="inline h-3.5 w-3.5" /> Conversation</button>}
          </div>
        )}
        {utterance && <p className="mb-1 text-center text-[11.5px] text-[#64748B]" data-testid="voice-review-note">From your voice. Check the text before sending; nothing changes until you send.</p>}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-1.5 rounded-[22px] border border-[#CBD5E1] bg-[#FFFFFF] p-1.5 shadow-[0_6px_24px_-10px_rgba(26,40,56,.35)] focus-within:border-[#215273]" data-testid="composer">
          <DropdownMenu open={menu} onOpenChange={setMenu}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-[#1A2838] hover:bg-[#F1F5F9]" data-testid="composer-add-button"><Plus className="h-4 w-4" /> Add</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56" data-testid="add-menu">
              <DropdownMenuItem onSelect={() => onAdd("details")} data-testid="add-details">Add details</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAdd("source")} data-testid="add-source">Add source</DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid="add-work-item">Add work item</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {[["group", "Group / scope package"], ["task", "Task"], ["milestone", "Milestone"], ["condition", "Question / condition"]].map(([k, l]) => (
                    <DropdownMenuItem key={k} onSelect={() => onAdd(`item:${k}`)} data-testid={`add-item-${k}`}>{l}</DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onAdd("check")} data-testid="add-run-checks">Run checks</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAdd("review")} data-testid="add-prepare-review">Prepare review</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onAdd("quote")} data-testid="add-customer-quote">Customer quote</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9]" onClick={() => onAdd("source")} aria-label="Attach a document" data-testid="composer-attach-button"><Paperclip className="h-4 w-4" /></button>
          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9]" onClick={() => photo.current?.click()} aria-label="Add a photo" data-testid="composer-photo-button"><Camera className="h-4 w-4" /></button>
          <input ref={photo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { addPhoto(e.target.files[0]); e.target.value = ""; }} data-testid="composer-photo-input" />
          <button type="button" onClick={record} disabled={voice === "transcribing"} aria-label={voice === "recording" ? "Stop recording" : "Speak"} data-testid="composer-mic-button"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${voice === "recording" ? "bg-red-600 text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>
            {voice === "transcribing" ? <Loader2 className="h-4 w-4 animate-spin" /> : voice === "recording" ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
          </button>
          <label htmlFor="composer-input" className="sr-only">Ask or describe a change</label>
          <textarea id="composer-input" ref={input} rows={1} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask or describe a change…"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            className="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-[14px] text-[#1A2838] outline-none placeholder:text-[#94A3B8] [field-sizing:content]" data-testid="composer-input" />
          <button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A2838] text-white transition-[background-color,transform] hover:bg-[#2F4A66] active:scale-95 disabled:bg-[#CBD5E1]" data-testid="composer-send-button">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </form>
      </div>
    </div>
  );
});

export default Composer;
