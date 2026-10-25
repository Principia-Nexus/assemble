import os
os.chdir('/app')


def edit(p, pairs):
    s = open(p).read()
    for o, n in pairs:
        assert s.count(o) == 1, (p, o[:70])
        s = s.replace(o, n)
    open(p, 'w').write(s)


edit('backend/items_routes.py', [
    ('''            if kind_op == "restore":
                doc = op.get("doc") or {}
                if not doc.get("item_id") or doc.get("project_id") != pid:''',
     '''            if kind_op == "restore":
                doc = op.get("doc") or {}
                if not inverse_of or not doc.get("item_id") or doc.get("project_id") != pid or doc.get("kind") not in KINDS:'''),
    ('''            e = op.get("edge") or op
            a, b, k''', '''            e = (op.get("edge") if inverse_of else None) or op
            a, b, k'''),
    ('''            await db.items.replace_one({"item_id": d["item_id"]}, {**public(d), "deleted": False}, upsert=True)
        elif w == "delete":
            await db.items.update_one({"item_id": d["item_id"]}, {"$set": {"deleted": True, "updated_at": now}})
        elif w == "edge_add":
            await db.item_edges.replace_one({"edge_id": d["edge_id"]}, {**public(d), "deleted": False}, upsert=True)
        else:
            await db.item_edges.update_one({"edge_id": d["edge_id"]}, {"$set": {"deleted": True}})''',
     '''            await db.items.replace_one({"item_id": d["item_id"], "project_id": pid}, {**public(d), "project_id": pid, "deleted": False}, upsert=True)
        elif w == "delete":
            await db.items.update_one({"item_id": d["item_id"], "project_id": pid}, {"$set": {"deleted": True, "updated_at": now}})
        elif w == "edge_add":
            await db.item_edges.replace_one({"edge_id": d["edge_id"], "project_id": pid}, {**public(d), "project_id": pid, "deleted": False}, upsert=True)
        else:
            await db.item_edges.update_one({"edge_id": d["edge_id"], "project_id": pid}, {"$set": {"deleted": True}})'''),
])
edit('backend/quote_routes.py', [
    ('''import hashlib
import json''', '''import hashlib
import json
import re'''),
    ('''def now():
    return datetime.now(timezone.utc)
''', '''def now():
    return datetime.now(timezone.utc)


def utc(s):
    d = datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    return d.replace(tzinfo=timezone.utc) if d.tzinfo is None else d.astimezone(timezone.utc)


def stamp(d):
    return d.strftime("%Y-%m-%dT%H:%M:%SZ")


EMAIL_RE = re.compile(r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")
'''),
    ('''            if v:
                try:
                    datetime.fromisoformat(str(v).replace("Z", "+00:00"))
                except ValueError:
                    errors.append("Valid-until must be a date and time.")''',
     '''            if v:
                try:
                    v = stamp(utc(v))
                except ValueError:
                    errors.append("Valid-until must be a date and time.")'''),
    ('''        elif k == "currency":''', '''        elif k == "customer_email":
            v = (str(v or "").strip().lower() or None)
            if v and not EMAIL_RE.match(v):
                errors.append("Customer email is not a valid address.")
        elif k == "currency":'''),
    ('''    elif datetime.fromisoformat(vu.replace("Z", "+00:00")).replace(tzinfo=timezone.utc) <= now():''', '''    elif utc(vu) <= now():'''),
    ('''    if q["state"] in OPEN and vu and datetime.fromisoformat(vu.replace("Z", "+00:00")).replace(tzinfo=timezone.utc) <= now():''',
     '''    if q["state"] in OPEN and vu and utc(vu) <= now():'''),
    ('''"snapshot.valid_until": {"$gt": now().isoformat()[:16]}}''', '''"snapshot.valid_until": {"$gt": stamp(now())}}'''),
])
edit('backend/media_routes.py', [
    ('''        r = await asyncio.wait_for(stt.transcribe(file=buf, model="whisper-1", response_format="json"), timeout=90)''',
     '''        r = await asyncio.wait_for(stt.transcribe(file=buf, model="whisper-1", response_format="verbose_json"), timeout=90)'''),
    ('''    text = (getattr(r, "text", "") or "").strip()
    if not text:''', '''    text = (getattr(r, "text", "") or "").strip()
    segs = [s if isinstance(s, dict) else getattr(s, "__dict__", {}) for s in (getattr(r, "segments", None) or [])]
    if segs and all((s.get("no_speech_prob") or 0) > 0.6 for s in segs):
        text = ""
    if not text:'''),
])
F = 'frontend/src/'
edit(F + 'components/ws/useItems.js', [
    ('''    setSave("failed");''', '''    setSave(e.response?.status === 422 ? "idle" : "failed");'''),
])
edit(F + 'components/ws/Inspector.jsx', [
    ('''                <span className="min-w-0 flex-1 truncate">{e.from_id === it.item_id ? `${e.kind.replace("_", " ")} → ${title(e.to_id)}` : `${title(e.from_id)} → ${e.kind.replace("_", " ")}`}''',
     '''                <span className="min-w-0 flex-1 truncate">{e.from_id === it.item_id ? `This ${REL[e.kind]} ${title(e.to_id)}` : `${title(e.from_id)} ${REL[e.kind]} this`}'''),
    ('''const sel = "h-9''', '''const REL = { prerequisite: "must finish before", uses_input: "is input to", produces_output: "produces output for", relates_to: "relates to" };
const sel = "h-9'''),
])
edit(F + 'components/ws/ListView.jsx', [
    ('''<span className="font-normal text-[#64748B]">· {p.sites.map((s) => s.site_id).join(", ")}</span>''',
     '''<span className="font-normal text-[#64748B]">· {p.sites.length ? p.sites.map((s) => s.site_id).join(", ") : "no sites assigned"}</span>'''),
])
edit(F + 'components/ws/ReportView.jsx', [
    ('''— {p.sites.map((s) => s.name || s.site_id).join(", ")}</li>''', '''— {p.sites.length ? p.sites.map((s) => s.name || s.site_id).join(", ") : "no sites assigned"}</li>'''),
])
edit(F + 'components/ws/WeekView.jsx', [
    ('''useState(() => monday(start || firstDated || iso(new Date())))''', '''useState(() => monday(firstDated || start || iso(new Date())))'''),
    ('''{it.date_kind || "date"}{it.firm_id ? ` · ${firmName(sheet, it.firm_id)}` : ""}''', '''{[it.date_kind, it.firm_id && firmName(sheet, it.firm_id)].filter(Boolean).join(" · ")}'''),
])
edit(F + 'components/ws/Composer.jsx', [
    ('''className="max-h-40 min-h-[36px] flex-1 resize-none''', '''className="order-first max-h-40 min-h-[36px] basis-full resize-none sm:order-none sm:basis-auto sm:flex-1'''),
    ('''        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-1.5''', '''        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex flex-wrap items-end gap-1.5 sm:flex-nowrap'''),
    ('''<button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="flex h-9''', '''<button type="submit" disabled={!text.trim() || busy} aria-label="Send" className="ml-auto flex h-9'''),
])
edit(F + 'pages/ProjectSheet.jsx', [
    ('''<label className="flex h-8 w-[200px] items-center''', '''<label className="order-last flex h-8 w-full items-center sm:order-none sm:w-[200px]'''),
    ('''onClick={() => setTourOpen(true)} data-testid="demo-tour-open"><Sparkles className="h-3.5 w-3.5" /> Guided tour</Button>''', '''onClick={() => setTourOpen(true)} data-testid="demo-tour-open">Guided tour</Button>'''),
    ('''import { Eye, MoreHorizontal, Search, Sparkles } from "lucide-react";''', '''import { Eye, MoreHorizontal, Search } from "lucide-react";'''),
])
edit(F + 'App.js', [('<Toaster position="top-right" richColors visibleToasts={2} />', '<Toaster position="top-right" offset={76} richColors visibleToasts={2} />')])
edit(F + 'components/ws/QuotePanel.jsx', [
    ('''valid_until: f.valid_until || null,''', '''valid_until: f.valid_until ? new Date(f.valid_until).toISOString() : null,'''),
    ('''  const [f, setF] = useState({ ...q, price''', '''  const local = (v) => { if (!v) return ""; const d = new Date(v); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
  const [f, setF] = useState({ ...q, valid_until: local(q.valid_until), price'''),
    ('''valid until {s.valid_until?.replace("T", " ")}''', '''valid until {s.valid_until ? new Date(s.valid_until).toLocaleString() : ""}'''),
])
edit(F + 'pages/QuoteReview.jsx', [
    ('''<dd>{s.valid_until?.replace("T", " ")} UTC</dd>''', '''<dd>{s.valid_until ? new Date(s.valid_until).toLocaleString() : ""}</dd>'''),
])
os.remove(F + 'components/ws/ProjectRail.jsx')
print("ok")
