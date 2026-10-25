import json
from datetime import timedelta
from pathlib import Path

from fastapi import HTTPException

from core import db, now_iso
from logic import today_pacific

FIXTURE_DIR = Path(__file__).parent / "fixtures"
DEFAULT_FIXTURE = "canonical-12-branch"


def fixture_files():
    return [json.loads(p.read_text()) for p in sorted(FIXTURE_DIR.glob("*.json"))]


async def ensure_fixtures():
    """Loads fixture files into the fixtures collection when it has none (fresh, test or deployed DBs)."""
    if await db.fixtures.count_documents({}) == 0:
        for fx in fixture_files():
            await db.fixtures.update_one({"fixture_id": fx["fixture_id"]},
                                         {"$set": {**fx, "loaded_at": now_iso()}}, upsert=True)


async def get_fixture(fixture_id=DEFAULT_FIXTURE):
    fx = await db.fixtures.find_one({"fixture_id": fixture_id}, {"_id": 0})
    if not fx:
        await ensure_fixtures()
        fx = await db.fixtures.find_one({"fixture_id": fixture_id}, {"_id": 0})
    if not fx:
        raise HTTPException(503, "Demo data is not loaded in this database. Run seed_fixtures.py.")
    return fx


def accounts(fx):
    dom = fx["email_domain"]
    org = fx["organizer"]
    out = [{"key": org["key"], "email": f"{org['key']}@{dom}", "name": org["name"], "role": "Organizer", "firm": org["firm"]}]
    out += [{"key": p["key"], "email": f"{p['key']}@{dom}", "name": p["contact_name"], "role": "Partner", "firm": p["firm"]}
            for p in fx["partners"]]
    return out


async def demo_key_for(email):
    fx = await get_fixture()
    return next((a["key"] for a in accounts(fx) if a["email"] == email), None)


def dates(fx, start):
    return {"start": start.isoformat(),
            "valid_until": (start + timedelta(days=fx["partner_defaults"]["valid_days_after_start"])).isoformat()}


def next_monday():
    t = today_pacific()
    return t + timedelta(days=(7 - t.weekday()) % 7 or 7)


def build_intake(fx):
    start = next_monday()
    d, pd = dates(fx, start), fx["partner_defaults"]
    sd = fx.get("site_defaults", {})
    return {
        **fx["job"], "start_date": d["start"],
        "sites": [{"scope": sd.get("scope"), **s} for s in fx["sites"]],
        "partners": [{
            "partner_id": p["key"], "name": p["firm"], "email": f"{p['key']}@{fx['email_domain']}",
            "price_per_site_cents": p["price_per_site_cents"], "capacity": p["capacity"], "max_sites": p["max_sites"],
            "payer": p.get("payer", pd["payer"]), "advance_pct": p["advance_pct"],
            "balance_terms": p.get("balance_terms", pd["balance_terms"]), "conditions": p.get("conditions"),
            "exclusions": p.get("exclusions", pd["exclusions"]), "scope": p.get("scope", pd["scope"]),
            "valid_until": d["valid_until"],
        } for p in fx["partners"]],
    }


def render(text, fx, start_iso, offset_days):
    from datetime import date
    start = date.fromisoformat(start_iso)
    ctx = {**dates(fx, start), "doc_date": (start + timedelta(days=offset_days)).isoformat()}
    for k, v in ctx.items():
        text = text.replace("{" + k + "}", v)
    return text, ctx["doc_date"]


def documents(fx, start_iso):
    out = []
    for d in fx.get("documents", []):
        text, doc_date = render(d["text"], fx, start_iso, d["date_offset_days"])
        out.append({"key": d["key"], "kind": d["kind"], "label": d["label"], "source_date": doc_date, "text": text})
    return out


def pdf_pages(fx, start_iso):
    q = fx["pdf_quote"]
    pages = [[render(line, fx, start_iso, q["date_offset_days"])[0] for line in page] for page in q["pages"]]
    return pages, render("", fx, start_iso, q["date_offset_days"])[1]
