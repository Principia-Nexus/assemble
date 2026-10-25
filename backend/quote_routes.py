"""Customer quotes: private draft -> immutable issued snapshot -> one guarded customer decision; amendments keep the baseline."""
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from pymongo import ReturnDocument

import mailer
from core import db, now_iso, new_id, current_user, log_event
from project_routes import get_project, org, bad

router = APIRouter(prefix="/api/project")
public = APIRouter(prefix="/api/quote")

DRAFT_FIELDS = ("customer_name", "customer_email", "site", "scope", "inclusions", "exclusions", "price_cents", "currency",
                "tax_basis", "payment_terms", "timing", "valid_until", "terms", "conditions")
OPEN = ("issued", "changes_requested")
CODE_TTL, CODE_TRIES, SESSION_TTL = 15, 5, 12


class DraftIn(BaseModel):
    fields: Dict[str, Any] = {}


class NewIn(BaseModel):
    amend_of: Optional[str] = None


class IssueIn(BaseModel):
    digest: str


class VerifyIn(BaseModel):
    code: str


class RespondIn(BaseModel):
    action: str
    digest: str
    signer_name: str
    authority: Optional[str] = None
    note: Optional[str] = None
    intent: bool = False
    key: str


def now():
    return datetime.now(timezone.utc)


def digest(snap):
    return hashlib.sha256(json.dumps(snap, sort_keys=True, default=str).encode()).hexdigest()[:24]


def clean(raw, errors):
    out = {}
    for k in DRAFT_FIELDS:
        if k not in raw:
            continue
        v = raw[k]
        if k == "price_cents":
            if v in (None, ""):
                v = None
            else:
                try:
                    v = int(round(float(v)))
                except (TypeError, ValueError):
                    errors.append("Price must be a number.")
                    continue
                if v < 0:
                    errors.append("Price cannot be negative.")
        elif k in ("inclusions", "exclusions", "conditions"):
            v = [str(x).strip()[:500] for x in (v or []) if str(x).strip()][:40]
        elif k == "valid_until":
            v = v or None
            if v:
                try:
                    datetime.fromisoformat(str(v).replace("Z", "+00:00"))
                except ValueError:
                    errors.append("Valid-until must be a date and time.")
        elif k == "currency":
            v = (v or "USD").upper()[:3]
        else:
            v = (str(v).strip()[:4000] or None) if v is not None else None
        out[k] = v
    return out


def missing(q):
    m = []
    if not q.get("customer_name"):
        m.append("customer name")
    if not q.get("customer_email") or "@" not in (q.get("customer_email") or ""):
        m.append("customer email")
    if not q.get("site"):
        m.append("site")
    if not q.get("scope"):
        m.append("scope")
    if q.get("price_cents") is None:
        m.append("an authorized price (unknown is not zero)")
    if not q.get("tax_basis"):
        m.append("tax treatment")
    if not q.get("payment_terms"):
        m.append("payment terms")
    if not q.get("timing"):
        m.append("timing")
    vu = q.get("valid_until")
    if not vu:
        m.append("valid-until date")
    elif datetime.fromisoformat(vu.replace("Z", "+00:00")).replace(tzinfo=timezone.utc) <= now():
        m.append("a valid-until date in the future")
    return m


def snapshot_of(q, p, firm_name):
    return {"number": q["number"], "kind": q["kind"], "baseline_number": q.get("baseline_number"), "project": p["intake"].get("job_name") or p["name"],
            "seller": firm_name, "synthetic": bool(p.get("synthetic")), **{k: q.get(k) for k in DRAFT_FIELDS}}


def view(q, include_private=True):
    out = {k: v for k, v in q.items() if k not in ("_id", "token", "codes")}
    if not include_private:
        out = {k: out.get(k) for k in ("quote_id", "number", "kind", "state", "snapshot", "digest", "issued_at", "responses", "baseline_number")}
    return out


async def refresh_expiry(q):
    s = q.get("snapshot") or {}
    vu = s.get("valid_until")
    if q["state"] in OPEN and vu and datetime.fromisoformat(vu.replace("Z", "+00:00")).replace(tzinfo=timezone.utc) <= now():
        r = await db.quotes.find_one_and_update({"quote_id": q["quote_id"], "state": {"$in": list(OPEN)}},
                                                {"$set": {"state": "expired", "expired_at": now_iso()}}, return_document=ReturnDocument.AFTER)
        return r or await db.quotes.find_one({"quote_id": q["quote_id"]})
    return q


async def firm_name(p):
    f = await db.firms.find_one({"firm_id": p["firm_id"]}, {"_id": 0, "name": 1})
    return (f or {}).get("name") or "Seller"


