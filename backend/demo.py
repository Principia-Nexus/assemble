import asyncio
import hashlib

from fastapi import HTTPException

from core import db, now_iso, new_id, USER_PROJ, log_event
from fixtures import DEFAULT_FIXTURE, accounts, build_intake, get_fixture


def sandbox_for(visitor_id: str) -> str:
    return "sbx_" + hashlib.sha256(visitor_id.encode()).hexdigest()[:20]


async def seed_project(sid, firm_id, organizer, fixture_id):
    fx = await get_fixture(fixture_id)
    project_id = new_id("prj")
    await db.projects.insert_one({
        "project_id": project_id, "firm_id": firm_id, "sandbox_id": sid, "synthetic": fx.get("synthetic", True),
        "fixture_id": fixture_id, "name": fx["job"]["job_name"], "rev": 0, "version_counter": 0,
        "intake": build_intake(fx), "current_version_id": None, "preview_version_id": None, "created_at": now_iso(),
    })
    await log_event(project_id, organizer, "demo", f"Synthetic demo copy created from fixture \"{fixture_id}\" for this visitor.")


async def seed_sandbox(sid, fixture_id):
    fx = await get_fixture(fixture_id)
    firm_id = new_id("firm")
    await db.firms.insert_one({"firm_id": firm_id, "name": fx["organizer"]["firm"], "sandbox_id": sid, "synthetic": True,
                               "created_at": now_iso()})
    organizer = None
    for a in accounts(fx):
        doc = {"user_id": new_id("user"), "email": a["email"], "name": a["name"], "picture": None,
               "sandbox_id": sid, "demo_key": a["key"], "auth_methods": ["demo"], "email_verified": True,
               "firm_id": firm_id if a["role"] == "Organizer" else None, "firm_name": a["firm"],
               "partner_access": [], "created_at": now_iso()}
        await db.users.insert_one(doc)
        if a["role"] == "Organizer":
            organizer = doc
    await seed_project(sid, firm_id, organizer, fixture_id)


async def ensure_demo_user(visitor_id, key, fixture_id=DEFAULT_FIXTURE):
    sid = sandbox_for(visitor_id)
    res = await db.sandboxes.update_one(
        {"sandbox_id": sid}, {"$setOnInsert": {"sandbox_id": sid, "fixture_id": fixture_id, "created_at": now_iso()}}, upsert=True)
    if res.upserted_id is not None:
        await seed_sandbox(sid, fixture_id)
    for _ in range(25):
        u = await db.users.find_one({"sandbox_id": sid, "demo_key": key}, USER_PROJ)
        if u:
            return u
        await asyncio.sleep(0.2)
    raise HTTPException(503, "The demo copy is still being prepared. Try again in a moment.")


async def reset_sandbox(sid, organizer):
    box = await db.sandboxes.find_one({"sandbox_id": sid}) or {}
    for p in await db.projects.find({"sandbox_id": sid}, {"_id": 0, "project_id": 1}).to_list(10):
        pid = p["project_id"]
        for coll in ("versions", "links", "responses", "change_requests", "events", "sources", "facts", "files"):
            await db[coll].delete_many({"project_id": pid})
    await db.projects.delete_many({"sandbox_id": sid})
    await db.users.update_many({"sandbox_id": sid}, {"$set": {"partner_access": []}})
    await seed_project(sid, organizer["firm_id"], organizer, box.get("fixture_id", DEFAULT_FIXTURE))
