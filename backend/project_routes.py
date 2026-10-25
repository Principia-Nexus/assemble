import copy
import secrets
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

import logic as L
import mailer
from core import db, now_iso, new_id, current_user, log_event, STALE_MSG, PROJECT_CTX
from demo import reset_project
from state import partner_statuses, link_public
from billing_routes import require_pilot

router = APIRouter(prefix="/api/project")
projects_router = APIRouter(prefix="/api/projects")


class CreateIn(BaseModel):
    name: str
    customer: Optional[str] = None
    request_key: Optional[str] = None


class RevIn(BaseModel):
    rev: int
    expected_version_id: Optional[str] = None


class IntakeIn(BaseModel):
    rev: int
    intake: Dict[str, Any]


class DraftIn(BaseModel):
    rev: int
    partner_ids: List[str]
    include_own: bool = True


class PreviewIn(BaseModel):
    rev: int
    change_request_id: Optional[str] = None


class SiteEdit(BaseModel):
    site_id: str
    owner: Optional[str] = None
    week: Optional[Any] = None
    deadline_week: Optional[Any] = None


class PreviewEditIn(BaseModel):
    rev: int
    sites: List[SiteEdit]
    adjustments: Dict[str, Optional[str]] = {}


class LinkIn(BaseModel):
    partner_id: str


class MoveIn(BaseModel):
    site_id: str
    new_week: Any


class CustomerChangeIn(BaseModel):
    note: str
    moves: List[MoveIn]


async def get_project(user, required=True):
    if not user.get("firm_id"):
        raise HTTPException(403, "This account is a partner account with no organizer firm. Open the review links shared with you.")
    await require_pilot(user)
    q, pid = {"firm_id": user["firm_id"]}, PROJECT_CTX.get()
    if pid:
        q["project_id"] = pid
    p = await db.projects.find_one(q, {"_id": 0}, sort=[("position", 1), ("created_at", 1)])
    if pid and not p:
        raise HTTPException(404, "Project not found for your business.")
    if required and not p:
        raise HTTPException(404, "No job yet. Create one to start.")
    return p


async def claim_rev(p, rev, fields=None):
    upd = {"$inc": {"rev": 1}}
    if fields:
        upd["$set"] = fields
    r = await db.projects.update_one({"project_id": p["project_id"], "rev": rev}, upd)
    if r.matched_count == 0:
        raise HTTPException(409, STALE_MSG)


async def next_number(project_id):
    r = await db.projects.find_one_and_update({"project_id": project_id}, {"$inc": {"version_counter": 1}},
                                              return_document=ReturnDocument.AFTER)
    return r["version_counter"]


async def get_version(vid):
    return await db.versions.find_one({"version_id": vid}, {"_id": 0}) if vid else None


def bad(errors):
    raise HTTPException(422, errors if isinstance(errors, list) else [errors])


async def sheet(project_id):
    p = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    cur, pre = await get_version(p.get("current_version_id")), await get_version(p.get("preview_version_id"))
    out = {"project": {k: p.get(k) for k in ("project_id", "name", "rev", "synthetic", "sandbox_id", "created_at",
                                             "fixture_id", "example_key")},
           "intake": p["intake"], "gap": L.gap_analysis(p["intake"]), "current": None, "preview": None}
    jc = p["intake"].get("job_conditions") or []
    if cur:
        out["current"] = {"version": cur, "checker": L.check({**cur, "job_conditions": jc}),
                          "partners": await partner_statuses(p, cur)}
    if pre:
        d = L.diff(cur, pre) if cur else None
        if d:
            st = {x["partner_id"]: x["status"] for x in out["current"]["partners"]}
            for x in d["partners"]:
                x["current_status"] = st.get(x["partner_id"])
        out["preview"] = {"version": pre, "checker": L.check({**pre, "job_conditions": jc}), "diff": d}
    out["links_count"] = await db.links.count_documents({"project_id": project_id})
    out["change_requests"] = await db.change_requests.find({"project_id": project_id}, {"_id": 0}).sort(
        "created_at", -1).to_list(100)
    return out