async def own_quote(p, qid):
    q = await db.quotes.find_one({"quote_id": qid, "project_id": p["project_id"]})
    if not q:
        raise HTTPException(404, "Quote not found in this project.")
    return await refresh_expiry(q)


@router.get("/quotes")
async def list_quotes(user=Depends(current_user)):
    p = await get_project(user)
    qs = [await refresh_expiry(q) for q in await db.quotes.find({"project_id": p["project_id"]}).sort("created_at", 1).to_list(200)]
    return {"quotes": [view(q) for q in qs]}


@router.post("/quotes")
async def new_quote(body: NewIn, user=Depends(current_user)):
    p = await get_project(user)
    if await db.quotes.find_one({"project_id": p["project_id"], "state": "draft"}):
        bad("Finish or discard the current quote draft first.")
    base = None
    if body.amend_of:
        base = await own_quote(p, body.amend_of)
        if base["state"] not in ("accepted", "issued", "changes_requested", "declined", "expired", "withdrawn"):
            bad("Only an issued quote can be revised.")
    accepted = await db.quotes.find_one({"project_id": p["project_id"], "state": "accepted"}, sort=[("created_at", -1)])
    n = await db.quotes.count_documents({"project_id": p["project_id"]}) + 1
    seed = (base or {}).get("snapshot") or {}
    if not seed:
        it = p["intake"]
        seed = {"customer_name": it.get("customer_name"), "scope": it.get("scope_summary"), "currency": "USD"}
    q = {"quote_id": new_id("quo"), "project_id": p["project_id"], "firm_id": p["firm_id"], "number": f"Q{n}",
         "kind": "amendment" if accepted else "offer", "baseline_id": accepted["quote_id"] if accepted else None,
         "baseline_number": accepted["number"] if accepted else None, "replaces": base["quote_id"] if base and not accepted else None,
         "state": "draft", **{k: seed.get(k) for k in DRAFT_FIELDS}, "responses": [], "created_at": now_iso(), "created_by": user["name"]}
    q["currency"] = q.get("currency") or "USD"
    await db.quotes.insert_one(dict(q))
    return {"quote": view(q)}


@router.put("/quotes/{qid}")
async def edit_quote(qid: str, body: DraftIn, user=Depends(current_user)):
    p = await get_project(user)
    q = await own_quote(p, qid)
    if q["state"] != "draft":
        bad("Issued quotes cannot change. Start a revision instead.")
    errors = []
    f = clean(body.fields, errors)
    if errors:
        bad(errors)
    q = await db.quotes.find_one_and_update({"quote_id": qid, "state": "draft"}, {"$set": {**f, "updated_at": now_iso()}}, return_document=ReturnDocument.AFTER)
    if not q:
        raise HTTPException(409, "This quote was issued in another tab. Reload.")
    return {"quote": view(q), "missing": missing(q), "preview": snapshot_of(q, p, await firm_name(p))}


@router.get("/quotes/{qid}/preview")
async def preview_quote(qid: str, user=Depends(current_user)):
    p = await get_project(user)
    q = await own_quote(p, qid)
    snap = q.get("snapshot") or snapshot_of(q, p, await firm_name(p))
    return {"snapshot": snap, "digest": digest(snap), "missing": missing(q) if q["state"] == "draft" else []}


@router.delete("/quotes/{qid}")
async def discard_quote(qid: str, user=Depends(current_user)):
    p = await get_project(user)
    r = await db.quotes.delete_one({"quote_id": qid, "project_id": p["project_id"], "state": "draft"})
    if not r.deleted_count:
        bad("Only a draft can be discarded.")
    return {"ok": True}


@router.post("/quotes/{qid}/issue")
async def issue_quote(qid: str, body: IssueIn, user=Depends(current_user)):
    p = await get_project(user)
    q = await own_quote(p, qid)
    if q["state"] != "draft":
        bad("This quote is already issued.")
    gaps = missing(q)
    if gaps:
        bad([f"Before issuing, add {', '.join(gaps)}."])
    snap = snapshot_of(q, p, await firm_name(p))
    d = digest(snap)
    if d != body.digest:
        raise HTTPException(409, "The quote changed since you previewed it. Review the preview again before issuing.")
    if q.get("replaces"):
        prev = await db.quotes.find_one_and_update({"quote_id": q["replaces"], "state": {"$in": list(OPEN)}},
                                                   {"$set": {"state": "superseded", "superseded_by": qid, "superseded_at": now_iso()}})
        if not prev and (await db.quotes.find_one({"quote_id": q["replaces"]}))["state"] == "accepted":
            bad("The previous quote was accepted meanwhile. Start an amendment instead.")
    token = secrets.token_urlsafe(24)
    q = await db.quotes.find_one_and_update(
        {"quote_id": qid, "state": "draft"},
        {"$set": {"state": "issued", "snapshot": snap, "digest": d, "token": token, "issued_at": now_iso(), "issued_by": user["name"],
                  "recipient": q["customer_email"].strip().lower()}}, return_document=ReturnDocument.AFTER)
    if not q:
        raise HTTPException(409, "This quote was issued in another tab.")
    await log_event(p["project_id"], org(user), "quote", f"Quote {q['number']} issued to {q['recipient']} (not yet sent).")
    return {"quote": view(q), "path": f"/quote/{token}"}


