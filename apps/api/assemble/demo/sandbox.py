import asyncio
import copy
import hashlib

from fastapi import HTTPException

from assemble.core import db, now_iso, new_id, USER_PROJ, log_event
from assemble.demo.examples import EXAMPLES
from assemble.demo.fixtures import DEFAULT_FIXTURE, accounts, build_intake, get_fixture

CHILDREN = ("versions", "links", "responses", "change_requests", "events", "sources", "facts", "files")


def sandbox_for(visitor_id: str) -> str:
    return "sbx_" + hashlib.sha256(visitor_id.encode()).hexdigest()[:20]


def _project(project_id, firm_id, sid, name, intake, **extra):
    return {"project_id": project_id, "firm_id": firm_id, "sandbox_id": sid, "synthetic": True, "name": name,
            "rev": 0, "version_counter": 0, "intake": intake, "current_version_id": None, "preview_version_id": None,
            "created_at": now_iso(), "updated_at": now_iso(), **extra}


async def seed_project(sid, firm_id, organizer, fixture_id, project_id=None):
    fx = await get_fixture(fixture_id)
    project_id = project_id or new_id("prj")
    await db.projects.insert_one(_project(project_id, firm_id, sid, fx["job"]["job_name"], build_intake(fx),
                                          fixture_id=fixture_id, position=0))
    await log_event(project_id, organizer, "demo", f"Synthetic demo copy created from fixture \"{fixture_id}\" for this visitor.")


async def seed_example(sid, firm_id, organizer, key, project_id=None):
    ex = EXAMPLES[key]
    project_id = project_id or new_id("prj")
    intake = copy.deepcopy(ex["intake"])
    await db.projects.insert_one(_project(project_id, firm_id, sid, intake["job_name"], intake, example_key=key,
                                          position=ex["position"], source_counter=len(ex["sources"])))
    await db.sources.insert_many([{
        "source_id": new_id("src"), "project_id": project_id, "kind": kind, "label": label, "text": text, "filename": None,
        "source_date": sdate, "order": f"{sdate}-{i + 1:04d}", "status": "stored", "error": None, "synthetic": True,
        "created_at": now_iso(), "created_by": organizer["name"]} for i, (kind, label, sdate, text) in enumerate(ex["sources"])])
    await log_event(project_id, organizer, "demo", f"Synthetic example \"{key}\" created for this visitor.")


async def ensure_examples(sid, organizer):
    """Seeds the two extra examples once per sandbox; later sign-ins never duplicate or overwrite them."""
    r = await db.sandboxes.update_one({"sandbox_id": sid, "examples_seeded": {"$ne": True}}, {"$set": {"examples_seeded": True}})
    if r.modified_count:
        for key in EXAMPLES:
            await seed_example(sid, organizer["firm_id"], organizer, key)


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
    await ensure_examples(sid, organizer)


async def ensure_demo_user(visitor_id, key, fixture_id=DEFAULT_FIXTURE):
    sid = sandbox_for(visitor_id)
    res = await db.sandboxes.update_one(
        {"sandbox_id": sid}, {"$setOnInsert": {"sandbox_id": sid, "fixture_id": fixture_id, "created_at": now_iso()}}, upsert=True)
    if res.upserted_id is not None:
        await seed_sandbox(sid, fixture_id)
    for _ in range(25):
        u = await db.users.find_one({"sandbox_id": sid, "demo_key": key}, USER_PROJ)
        if u:
            org = u if key == "organizer" else await db.users.find_one({"sandbox_id": sid, "demo_key": "organizer"}, USER_PROJ)
            if org:
                await ensure_examples(sid, org)
            return u
        await asyncio.sleep(0.2)
    raise HTTPException(503, "The demo copy is still being prepared. Try again in a moment.")


async def reset_project(p, organizer):
    """Resets one synthetic example in place (same project id); other projects are untouched."""
    pid = p["project_id"]
    for coll in CHILDREN:
        await db[coll].delete_many({"project_id": pid})
    await db.projects.delete_one({"project_id": pid})
    await db.users.update_many({"sandbox_id": p["sandbox_id"]}, {"$pull": {"partner_access": {"project_id": pid}}})
    if p.get("example_key"):
        await seed_example(p["sandbox_id"], p["firm_id"], organizer, p["example_key"], pid)
    else:
        await seed_project(p["sandbox_id"], p["firm_id"], organizer, p.get("fixture_id") or DEFAULT_FIXTURE, pid)