def org(user):
    return {**user, "_kind": "organizer"}


@router.get("")
async def read_project(user=Depends(current_user)):
    p = await get_project(user, required=False)
    return {"sheet": await sheet(p["project_id"]) if p else None}


async def project_status(p):
    cur = await get_version(p.get("current_version_id"))
    if cur and any(s["status"] in ("awaiting", "link_not_shared", "needs_rereview") for s in await partner_statuses(p, cur)):
        return "Awaiting partner review"
    if not p["intake"].get("sites") or L.gap_analysis(p["intake"])["unknowns"]:
        return "Needs information"
    return "Draft"


@projects_router.get("")
async def list_projects(user=Depends(current_user)):
    PROJECT_CTX.set(None)
    await get_project(user, required=False)
    rows = await db.projects.find({"firm_id": user["firm_id"]}, {"_id": 0}).sort([("position", 1), ("created_at", 1)]).to_list(200)
    return {"projects": [{"project_id": p["project_id"], "name": p["name"], "customer": p["intake"].get("customer_name"),
                          "synthetic": bool(p.get("synthetic")), "status": await project_status(p),
                          "updated_at": p.get("updated_at") or p["created_at"]} for p in rows]}


@projects_router.post("")
async def create_project(body: CreateIn, user=Depends(current_user)):
    PROJECT_CTX.set(None)
    await get_project(user, required=False)
    name, customer = body.name.strip(), (body.customer or "").strip() or None
    if not name or len(name) > 200:
        bad("Give the project a name (up to 200 characters).")
    if customer and len(customer) > 200:
        bad("Customer name is too long (up to 200 characters).")
    key = (body.request_key or "").strip()[:80] or None
    if key:
        dup = await db.projects.find_one({"firm_id": user["firm_id"], "create_key": key}, {"_id": 0, "project_id": 1})
        if dup:
            return {"project_id": dup["project_id"]}
    pid = new_id("prj")
    intake = {"job_name": name, "customer_name": customer, "scope_summary": None, "start_date": None, "weeks": None,
              "budget_ceiling_cents": None, "own_capacity": [], "own_cost_per_site_cents": None,
              "sites": [], "partners": [], "job_conditions": []}
    doc = {"project_id": pid, "firm_id": user["firm_id"], "sandbox_id": user.get("sandbox_id"), "synthetic": False,
           "name": name, "rev": 0, "version_counter": 0, "intake": intake, "current_version_id": None,
           "preview_version_id": None, "position": 1000, "created_at": now_iso(), "updated_at": now_iso()}
    if key:
        doc["create_key"] = key
    try:
        await db.projects.insert_one(doc)
    except DuplicateKeyError:
        dup = await db.projects.find_one({"firm_id": user["firm_id"], "create_key": key}, {"_id": 0, "project_id": 1})
        return {"project_id": dup["project_id"]}
    await log_event(pid, org(user), "project", f"Project created: {name}")
    return {"project_id": pid}


@router.post("")
async def create_project_compat(body: CreateIn, user=Depends(current_user)):
    r = await create_project(body, user)
    return {"project_id": r["project_id"], "sheet": await sheet(r["project_id"])}


@router.put("/intake")
async def save_intake(body: IntakeIn, user=Depends(current_user)):
    p = await get_project(user)
    it, errors = L.validate_intake(body.intake)
    if errors:
        bad(errors)
    await claim_rev(p, body.rev, {"intake": it, "name": it.get("job_name") or p["name"]})
    await log_event(p["project_id"], org(user), "intake",
                    f"Job details saved: {len(it['sites'])} sites, {len(it['partners'])} partners.")
    return {"sheet": await sheet(p["project_id"])}


