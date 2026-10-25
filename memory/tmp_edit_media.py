import os
os.chdir('/app')


def edit(p, pairs):
    s = open(p).read()
    for o, n in pairs:
        assert s.count(o) == 1, (p, o[:60])
        s = s.replace(o, n)
    open(p, 'w').write(s)


edit('backend/server.py', [
    ("import quote_routes\n", "import quote_routes\nimport media_routes\n"),
    ("app.include_router(quote_routes.public)\n", "app.include_router(quote_routes.public)\napp.include_router(media_routes.router)\n"),
])
edit('backend/assistant_routes.py', [
    ("class AskIn(BaseModel):\n    message: str\n    rev: int\n", "class AskIn(BaseModel):\n    message: str\n    rev: int\n    utterance_id: Optional[str] = None\n"),
    ('    await save_msg(p, user, "user", msg)', '    await save_msg(p, user, "user", msg, utterance_id=body.utterance_id)'),
    ("from pydantic import BaseModel\n", "from typing import Optional\n\nfrom pydantic import BaseModel\n"),
])
C = 'frontend/src/components/ws/Composer.jsx'
edit(C, [
    ('import { ArrowUp, ChevronDown, ChevronUp, Loader2, Paperclip, Plus } from "lucide-react";',
     'import { ArrowUp, Camera, ChevronDown, ChevronUp, Loader2, Mic, Paperclip, Plus, Square } from "lucide-react";'),
    ('''  const input = useRef(null), end = useRef(null);''', '''  const input = useRef(null), end = useRef(null), photo = useRef(null), rec = useRef(null);
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
  };'''),
    ('''      const { data } = await api.post("/project/assistant", { message, rev: sheet.project.rev });''',
     '''      const { data } = await api.post("/project/assistant", { message, rev: sheet.project.rev, utterance_id: raw ? null : utterance });
      setUtterance(null);'''),
    ('''          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9]" onClick={() => onAdd("source")} aria-label="Attach a file" data-testid="composer-attach-button"><Paperclip className="h-4 w-4" /></button>''',
     '''          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9]" onClick={() => onAdd("source")} aria-label="Attach a document" data-testid="composer-attach-button"><Paperclip className="h-4 w-4" /></button>
          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9]" onClick={() => photo.current?.click()} aria-label="Add a photo" data-testid="composer-photo-button"><Camera className="h-4 w-4" /></button>
          <input ref={photo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { addPhoto(e.target.files[0]); e.target.value = ""; }} data-testid="composer-photo-input" />
          <button type="button" onClick={record} disabled={voice === "transcribing"} aria-label={voice === "recording" ? "Stop recording" : "Speak"} data-testid="composer-mic-button"
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${voice === "recording" ? "bg-red-600 text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>
            {voice === "transcribing" ? <Loader2 className="h-4 w-4 animate-spin" /> : voice === "recording" ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" />}
          </button>'''),
    ('''        <form onSubmit''', '''        {utterance && <p className="mb-1 text-center text-[11.5px] text-[#64748B]" data-testid="voice-review-note">From your voice. Check the text before sending; nothing changes until you send.</p>}
        <form onSubmit'''),
])
print("ok")
