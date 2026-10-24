import asyncio
import hashlib
from datetime import timedelta

from fastapi import HTTPException

from core import db, now_iso, new_id, USER_PROJ, log_event
from logic import today_pacific

DEMO_DOMAIN = "demo.assemble.test"
ORG_FIRM = "Brightline Electrical (Synthetic)"
DEMO_ACCOUNTS = [
    {"key": "organizer", "name": "Brightline organizer (Synthetic)", "role": "Organizer", "firm": ORG_FIRM},
    {"key": "alder", "name": "Alder contact (Synthetic)", "role": "Partner", "firm": "Alder Line Electric (Synthetic)"},
    {"key": "birch", "name": "Birch contact (Synthetic)", "role": "Partner", "firm": "Birch Street Power (Synthetic)"},
    {"key": "cedar", "name": "Cedar contact (Synthetic)", "role": "Partner", "firm": "Cedar Grid Services (Synthetic)"},
    {"key": "redwood", "name": "Redwood contact (Synthetic)", "role": "Partner", "firm": "Redwood Circuit Co. (Synthetic)"},
    {"key": "dogwood", "name": "Dogwood contact (Synthetic)", "role": "Partner", "firm": "Dogwood Field Crews (Synthetic)"},
]
for a in DEMO_ACCOUNTS:
    a["email"] = f"{a['key']}@{DEMO_DOMAIN}"
DEMO_EMAILS = {a["email"]: a["key"] for a in DEMO_ACCOUNTS}

# key, per-site price (cents), weekly capacity, quoted max sites, advance %, condition
PARTNERS = [
    ("alder", 1400000, [2, 0, 2], 4, 20, "Customer provides after-hours site access."),
    ("birch", 1400000, [2, 2, 0], 4, 20, "Organizer arranges lift rental at each branch."),
    ("cedar", 1400000, [0, 2, 2], 4, 20, None),
    ("redwood", 1280000, [1, 2, 4], 10, 10, None),
    ("dogwood", 1600000, [2, 0, 0], 2, 50, "50% advance must be paid before mobilization."),
]
BRANCHES = ["Oakridge", "Millbrook", "Harbor Point", "Linden", "Westfield", "Cypress Row",
            "Northgate", "Fairview", "Sunset Park", "Riverside", "Elm Court", "Bayshore"]


def demo_intake():
    t = today_pacific()
    start = t + timedelta(days=(7 - t.weekday()) % 7 or 7)
    firms = {a["key"]: a["firm"] for a in DEMO_ACCOUNTS}
    return {
        "job_name": "12-branch lighting retrofit (Synthetic)",
        "customer_name": "Harborview Credit Union (Synthetic)",
        "scope_summary": "LED lighting retrofit and panel labeling at twelve branches. One crew-week per branch.",
        "start_date": start.isoformat(),
        "weeks": 3,
        "budget_ceiling_cents": 18000000,
        "own_capacity": [0, 0, 0],
        "own_cost_per_site_cents": None,
        "sites": [{"site_id": f"S{i + 1:02d}", "name": f"{BRANCHES[i]} branch (Synthetic)",
                   "deadline_week": i // 4 + 1, "scope": "LED retrofit + panel labeling"} for i in range(12)],
        "partners": [{
            "partner_id": key, "name": firms[key], "email": f"{key}@{DEMO_DOMAIN}",
            "price_per_site_cents": price, "capacity": cap, "max_sites": mx,
            "payer": f"{ORG_FIRM} pays the partner", "advance_pct": adv,
            "balance_terms": "Balance due 30 days after each site sign-off",
            "conditions": cond, "exclusions": "Ceiling repairs, asbestos abatement, permits",
            "scope": "LED retrofit + panel labeling at assigned branches",
            "valid_until": (start + timedelta(days=28)).isoformat(),
        } for key, price, cap, mx, adv, cond in PARTNERS],
    }


def sandbox_for(visitor_id: str) -> str:
    return "sbx_" + hashlib.sha256(visitor_id.encode()).hexdigest()[:20]


async def seed_project(sid, firm_id, organizer):
    project_id = new_id("prj")
    await db.projects.insert_one({
        "project_id": project_id, "firm_id": firm_id, "sandbox_id": sid, "synthetic": True,
        "name": "12-branch lighting retrofit (Synthetic)", "rev": 0, "version_counter": 0,
        "intake": demo_intake(), "current_version_id": None, "preview_version_id": None, "created_at": now_iso(),
    })
    await log_event(project_id, organizer, "demo", "Synthetic demo copy created for this visitor.")


async def seed_sandbox(sid):
    firm_id = new_id("firm")
    await db.firms.insert_one({"firm_id": firm_id, "name": ORG_FIRM, "sandbox_id": sid, "synthetic": True,
                               "created_at": now_iso()})
    organizer = None
    for a in DEMO_ACCOUNTS:
        doc = {"user_id": new_id("user"), "email": a["email"], "name": a["name"], "picture": None,
               "sandbox_id": sid, "demo_key": a["key"], "auth_methods": ["demo"], "email_verified": True,
               "firm_id": firm_id if a["key"] == "organizer" else None, "firm_name": a["firm"],
               "partner_access": [], "created_at": now_iso()}
        await db.users.insert_one(doc)
        if a["key"] == "organizer":
            organizer = doc
    await seed_project(sid, firm_id, organizer)


async def ensure_demo_user(visitor_id, key):
    sid = sandbox_for(visitor_id)
    res = await db.sandboxes.update_one({"sandbox_id": sid}, {"$setOnInsert": {"sandbox_id": sid, "created_at": now_iso()}},
                                        upsert=True)
    if res.upserted_id is not None:
        await seed_sandbox(sid)
    for _ in range(25):
        u = await db.users.find_one({"sandbox_id": sid, "demo_key": key}, USER_PROJ)
        if u:
            return u
        await asyncio.sleep(0.2)
    raise HTTPException(503, "The demo copy is still being prepared. Try again in a moment.")


async def reset_sandbox(sid, organizer):
    for p in await db.projects.find({"sandbox_id": sid}, {"_id": 0, "project_id": 1}).to_list(10):
        pid = p["project_id"]
        for coll in ("versions", "links", "responses", "change_requests", "events", "sources", "facts"):
            await db[coll].delete_many({"project_id": pid})
    await db.projects.delete_many({"sandbox_id": sid})
    await db.users.update_many({"sandbox_id": sid}, {"$set": {"partner_access": []}})
    await seed_project(sid, organizer["firm_id"], organizer)