def version_doc(p, base, number, state, origin, user, sites, partners, assignments, adjustments, notes=None, cr_id=None):
    return {"version_id": new_id("ver"), "project_id": p["project_id"], "number": number, "state": state,
            "origin": origin, "start_date": base.get("start_date"), "weeks": base.get("weeks"),
            "budget_ceiling_cents": base.get("budget_ceiling_cents"), "own_capacity": base.get("own_capacity") or [],
            "own_cost_per_site_cents": base.get("own_cost_per_site_cents"), "sites": sites, "partners": partners,
            "assignments": assignments, "adjustments": adjustments, "generator_notes": notes or [],
            "change_request_id": cr_id, "created_at": now_iso(), "created_by": user["name"]}


@router.post("/draft")
async def make_draft(body: DraftIn, user=Depends(current_user)):
    p = await get_project(user)
    it = p["intake"]
    errors = []
    if not it.get("weeks"):
        errors.append("Number of weeks is unknown. Add it in Check first.")
    if not it.get("sites"):
        errors.append("Add at least one site in Check first.")
    known = {x["partner_id"] for x in it["partners"]}
    if any(x not in known for x in body.partner_ids):
        errors.append("One of the chosen partners is no longer in the job details. Reload and choose again.")
    own_ok = body.include_own and any((c or 0) > 0 for c in it.get("own_capacity") or [])
    if not body.partner_ids and not own_ok:
        errors.append("Choose at least one crew to include in the draft.")
    if errors:
        bad(errors)
    await generate_candidate(p, user, body.partner_ids, body.include_own, body.rev)
    return {"sheet": await sheet(p["project_id"])}


async def generate_candidate(p, user, partner_ids, include_own, rev, reason=""):
    it = p["intake"]
    as_preview = await db.links.count_documents({"project_id": p["project_id"]}) > 0
    if as_preview and p.get("preview_version_id"):
        raise HTTPException(409, "Finish or discard the open amendment preview first.")
    assignments, notes = L.generate(it, partner_ids, include_own)
    vid_field = "preview_version_id" if as_preview else "current_version_id"
    doc = version_doc(p, it, 0, "preview" if as_preview else "current", "draft", user,
                      copy.deepcopy(it["sites"]), copy.deepcopy(it["partners"]), assignments, {}, notes)
    await claim_rev(p, rev, {vid_field: doc["version_id"]})
    doc["number"] = await next_number(p["project_id"])
    if not as_preview and p.get("current_version_id"):
        await db.versions.update_one({"version_id": p["current_version_id"]}, {"$set": {"state": "replaced"}})
    await db.versions.insert_one(doc)
    chk = L.check(doc)
    where = "as an amendment preview (partners already have links)" if as_preview else "as the current draft"
    await log_event(p["project_id"], org(user), "draft",
                    f"Candidate v{doc['number']} generated {where}{reason}. Checker: {chk['overall'].upper()}.",
                    details=[r["label"] + ": " + r["status"] for r in chk["rules"]])
    return doc