@router.get("/quotes/{qid}/link")
async def quote_link(qid: str, user=Depends(current_user)):
    p = await get_project(user)
    q = await own_quote(p, qid)
    if q["state"] == "draft":
        bad("Issue the quote first.")
    return {"path": f"/quote/{q['token']}", "recipient": q["recipient"], "sendable": mailer.sendable(q["recipient"])}


@router.post("/quotes/{qid}/send")
async def send_quote(qid: str, request: Request, user=Depends(current_user)):
    p = await get_project(user)
    q = await own_quote(p, qid)
    if q["state"] not in OPEN:
        bad("Only an open issued quote can be sent.")
    if not mailer.sendable(q["recipient"]):
        bad("This is a synthetic example address, so no email is sent. Copy the link instead.")
    origin = (request.headers.get("origin") or "").rstrip("/")
    if not origin:
        bad("Send the quote from the app.")
    s = q["snapshot"]
    subject = f"Quote {s['number']} from {s['seller']}: {s['project']}"
    html = (f'<table role="presentation" width="100%"><tr><td style="padding:24px;font-family:Arial,sans-serif;color:#1A2838;font-size:15px">'
            f'<p>{mailer.escape(s["seller"])} sent you quote {s["number"]} for {mailer.escape(s["project"])}.</p>'
            f'<p><a href="{mailer.escape(origin + "/quote/" + q["token"])}" style="display:inline-block;background:#1A2838;color:#ffffff;'
            f'padding:10px 16px;text-decoration:none;border-radius:4px">Open quote</a></p>'
            f'<p style="font-size:12px;color:#666">You will confirm a code sent to this address before responding.</p></td></tr></table>')
    email_id = await mailer.send_email(to=q["recipient"], subject=subject, html=html)
    await db.quotes.update_one({"quote_id": qid}, {"$push": {"sends": {"at": now_iso(), "email_id": email_id, "to": q["recipient"]}}})
    await log_event(p["project_id"], org(user), "quote", f"Quote {q['number']} emailed to {q['recipient']} (accepted for sending).")
    return {"ok": True, "email_id": email_id}


@router.post("/quotes/{qid}/withdraw")
async def withdraw_quote(qid: str, user=Depends(current_user)):
    p = await get_project(user)
    q = await db.quotes.find_one_and_update({"quote_id": qid, "project_id": p["project_id"], "state": {"$in": list(OPEN)}},
                                            {"$set": {"state": "withdrawn", "withdrawn_at": now_iso()}}, return_document=ReturnDocument.AFTER)
    if not q:
        cur = await db.quotes.find_one({"quote_id": qid}, {"_id": 0, "state": 1})
        bad(f"Cannot withdraw: this quote is {cur['state'] if cur else 'missing'}.")
    await log_event(p["project_id"], org(user), "quote", f"Quote {q['number']} withdrawn.")
    return {"quote": view(q)}


# ---------------- customer side: email code, then view/respond to the exact issued snapshot
async def by_token(token):
    q = await db.quotes.find_one({"token": token})
    if not q:
        raise HTTPException(404, "This quote link is not valid.")
    return await refresh_expiry(q)


async def customer(token, request):
    q = await by_token(token)
    sid = request.headers.get("x-quote-session") or ""
    s = await db.quote_sessions.find_one({"session_id": sid, "quote_id": q["quote_id"]})
    if not s or s["expires_at"] < now_iso():
        raise HTTPException(401, "Confirm the code sent to your email first.")
    return q, s


@public.get("/{token}")
async def quote_intro(token: str):
    q = await by_token(token)
    s = q["snapshot"]
    em = q["recipient"]
    masked = em[0] + "•••@" + em.split("@")[1]
    return {"number": s["number"], "seller": s["seller"], "synthetic": s["synthetic"], "recipient_masked": masked}


