"""Evidence graph: sources -> changes -> sites -> firms, built from authorized project records."""
from fastapi import APIRouter, Depends

from core import db, current_user
from project_routes import get_project, sheet

router = APIRouter(prefix="/api/project")
FIELD = {"price_per_site": "price", "capacity": "capacity", "max_sites": "max sites", "advance_pct": "advance",
         "valid_until": "validity", "conditions": "conditions", "site_deadline_week": "deadline", "site_name": "name",
         "site_scope": "scope", "budget_ceiling": "ceiling", "start_date": "start", "weeks": "weeks"}


def short(field):
    for k, v in FIELD.items():
        if field.startswith(k) or field.endswith(k):
            return v
    return field.replace("_", " ")


@router.get("/graph")
async def graph(user=Depends(current_user)):
    p = await get_project(user)
    s = await sheet(p["project_id"])
    it = s["intake"]
    sources = await db.sources.find({"project_id": p["project_id"]}, {"_id": 0, "source_id": 1, "label": 1, "kind": 1, "order": 1}).sort(
        "order", 1).to_list(100)
    facts = await db.facts.find({"project_id": p["project_id"], "status": {"$in": ["applied", "corrected"]}},
                                {"_id": 0, "source_id": 1, "field": 1, "site_id": 1, "partner_id": 1, "scope": 1}).to_list(3000)
    firm_name = {x["partner_id"]: x["name"] for x in it["partners"]}
    site_ids = {x["site_id"] for x in it["sites"]}
    nodes, edges = [], set()
    for src in sources:
        nodes.append({"id": f"src:{src['source_id']}", "band": 0, "label": src["label"], "sub": src["kind"]})
    groups = {}
    for f in facts:
        ent = (f"firm:{f['partner_id']}" if f.get("partner_id") in firm_name else
               f"site:{f['site_id']}" if f.get("site_id") in site_ids else "job")
        groups.setdefault((f["source_id"], ent), set()).add(short(f["field"]))
    for i, ((sid, ent), fields) in enumerate(sorted(groups.items())):
        cid = f"chg:{i}"
        name = firm_name.get(ent[5:]) if ent.startswith("firm:") else ent[5:] if ent.startswith("site:") else "Job"
        nodes.append({"id": cid, "band": 1, "label": f"{name}: {', '.join(sorted(fields))}", "sub": "applied fact"})
        edges.add((f"src:{sid}", cid))
        if ent != "job":
            edges.add((cid, ent))
    for c in s["change_requests"]:
        if c["status"] not in ("open", "in_preview"):
            continue
        cid = f"cr:{c['change_request_id']}"
        nodes.append({"id": cid, "band": 1, "label": c["note"][:60], "sub": "customer change"})
        for m in c.get("moves") or []:
            edges.add((cid, f"site:{m['site_id']}"))
    pre = s.get("preview")
    if pre and pre.get("diff"):
        for d in pre["diff"]["sites"]:
            if not d.get("before") or not d.get("after") or d["before"] == d["after"]:
                continue
            cid = f"mv:{d['site_id']}"
            nodes.append({"id": cid, "band": 1, "label": f"{d['site_id']} → {d['after'].get('owner_name')} wk {d['after'].get('week')}",
                          "sub": "private draft"})
            edges.update({(cid, f"site:{d['site_id']}"), (cid, f"firm:{d['after'].get('owner')}")})
    cur = s.get("current")
    owner_of = {k: a.get("owner") for k, a in (cur["version"]["assignments"] if cur else {}).items()}
    for x in it["sites"]:
        a = (cur["version"]["assignments"].get(x["site_id"]) if cur else None) or {}
        nodes.append({"id": f"site:{x['site_id']}", "band": 2, "label": x.get("name") or x["site_id"],
                      "sub": f"{x['site_id']} · wk {a.get('week')}" if a else x["site_id"]})
        if owner_of.get(x["site_id"]):
            edges.add((f"site:{x['site_id']}", f"firm:{owner_of[x['site_id']]}"))
    status = {q["partner_id"]: q["status"] for q in (cur["partners"] if cur else [])}
    for x in it["partners"]:
        nodes.append({"id": f"firm:{x['partner_id']}", "band": 3, "label": x["name"], "sub": status.get(x["partner_id"], "not in plan")})
    if any(owner == "own" for owner in owner_of.values()):
        nodes.append({"id": "firm:own", "band": 3, "label": "Your own crew", "sub": "own"})
    ids = {n["id"] for n in nodes}
    return {"nodes": nodes, "edges": [{"from": a, "to": b} for a, b in sorted(edges) if a in ids and b in ids]}