@router.post("/preview")
async def start_preview(body: PreviewIn, user=Depends(current_user)):
    p = await get_project(user)
    cur = await get_version(p.get("current_version_id"))
    if not cur:
        raise HTTPException(409, "Prepare a draft first.")
    if p.get("preview_version_id"):
        raise HTTPException(409, "An amendment preview is already open. Discard or select it first.")
    sites, assignments = copy.deepcopy(cur["sites"]), copy.deepcopy(cur["assignments"])
    adjustments = dict(cur.get("adjustments") or {})
    latest = {x["partner_id"]: x for x in p["intake"]["partners"]}
    partners = [latest.get(x["partner_id"], x) for x in cur["partners"]] + [
        x for x in p["intake"]["partners"] if x["partner_id"] not in {y["partner_id"] for y in cur["partners"]}]
    cr = None
    if body.change_request_id:
        cr = await db.change_requests.find_one({"cr_id": body.change_request_id, "project_id": p["project_id"]}, {"_id": 0})
        if not cr or cr["status"] != "open":
            raise HTTPException(409, "That change request is no longer open.")
        smap = {s["site_id"]: s for s in sites}
        for m in cr.get("moves") or []:
            if m["site_id"] in smap:
                smap[m["site_id"]]["deadline_week"] = m["new_week"]
                assignments.setdefault(m["site_id"], {})["week"] = m["new_week"]
        if cr.get("partner_id") and cr["partner_id"] not in L.partner_owners(cur):
            raise HTTPException(409, f"This request came from {cr['partner_name']}, who has no sites in the current plan "
                                     f"v{cur['number']}. It cannot change this plan; close it instead.")
        if cr.get("proposed_total_cents") is not None and cr.get("partner_id"):
            pid = cr["partner_id"]
            n = L.site_owner_counts({"sites": sites, "assignments": assignments}).get(pid, 0)
            per = next((x.get("price_per_site_cents") for x in partners if x["partner_id"] == pid), None)
            if per is None:
                bad(f"{cr['partner_name']} has no known price per site, so the proposed total cannot be applied.")
            adjustments[pid] = cr["proposed_total_cents"] - per * n
    doc = version_doc(p, cur, 0, "preview", "amendment", user, sites, partners, assignments, adjustments,
                      cr_id=body.change_request_id)
    await claim_rev(p, body.rev, {"preview_version_id": doc["version_id"]})
    doc["number"] = await next_number(p["project_id"])
    await db.versions.insert_one(doc)
    if cr:
        await db.change_requests.update_one({"cr_id": cr["cr_id"]}, {"$set": {"status": "in_preview"}})
    await log_event(p["project_id"], org(user), "preview",
                    f"Amendment preview v{doc['number']} opened" + (f" from change request: {cr['note']}" if cr else "") +
                    ". The current plan and its responses are unchanged until you select it.")
    return {"sheet": await sheet(p["project_id"])}


@router.put("/preview")
async def edit_preview(body: PreviewEditIn, user=Depends(current_user)):
    p = await get_project(user)
    pre = await get_version(p.get("preview_version_id"))
    if not pre:
        raise HTTPException(409, "There is no open amendment preview.")
    weeks, P = pre["weeks"], {x["partner_id"] for x in pre["partners"]}
    e = []
    smap = {s["site_id"]: s for s in pre["sites"]}
    sites, assignments = copy.deepcopy(pre["sites"]), {}
    by_id = {s["site_id"]: s for s in sites}
    for se in body.sites:
        if se.site_id not in smap:
            e.append(f"{se.site_id}: not a site in this preview.")
            continue
        if se.owner != L.OWN and se.owner not in P:
            e.append(f"{se.site_id}: choose a scope owner.")
        w = L.whole(se.week, f"{se.site_id} week", e, 1, weeks)
        if w is None and L.blank(se.week):
            e.append(f"{se.site_id}: week is required.")
        if "deadline_week" in se.model_fields_set:
            by_id[se.site_id]["deadline_week"] = L.whole(se.deadline_week, f"{se.site_id} deadline week", e, 1, weeks)
        assignments[se.site_id] = {"owner": se.owner, "week": w}
    missing = set(smap) - set(assignments)
    if missing:
        e.append(f"Every site must be included in the edit ({', '.join(sorted(missing))} missing).")
    adjustments = {}
    for pid, val in body.adjustments.items():
        if pid not in P:
            e.append(f"Unknown partner {pid} in price adjustments.")
            continue
        name = L.owner_name(pre, pid)
        c = L.money(val, f"Price adjustment for {name}", e, signed=True)
        if c:
            adjustments[pid] = c
    trial = {**pre, "sites": sites, "assignments": assignments, "adjustments": adjustments}
    for pid, c in adjustments.items():
        t = L.partner_terms(trial, pid)
        if t["price_total_cents"] is not None and t["price_total_cents"] < 0:
            e.append(f"Price adjustment for {t['partner_name']}: {L.fmt(c)} would make their total "
                     f"{L.fmt(t['price_total_cents'])}. The largest discount allowed is {L.fmt(t['price_total_cents'] - c)}.")
    if e:
        bad(e)
    await claim_rev(p, body.rev)
    await db.versions.update_one({"version_id": pre["version_id"], "state": "preview"},
                                 {"$set": {"sites": sites, "assignments": assignments, "adjustments": adjustments}})
    new = {**pre, "sites": sites, "assignments": assignments, "adjustments": adjustments}
    await log_event(p["project_id"], org(user), "preview",
                    f"Amendment preview v{pre['number']} edited. Checker: {L.check(new)['overall'].upper()}.")
    return {"sheet": await sheet(p["project_id"])}


