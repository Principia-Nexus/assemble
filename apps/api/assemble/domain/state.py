from assemble.core import db
from assemble.domain import logic as L


def link_public(link):
    if not link:
        return None
    return {"token": link["token"], "path": f"/review/{link['token']}", "invite_email": link["invite_email"],
            "created_at": link["created_at"], "shared_at": link.get("shared_at"), "emailed_at": link.get("emailed_at"), "claimed": bool(link.get("claimed_by"))}


async def latest_response(project_id, version_id, pid):
    return await db.responses.find_one({"project_id": project_id, "version_id": version_id, "partner_id": pid},
                                       {"_id": 0}, sort=[("created_at", -1)])


async def status_for(p, v, pid, link):
    t = L.partner_terms(v, pid)
    resp = await latest_response(p["project_id"], v["version_id"], pid)
    expired = L.is_expired(t)
    prior = await db.responses.count_documents({"project_id": p["project_id"], "partner_id": pid,
                                                "version_id": {"$ne": v["version_id"]}})
    if resp:
        s = {"confirm": "confirmed_conditional" if resp.get("conditions") else "confirmed",
             "request_change": "change_requested", "decline": "declined"}[resp["action"]]
        if expired and resp["action"] == "confirm":
            s = "expired"
    elif expired:
        s = "expired"
    elif not link:
        s = "no_link"
    elif prior:
        s = "needs_rereview"
    elif not link.get("shared_at"):
        s = "link_not_shared"
    else:
        s = "awaiting"
    return {"partner_id": pid, "name": t["partner_name"], "status": s, "terms": t, "terms_hash": L.terms_hash(t),
            "response": resp, "link": link_public(link), "expired": expired, "for_version": v.get("number")}


async def active_links(project_id):
    return {lk["partner_id"]: lk async for lk in db.links.find({"project_id": project_id, "revoked": False}, {"_id": 0})}


async def partner_statuses(p, v):
    links = await active_links(p["project_id"])
    owners = L.partner_owners(v)
    return [await status_for(p, v, x["partner_id"], links.get(x["partner_id"]))
            for x in v["partners"] if x["partner_id"] in owners]