@public.post("/{token}/code")
async def send_code(token: str):
    q = await by_token(token)
    code = f"{secrets.randbelow(10**6):06d}"
    await db.quote_codes.delete_many({"quote_id": q["quote_id"]})
    await db.quote_codes.insert_one({"quote_id": q["quote_id"], "hash": hashlib.sha256(code.encode()).hexdigest(), "tries": 0,
                                     "expires_at": (now() + timedelta(minutes=CODE_TTL)).isoformat()})
    if mailer.sendable(q["recipient"]):
        await mailer.send_email(to=q["recipient"], subject="Your Assemble code", html=mailer.code_html(code))
        return {"sent": True}
    return {"sent": False, "synthetic_code": code, "note": "Synthetic example address: no email is sent, so the code is shown here."}


@public.post("/{token}/verify")
async def verify_code(token: str, body: VerifyIn):
    q = await by_token(token)
    c = await db.quote_codes.find_one_and_update({"quote_id": q["quote_id"], "tries": {"$lt": CODE_TRIES}, "expires_at": {"$gt": now_iso()}},
                                                 {"$inc": {"tries": 1}}, return_document=ReturnDocument.AFTER)
    if not c or c["hash"] != hashlib.sha256(body.code.strip().encode()).hexdigest():
        raise HTTPException(422, ["That code is not right or has expired. Request a new one."])
    await db.quote_codes.delete_many({"quote_id": q["quote_id"]})
    sid = secrets.token_urlsafe(24)
    await db.quote_sessions.insert_one({"session_id": sid, "quote_id": q["quote_id"], "email": q["recipient"], "verified_at": now_iso(),
                                        "expires_at": (now() + timedelta(hours=SESSION_TTL)).isoformat()})
    return {"session": sid}


@public.get("/{token}/view")
async def customer_view(token: str, request: Request):
    q, _ = await customer(token, request)
    out = view(q, include_private=False)
    if q.get("baseline_id"):
        b = await db.quotes.find_one({"quote_id": q["baseline_id"]}, {"_id": 0, "snapshot": 1, "number": 1})
        out["baseline"] = b["snapshot"] if b else None
    return out


@public.post("/{token}/respond")
async def respond(token: str, body: RespondIn, request: Request):
    q, sess = await customer(token, request)
    key = body.key.strip()[:80]
    payload = {"action": body.action, "digest": body.digest, "signer_name": body.signer_name.strip(), "authority": (body.authority or "").strip() or None,
               "note": (body.note or "").strip()[:4000] or None}
    prior = next((r for r in q.get("responses") or [] if r["key"] == key), None)
    if prior:
        if {k: prior.get(k) for k in payload} != payload:
            raise HTTPException(409, "This response key was already used with different details.")
        return {"receipt": prior, "state": q["state"]}
    if body.action not in ("accept", "decline", "request_changes"):
        bad("Unsupported response.")
    if not payload["signer_name"]:
        bad("Type your full name.")
    if body.action == "accept" and not body.intent:
        bad("Tick the box to confirm you accept this exact version.")
    if body.action == "request_changes" and not payload["note"]:
        bad("Describe the changes you need.")
    if body.digest != q["digest"]:
        raise HTTPException(409, "This quote is not the version you were viewing. Reload to see the current one.")
    allowed = ["issued"] if body.action != "decline" else list(OPEN)
    if body.action == "request_changes":
        allowed = ["issued"]
    new_state = {"accept": "accepted", "decline": "declined", "request_changes": "changes_requested"}[body.action]
    receipt = {"receipt_id": new_id("rcp"), "key": key, **payload, "email": sess["email"], "verified_at": sess["verified_at"],
               "at": now_iso(), "version": q["number"], "total_cents": q["snapshot"]["price_cents"], "policy": "quote-acceptance-1"}
    r = await db.quotes.find_one_and_update(
        {"quote_id": q["quote_id"], "state": {"$in": allowed}, "digest": body.digest, "snapshot.valid_until": {"$gt": now().isoformat()[:16]}},
        {"$set": {"state": new_state, f"{new_state}_at": receipt["at"]}, "$push": {"responses": receipt}}, return_document=ReturnDocument.AFTER)
    if not r:
        cur = await by_token(token)
        dup = next((x for x in cur.get("responses") or [] if x["key"] == key), None)
        if dup:
            return {"receipt": dup, "state": cur["state"]}
        raise HTTPException(409, f"This quote can no longer take that response: it is {cur['state'].replace('_', ' ')}.")
    await log_event(q["project_id"], {"name": payload["signer_name"], "_kind": "customer"}, "quote",
                    f"Customer {body.action.replace('_', ' ')} quote {q['number']} ({sess['email']}).")
    return {"receipt": receipt, "state": new_state}