@router.post("/preview/discard")
async def discard_preview(body: RevIn, user=Depends(current_user)):
    p = await get_project(user)
    pre = await get_version(p.get("preview_version_id"))
    if p["rev"] != body.rev:
        raise HTTPException(409, STALE_MSG)
    if not pre:
        raise HTTPException(409, "There is no open amendment preview.")
    await claim_rev(p, body.rev, {"preview_version_id": None})
    await db.versions.update_one({"version_id": pre["version_id"]}, {"$set": {"state": "discarded"}})
    if pre.get("change_request_id"):
        await db.change_requests.update_one({"cr_id": pre["change_request_id"], "status": "in_preview"},
                                            {"$set": {"status": "open"}})
    await log_event(p["project_id"], org(user), "preview",
                    f"Amendment preview v{pre['number']} discarded. The current plan and every valid earlier consent are kept.")
    return {"sheet": await sheet(p["project_id"])}


@router.post("/preview/select")
async def select_preview(body: RevIn, user=Depends(current_user)):
    p = await get_project(user)
    cur, pre = await get_version(p.get("current_version_id")), await get_version(p.get("preview_version_id"))
    if not pre or not cur:
        raise HTTPException(409, "There is no open amendment preview to select.")
    if body.expected_version_id and body.expected_version_id != pre["version_id"]:
        raise HTTPException(409, "The preview changed since you checked it. Review it again before selecting.")
    if L.check(pre)["overall"] == "fail":
        raise HTTPException(409, f"Preview v{pre['number']} fails a check. Repair it and recheck before selecting it.")
    await claim_rev(p, body.rev, {"current_version_id": pre["version_id"], "preview_version_id": None})
    await db.versions.update_one({"version_id": cur["version_id"]}, {"$set": {"state": "superseded"}})
    await db.versions.update_one({"version_id": pre["version_id"]}, {"$set": {"state": "current"}})
    carried, review = [], []
    old_owners = L.partner_owners(cur)
    for pid in sorted(L.partner_owners(pre), key=lambda x: L.owner_name(pre, x)):
        tn = L.partner_terms(pre, pid)
        if pid in old_owners and L.terms_hash(L.partner_terms(cur, pid)) == L.terms_hash(tn) and not L.is_expired(tn):
            resp = await db.responses.find_one({"project_id": p["project_id"], "version_id": cur["version_id"],
                                                "partner_id": pid}, {"_id": 0}, sort=[("created_at", -1)])
            if resp:
                await db.responses.insert_one({**resp, "response_id": new_id("rsp"), "version_id": pre["version_id"],
                                               "version_number": pre["number"], "carried_from": resp["response_id"],
                                               "responded_at": resp.get("responded_at") or resp["created_at"],
                                               "idempotency_key": f"carry:{resp['response_id']}:{pre['version_id']}",
                                               "created_at": now_iso()})
                carried.append(tn["partner_name"])
                continue
        review.append(tn["partner_name"])
    if pre.get("change_request_id"):
        await db.change_requests.update_one({"cr_id": pre["change_request_id"]}, {"$set": {"status": "applied"}})
    details = [f"Response carried over unchanged: {n}" for n in carried] + [f"Must review again: {n}" for n in review]
    await log_event(p["project_id"], org(user), "select",
                    f"Revised terms v{pre['number']} selected; v{cur['number']} and its responses are kept as history.",
                    details=details)
    return {"sheet": await sheet(p["project_id"])}


