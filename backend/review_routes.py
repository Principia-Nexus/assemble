from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.errors import DuplicateKeyError

import logic as L
from core import db, now_iso, new_id, current_user, log_event
from state import status_for, active_links

router = APIRouter(prefix="/api")
FORWARD_MSG = ("This review link was issued to a different firm contact. A forwarded link gives no access. "
               "Sign in with the email address the organizer invited.")


class RespondIn(BaseModel):
    version_id: str
    terms_hash: str
    action: str
    conditions: Optional[str] = None
    note: Optional[str] = None
    proposed_total: Optional[str] = None
    idempotency_key: str


def has_access(user, link):
    return any(a.get("project_id") == link["project_id"] and a.get("partner_id") == link["partner_id"]
               for a in user.get("partner_access") or [])


async def access_link(token, user, allow_claim):
    link = await db.links.find_one({"token": token, "revoked": False}, {"_id": 0})
    if not link:
        raise HTTPException(404, "This review link is not valid or has been replaced.")
    p = await db.projects.find_one({"project_id": link["project_id"]}, {"_id": 0})
    if not p or p.get("sandbox_id") != user.get("sandbox_id"):
        raise HTTPException(403, FORWARD_MSG)
    if has_access(user, link):
        return link, p
    email_ok = (user.get("email") or "").lower() == link["invite_email"]
    if not (allow_claim and email_ok and link.get("claimed_by") in (None, user["user_id"])):
        raise HTTPException(403, FORWARD_MSG)
    await db.users.update_one({"user_id": user["user_id"]},
                              {"$addToSet": {"partner_access": {"project_id": p["project_id"], "partner_id": link["partner_id"]}}})
    await db.links.update_one({"token": token, "claimed_by": None}, {"$set": {"claimed_by": user["user_id"], "claimed_at": now_iso()}})
    await log_event(p["project_id"], {**user, "_kind": "partner"}, "link",
                    f"{link['partner_name']} signed in as {user['email']} and opened their review link.",
                    partner_id=link["partner_id"])
    return link, p


async def review_payload(token, link, p):
    v = await db.versions.find_one({"version_id": p.get("current_version_id")}, {"_id": 0})
    pid = link["partner_id"]
    firm = await db.firms.find_one({"firm_id": p["firm_id"]}, {"_id": 0, "name": 1})
    it = p["intake"]
    out = {"token": token, "partner": {"partner_id": pid, "name": link["partner_name"]},
           "job": {"job_name": it.get("job_name"), "customer_name": it.get("customer_name"),
                   "scope_summary": it.get("scope_summary"), "synthetic": p.get("synthetic"),
                   "organizer_firm": (firm or {}).get("name")},
           "version": None, "terms": None, "status": "removed"}
    if v and pid in L.partner_owners(v):
        links = await active_links(p["project_id"])
        st = await status_for(p, v, pid, links.get(pid))
        out.update({"version": {"version_id": v["version_id"], "number": v["number"], "created_at": v["created_at"]},
                    "terms": st["terms"], "terms_hash": st["terms_hash"], "status": st["status"],
                    "expired": st["expired"]})
        out["shared_conditions"] = [{"text": c["text"], "source": c.get("source"), "resolved": bool(c.get("resolved"))}
                                    for c in it.get("job_conditions") or []]
    out["responses"] = await db.responses.find({"project_id": p["project_id"], "partner_id": pid},
                                               {"_id": 0, "user_id": 0, "idempotency_key": 0}
                                               ).sort("created_at", -1).to_list(100)
    return out


@router.get("/review/{token}")
async def read_review(token: str, user=Depends(current_user)):
    link, p = await access_link(token, user, allow_claim=True)
    return await review_payload(token, link, p)


