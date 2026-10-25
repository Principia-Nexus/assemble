"""Requirements, firm licence evidence, exclusions and the explicit Select plan step."""
import re
from typing import List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import logic as L
import qualify as Q
from core import db, now_iso, new_id, current_user, log_event
from project_routes import get_project, get_version, sheet, org, bad, claim_rev

router = APIRouter(prefix="/api/project")


class ReqIn(BaseModel):
    code: str
    label: Optional[str] = None
    sites: Union[str, List[str]] = "all"
    origin: str = "organizer"
    source: Optional[dict] = None


class DismissIn(BaseModel):
    reason: str


class EvidenceIn(BaseModel):
    partner_id: str
    license_class: str
    license_number: Optional[str] = None
    expires: Optional[str] = None
    source_id: Optional[str] = None
    note: Optional[str] = None
    entity_name: Optional[str] = None
    source_record: Optional[str] = None
    observed_status: Optional[str] = None
    observed_on: Optional[str] = None


class ExclusionIn(BaseModel):
    text: str
    level: str = "job"
    target: Optional[str] = None


class SelectIn(BaseModel):
    rev: int


def _owners(p):
    return {x["partner_id"] for x in p["intake"]["partners"]} | {L.OWN}


async def source_labels(pid):
    return [s["label"] for s in await db.sources.find({"project_id": pid}, {"_id": 0, "label": 1}).to_list(50)]


async def _store_req(p, user, r):
    await db.projects.update_one({"project_id": p["project_id"]}, {"$pull": {"requirements": {"req_id": r["req_id"]}}})
    await db.projects.update_one({"project_id": p["project_id"]}, {"$push": {"requirements": r}, "$inc": {"rev": 1}})


@router.post("/requirements")
async def add_requirement(body: ReqIn, user=Depends(current_user)):
    p = await get_project(user)
    code = body.code.strip().upper()[:20]
    if not code:
        bad("Name the requirement, for example C-10.")
    if body.origin not in ("organizer", "document"):
        bad("Requirements are added by the organizer or from a cited document.")
    if body.origin == "document" and not (body.source or {}).get("label"):
        bad("A document requirement needs its source.")
    known = {c["code"]: c["label"] for c in Q.RULES["classes"]} | {"B": Q.RULES["general"]["label"]}
    sites = body.sites if body.sites == "all" else [s for s in body.sites if s in {x["site_id"] for x in p["intake"]["sites"]}]
    r = {"req_id": new_id("req"), "code": code, "label": (body.label or known.get(code) or code)[:120], "sites": sites or "all",
         "origin": body.origin, "status": "required", "source": body.source or {"label": f"Added by {user['name']}"},
         "added_by": user["name"], "added_at": now_iso()}
    await _store_req(p, user, r)
    await log_event(p["project_id"], org(user), "requirement", f"Requirement {r['label']} added ({r['origin']}).")
    return {"sheet": await sheet(p["project_id"])}


async def _find_req(p, req_id):
    r = next((x for x in Q.requirements(p, await source_labels(p["project_id"])) if x["req_id"] == req_id), None)
    if not r:
        raise HTTPException(404, "That requirement is not in this project.")
    return r


@router.post("/requirements/{req_id}/confirm")
async def confirm_requirement(req_id: str, user=Depends(current_user)):
    p = await get_project(user)
    r = await _find_req(p, req_id)
    if r["status"] != "suggested":
        bad("Only a suggested requirement needs review.")
    await _store_req(p, user, {**r, "status": "confirmed", "reviewed_by": user["name"], "reviewed_at": now_iso()})
    await log_event(p["project_id"], org(user), "requirement", f"Requirement {r['label']} confirmed (review recorded, not legal eligibility).")
    return {"sheet": await sheet(p["project_id"])}


@router.post("/requirements/{req_id}/dismiss")
async def dismiss_requirement(req_id: str, body: DismissIn, user=Depends(current_user)):
    p = await get_project(user)
    r = await _find_req(p, req_id)
    reason = body.reason.strip()[:500]
    if len(reason) < 5:
        bad("Say why this requirement does not apply.")
    if r["origin"] == "document" or (r["status"] == "required" and r["origin"] != "organizer"):
        bad("A requirement set by a project document cannot be dismissed. Correct the source instead.")
    await _store_req(p, user, {**r, "status": "dismissed", "dismiss_reason": reason, "reviewed_by": user["name"], "reviewed_at": now_iso()})
    await log_event(p["project_id"], org(user), "requirement", f"Requirement {r['label']} dismissed: {reason}")
    return {"sheet": await sheet(p["project_id"])}