@router.post("/links")
async def create_link(body: LinkIn, user=Depends(current_user)):
    p = await get_project(user)
    cur = await get_version(p.get("current_version_id"))
    if not cur:
        raise HTTPException(409, "Prepare a draft first.")
    if body.partner_id not in L.partner_owners(cur):
        raise HTTPException(400, "This partner has no sites in the current plan.")
    if L.check(cur)["overall"] == "fail":
        raise HTTPException(409, f"Plan v{cur['number']} fails a check. Repair the draft before asking partners to confirm it.")
    partner = next((x for x in p["intake"]["partners"] if x["partner_id"] == body.partner_id), None) or \
        next(x for x in cur["partners"] if x["partner_id"] == body.partner_id)
    if not partner.get("email"):
        bad(f"Add a contact email for {partner['name']} in Check first. The link only opens for that email.")
    existing = await db.links.find_one({"project_id": p["project_id"], "partner_id": body.partner_id, "revoked": False},
                                       {"_id": 0})
    if existing:
        return {"link": link_public(existing), "sheet": await sheet(p["project_id"])}
    link = {"token": secrets.token_urlsafe(24), "project_id": p["project_id"], "partner_id": body.partner_id,
            "partner_name": partner["name"], "invite_email": partner["email"].lower(), "created_at": now_iso(),
            "created_by": user["name"], "shared_at": None, "claimed_by": None, "revoked": False}
    await db.links.insert_one(link)
    await log_event(p["project_id"], org(user), "link",
                    f"Private review link created for {partner['name']} ({partner['email']}). Not sent: share it yourself.",
                    partner_id=body.partner_id)
    return {"link": link_public(link), "sheet": await sheet(p["project_id"])}


@router.post("/links/{token}/shared")
async def mark_shared(token: str, user=Depends(current_user)):
    p = await get_project(user)
    link = await db.links.find_one({"token": token, "project_id": p["project_id"]}, {"_id": 0})
    if not link:
        raise HTTPException(404, "Link not found.")
    if not link.get("shared_at"):
        await db.links.update_one({"token": token}, {"$set": {"shared_at": now_iso()}})
        await log_event(p["project_id"], org(user), "link", f"Marked as shared with {link['partner_name']} by the organizer.",
                        partner_id=link["partner_id"])
    return {"sheet": await sheet(p["project_id"])}


async def _invite(token, user, request):
    p = await get_project(user)
    link = await db.links.find_one({"token": token, "project_id": p["project_id"], "revoked": False}, {"_id": 0})
    if not link:
        raise HTTPException(404, "Link not found.")
    cur = await get_version(p.get("current_version_id"))
    firm = await db.firms.find_one({"firm_id": p["firm_id"]}, {"_id": 0, "name": 1})
    origin = (request.headers.get("origin") or "").rstrip("/")
    subject, text, html = mailer.invitation((firm or {}).get("name") or user.get("firm_name"), p["intake"].get("job_name") or p["name"],
                                            link["partner_name"], (cur or {}).get("number"), f"{origin}/review/{token}")
    return p, link, subject, text, html


@router.post("/links/{token}/email-preview")
async def email_preview(token: str, request: Request, user=Depends(current_user)):
    _, link, subject, text, _ = await _invite(token, user, request)
    ok = mailer.sendable(link["invite_email"])
    return {"to": link["invite_email"], "subject": subject, "text": text, "sendable": ok, "emailed_at": link.get("emailed_at"),
            "reason": None if ok else "This is a synthetic example address, so no email is sent. Copy the link instead."}