@router.post("/review/{token}/respond")
async def respond(token: str, body: RespondIn, user=Depends(current_user)):
    link, p = await access_link(token, user, allow_claim=False)
    pid = link["partner_id"]
    if body.action not in ("confirm", "request_change", "decline"):
        raise HTTPException(422, ["Choose Confirm, Request a change, or Decline."])
    if not 8 <= len(body.idempotency_key) <= 80:
        raise HTTPException(422, ["Invalid submission key. Reload and try again."])
    dup = await db.responses.find_one({"project_id": p["project_id"], "partner_id": pid,
                                       "idempotency_key": body.idempotency_key}, {"_id": 0})
    if dup:
        return {"duplicate": True, "review": await review_payload(token, link, p)}
    if p.get("current_version_id") != body.version_id:
        raise HTTPException(409, "These terms were replaced by a newer version. Reload to review the current terms.")
    v = await db.versions.find_one({"version_id": body.version_id}, {"_id": 0})
    if pid not in L.partner_owners(v):
        raise HTTPException(409, "You have no sites in the current plan.")
    t = L.partner_terms(v, pid)
    if L.terms_hash(t) != body.terms_hash:
        raise HTTPException(409, "These terms changed since you opened them. Reload to review the current terms.")
    if L.is_expired(t):
        raise HTTPException(409, f"These terms passed their validity date ({t['valid_until']}). Ask the organizer to recheck.")
    e = []
    note = L.text(body.note, "Note", e, 1000)
    conditions = L.text(body.conditions, "Conditions", e, 1000) if body.action == "confirm" else None
    proposed = L.money(body.proposed_total, "Proposed total", e) if body.action == "request_change" else None
    if body.action == "request_change" and not note:
        e.append("Describe the change you need.")
    if e:
        raise HTTPException(422, e)
    doc = {"response_id": new_id("rsp"), "project_id": p["project_id"], "version_id": v["version_id"],
           "version_number": v["number"], "partner_id": pid, "partner_name": link["partner_name"],
           "terms_hash": body.terms_hash, "action": body.action, "conditions": conditions, "note": note,
           "proposed_total_cents": proposed, "user_id": user["user_id"], "user_name": user["name"],
           "user_email": user["email"], "created_at": now_iso(), "idempotency_key": body.idempotency_key,
           "carried_from": None}
    try:
        await db.responses.insert_one(doc)
    except DuplicateKeyError:
        return {"duplicate": True, "review": await review_payload(token, link, p)}
    labels = {"confirm": "confirmed the proposed terms" + (" with conditions" if conditions else ""),
              "request_change": "requested a change", "decline": "declined"}
    if body.action == "request_change":
        await db.change_requests.insert_one({
            "cr_id": new_id("cr"), "project_id": p["project_id"], "source": "partner", "partner_id": pid,
            "partner_name": link["partner_name"], "version_id": v["version_id"], "version_number": v["number"],
            "note": note, "moves": [], "proposed_total_cents": proposed, "status": "open", "created_at": now_iso(),
            "created_by": user["name"], "response_id": doc["response_id"]})
    details = [x for x in [f"Conditions: {conditions}" if conditions else None, f"Note: {note}" if note else None,
                           f"Proposed total: {L.fmt(proposed)}" if proposed is not None else None] if x]
    await log_event(p["project_id"], {**user, "_kind": "partner"}, "response",
                    f"{link['partner_name']} {labels[body.action]} on v{v['number']}.", partner_id=pid, details=details)
    return {"duplicate": False, "review": await review_payload(token, link, p)}


@router.get("/my-reviews")
async def my_reviews(user=Depends(current_user)):
    access = user.get("partner_access") or []
    q = [{"project_id": a["project_id"], "partner_id": a["partner_id"]} for a in access]
    if user.get("email_verified"):
        q.append({"invite_email": (user.get("email") or "").lower()})
    if not q:
        return {"reviews": []}
    out = []
    async for link in db.links.find({"$or": q, "revoked": False}, {"_id": 0}):
        p = await db.projects.find_one({"project_id": link["project_id"]}, {"_id": 0})
        if not p or p.get("sandbox_id") != user.get("sandbox_id"):
            continue
        v = await db.versions.find_one({"version_id": p.get("current_version_id")}, {"_id": 0})
        status = "removed"
        if v and link["partner_id"] in L.partner_owners(v):
            status = (await status_for(p, v, link["partner_id"], link))["status"]
        out.append({"token": link["token"], "path": f"/review/{link['token']}", "partner_name": link["partner_name"],
                    "job_name": p["intake"].get("job_name"), "synthetic": p.get("synthetic"), "status": status})
    return {"reviews": out}