@router.post("/evidence")
async def add_evidence(body: EvidenceIn, user=Depends(current_user)):
    p = await get_project(user)
    if body.partner_id not in _owners(p):
        bad("Choose a firm in this project.")
    e = []
    exp = L.iso_date(body.expires, "Expiry date", e) if body.expires else None
    seen = L.iso_date(body.observed_on, "Observed on", e) if body.observed_on else None
    if body.observed_status and body.observed_status not in ("active", "expired", "suspended", "inactive", "revoked"):
        e.append("Observed status must be active, expired, suspended, inactive or revoked.")
    if body.observed_status and not seen:
        e.append("Record the date you observed that status.")
    if body.observed_status and not (body.source_record or "").strip():
        e.append("Name the source record you reviewed, e.g. 'CSLB licence detail page, screenshot'.")
    if e:
        bad(e)
    fname = "Your firm" if body.partner_id == L.OWN else next(x["name"] for x in p["intake"]["partners"] if x["partner_id"] == body.partner_id)
    ent = (body.entity_name or "").strip()[:120] or None
    norm = lambda s: re.sub(r"[^a-z0-9]", "", re.sub(r"\(synthetic\)|\b(inc|llc|co|corp|company)\b", "", s.lower()))  # noqa: E731
    match = None if not ent or body.partner_id == L.OWN else (norm(ent) in norm(fname) or norm(fname) in norm(ent))
    cls = body.license_class.strip().upper()[:20]
    if not cls:
        bad("Enter the licence class shown on the evidence, for example C-10.")
    ev = {"ev_id": new_id("ev"), "partner_id": body.partner_id, "license_class": cls, "license_number": (body.license_number or "").strip()[:40] or None,
          "expires": exp, "source_id": body.source_id, "note": (body.note or "").strip()[:300] or None,
          "reviewed_by": user["name"], "reviewed_at": now_iso(), "kind": "organizer_reviewed", "entity_name": ent, "entity_match": match,
          "source_record": (body.source_record or "").strip()[:200] or None, "observed_status": body.observed_status, "observed_on": seen, "revision": 1}
    await db.projects.update_one({"project_id": p["project_id"]}, {"$push": {"evidence": ev}, "$inc": {"rev": 1}})
    await log_event(p["project_id"], org(user), "evidence", f"Licence evidence {cls} reviewed by {user['name']} for {L.owner_name({'partners': p['intake']['partners']}, body.partner_id)}.")
    return {"sheet": await sheet(p["project_id"])}


@router.delete("/evidence/{ev_id}")
async def remove_evidence(ev_id: str, user=Depends(current_user)):
    p = await get_project(user)
    await db.projects.update_one({"project_id": p["project_id"]}, {"$pull": {"evidence": {"ev_id": ev_id}}, "$inc": {"rev": 1}})
    return {"sheet": await sheet(p["project_id"])}


@router.post("/exclusions")
async def add_exclusion(body: ExclusionIn, user=Depends(current_user)):
    p = await get_project(user)
    t = body.text.strip()[:500]
    if not t:
        bad("Describe what is excluded.")
    if body.level not in ("job", "scope", "firm"):
        bad("Exclusions apply to the job, a scope or a firm.")
    if body.level == "scope" and body.target not in {s["site_id"] for s in p["intake"]["sites"]}:
        bad("Choose the scope this exclusion applies to.")
    if body.level == "firm" and body.target not in _owners(p):
        bad("Choose the firm this exclusion applies to.")
    x = {"ex_id": new_id("ex"), "text": t, "level": body.level, "target": body.target if body.level != "job" else None,
         "added_by": user["name"], "added_at": now_iso()}
    await db.projects.update_one({"project_id": p["project_id"]}, {"$push": {"exclusions": x}, "$inc": {"rev": 1}})
    return {"sheet": await sheet(p["project_id"])}


@router.delete("/exclusions/{ex_id}")
async def remove_exclusion(ex_id: str, user=Depends(current_user)):
    p = await get_project(user)
    await db.projects.update_one({"project_id": p["project_id"]}, {"$pull": {"exclusions": {"ex_id": ex_id}}, "$inc": {"rev": 1}})
    return {"sheet": await sheet(p["project_id"])}


async def selection_block(p, v):
    reqs = Q.requirements(p, await source_labels(p["project_id"]))
    a = Q.assess(v, p, reqs)
    bad_sites = sorted(k for k, x in a["sites"].items() if x["status"] == "does_not_fit")
    if bad_sites:
        return f"{', '.join(bad_sites)}: the assigned firm does not fit a requirement. Reassign or leave open before selecting."
    if L.check(v)["overall"] == "fail":
        return f"Plan v{v['number']} fails a check. Repair it before selecting."
    return None


@router.post("/plan/select")
async def select_plan(body: SelectIn, user=Depends(current_user)):
    p = await get_project(user)
    cur = await get_version(p.get("current_version_id"))
    if not cur:
        raise HTTPException(409, "No plan yet. Use Draft plan.")
    if p.get("plan_selected", True):
        bad("This plan is already selected.")
    why = await selection_block(p, cur)
    if why:
        raise HTTPException(409, why)
    await claim_rev(p, body.rev, {"plan_selected": True})
    await log_event(p["project_id"], org(user), "select", f"Plan v{cur['number']} selected for partner review.")
    return {"sheet": await sheet(p["project_id"])}