@router.post("/links/{token}/email-send")
async def email_send(token: str, request: Request, user=Depends(current_user)):
    p, link, subject, _, html = await _invite(token, user, request)
    if not mailer.sendable(link["invite_email"]):
        raise HTTPException(400, "This is a synthetic example address, so no email is sent. Copy the link instead.")
    if not request.headers.get("origin"):
        raise HTTPException(400, "Send the invitation from the app.")
    email_id = await mailer.send_email(to=link["invite_email"], subject=subject, html=html)
    await db.links.update_one({"token": token}, {"$set": {"emailed_at": now_iso(), "email_id": email_id,
                                                          "shared_at": link.get("shared_at") or now_iso()}})
    await log_event(p["project_id"], org(user), "link", f"Review invitation emailed to {link['invite_email']} for {link['partner_name']}.",
                    partner_id=link["partner_id"])
    return {"sheet": await sheet(p["project_id"])}


@router.post("/change-requests")
async def log_customer_change(body: CustomerChangeIn, user=Depends(current_user)):
    p = await get_project(user)
    cur = await get_version(p.get("current_version_id"))
    if not cur:
        raise HTTPException(409, "Prepare a draft first.")
    e = []
    note = L.text(body.note, "Request description", e, 1000)
    if not note:
        e.append("Describe the requested change.")
    ids = {s["site_id"] for s in cur["sites"]}
    moves = []
    for m in body.moves:
        if m.site_id not in ids:
            e.append(f"{m.site_id}: not a site in the current plan.")
        w = L.whole(m.new_week, f"{m.site_id} new week", e, 1, cur["weeks"])
        if w is None and L.blank(m.new_week):
            e.append(f"{m.site_id}: choose the requested week.")
        moves.append({"site_id": m.site_id, "new_week": w})
    if not moves:
        e.append("Add at least one site to move.")
    if e:
        bad(e)
    cr = {"cr_id": new_id("cr"), "project_id": p["project_id"], "source": "customer", "partner_id": None,
          "partner_name": None, "version_id": cur["version_id"], "version_number": cur["number"], "note": note,
          "moves": moves, "proposed_total_cents": None, "status": "open", "created_at": now_iso(),
          "created_by": user["name"]}
    await db.change_requests.insert_one(cr)
    await log_event(p["project_id"], org(user), "change_request",
                    f"Customer change request logged: {note}. Saved apart from the current plan.",
                    details=[f"{m['site_id']} → week {m['new_week']}" for m in moves])
    return {"sheet": await sheet(p["project_id"])}


@router.post("/change-requests/{cr_id}/close")
async def close_change(cr_id: str, user=Depends(current_user)):
    p = await get_project(user)
    r = await db.change_requests.update_one({"cr_id": cr_id, "project_id": p["project_id"], "status": "open"},
                                            {"$set": {"status": "closed"}})
    if r.matched_count == 0:
        raise HTTPException(409, "That change request is not open.")
    await log_event(p["project_id"], org(user), "change_request", "Change request closed without an amendment.")
    return {"sheet": await sheet(p["project_id"])}


@router.get("/history")
async def history(user=Depends(current_user)):
    p = await get_project(user)
    events = await db.events.find({"project_id": p["project_id"]}, {"_id": 0}).sort("at", -1).to_list(500)
    versions = await db.versions.find({"project_id": p["project_id"]},
                                      {"_id": 0, "version_id": 1, "number": 1, "state": 1, "origin": 1, "created_at": 1}
                                      ).sort("number", -1).to_list(200)
    responses = await db.responses.find({"project_id": p["project_id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return {"events": events, "versions": versions, "responses": responses}


@router.post("/demo-reset")
async def demo_reset(user=Depends(current_user)):
    if not user.get("sandbox_id") or user.get("demo_key") != "organizer":
        raise HTTPException(403, "Only the demo organizer can reset a demo copy.")
    p = await get_project(user)
    if not p.get("synthetic") or p.get("sandbox_id") != user["sandbox_id"]:
        raise HTTPException(400, "Only a synthetic example can be reset.")
    await reset_project(p, user)
    return {"sheet": await sheet(p["project_id"])}
