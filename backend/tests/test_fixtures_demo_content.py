# Fixture-driven demo data: demo-content endpoint, demo-accounts, seed_fixtures CLI, DB-driven seeding, lazy auto-load
# NOTE: mutates test_database.fixtures temporarily (restored in finally) - run with -n 0
import os
import re
import subprocess
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).parent.parent / ".env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
PW = "synthetic-demo"
MC = MongoClient(os.environ["MONGO_URL"])
DB = MC[os.environ["DB_NAME"]]
SCRATCH = "assemble_scratch"


def login(key="organizer", visitor=None):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": f"{key}@demo.assemble.test", "password": PW,
                                                   "visitor_id": visitor or "fx-" + uuid.uuid4().hex[:16]})
    assert r.status_code == 200, r.text
    return s


# Demo accounts from fixture
class TestDemoAccounts:
    def test_six_accounts(self):
        r = requests.get(f"{BASE_URL}/api/auth/demo-accounts")
        assert r.status_code == 200
        d = r.json()
        assert d["fixture_id"] == "canonical-12-branch"
        assert len(d["accounts"]) == 6
        assert [a["key"] for a in d["accounts"]] == ["organizer", "alder", "birch", "cedar", "redwood", "dogwood"]
        assert d["accounts"][0]["role"] == "Organizer" and all(a["role"] == "Partner" for a in d["accounts"][1:])
        assert all(a["email"].endswith("@demo.assemble.test") for a in d["accounts"])


# GET /api/project/demo-content
class TestDemoContent:
    def test_organizer_demo_content(self):
        s = login()
        r = s.get(f"{BASE_URL}/api/project/demo-content")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["fixture_id"] == "canonical-12-branch"
        assert [x["key"] for x in d["documents"]] == ["brief", "quote", "email"]
        start = s.get(f"{BASE_URL}/api/project").json()["sheet"]["intake"]["start_date"]
        for doc in d["documents"]:
            assert "{" not in doc["text"] and "}" not in doc["text"], doc["text"]
            assert re.match(r"^\d{4}-\d{2}-\d{2}$", doc["source_date"])
            assert doc["label"].endswith("(Synthetic)")
        assert re.search(r"\d{4}-\d{2}-\d{2}", d["documents"][0]["text"])  # {start} rendered
        assert "valid until " in d["documents"][1]["text"] and "{valid_until}" not in d["documents"][1]["text"]
        if start:
            assert start in d["documents"][0]["text"]
        pdf = d["pdf"]
        assert pdf["label"] == "Redwood quote PDF (Synthetic)"
        assert pdf["scanned_label"] == "Scanned Redwood quote (Synthetic)"
        assert pdf["kind"] == "quote" and pdf["filename"] == "redwood-quote-synthetic.pdf"
        assert re.match(r"^\d{4}-\d{2}-\d{2}$", pdf["source_date"])
        assert d["customer_change"]["moves"] == [{"site_id": "S09", "new_week": "1"}, {"site_id": "S10", "new_week": "1"}]
        assert len(d["tour"]) == 9
        assert [t.get("action", {}).get("type") for t in d["tour"]] == \
            [None, None, "draft", "draft", "share_links", "customer_change", "reassign", "select", None]

    def test_registered_organizer_404(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST fx", "email": f"test_fx_{uuid.uuid4().hex[:8]}@example.com",
                                                         "password": "testpass123", "firm_name": "TEST firm"})
        assert r.status_code == 200, r.text
        assert s.post(f"{BASE_URL}/api/project", json={"name": "TEST job"}).status_code == 200
        r = s.get(f"{BASE_URL}/api/project/demo-content")
        assert r.status_code == 404
        assert "synthetic" in r.json()["detail"].lower()

    def test_unauthenticated(self):
        assert requests.get(f"{BASE_URL}/api/project/demo-content").status_code == 401


# seed_fixtures.py CLI into a scratch DB
class TestSeedCli:
    def test_seed_scratch(self):
        MC[SCRATCH]["fixtures"].drop()
        assert MC[SCRATCH]["fixtures"].count_documents({}) == 0
        out = subprocess.run(["python", "seed_fixtures.py", "--db", SCRATCH], cwd="/app/backend",
                             capture_output=True, text=True, timeout=60)
        assert out.returncode == 0, out.stderr
        assert "canonical-12-branch" in out.stdout
        fx = MC[SCRATCH]["fixtures"].find_one({"fixture_id": "canonical-12-branch"})
        assert fx and len(fx["sites"]) == 12 and len(fx["partners"]) == 5 and len(fx["tour"]) == 9
        # idempotent re-run
        out = subprocess.run(["python", "seed_fixtures.py", "--db", SCRATCH], cwd="/app/backend",
                             capture_output=True, text=True, timeout=60)
        assert out.returncode == 0 and MC[SCRATCH]["fixtures"].count_documents({}) == 1
        MC.drop_database(SCRATCH)


# Changing the DB fixture changes newly seeded copies; lazy load when collection empty
class TestDbDriven:
    def test_redwood_price_from_db(self):
        backup = DB.fixtures.find_one({"fixture_id": "canonical-12-branch"})
        try:
            DB.fixtures.update_one({"fixture_id": "canonical-12-branch", "partners.key": "redwood"},
                                   {"$set": {"partners.$.price_per_site_cents": 1234500,
                                             "documents.0.label": "TEST brief label"}})
            s = login()
            it = s.get(f"{BASE_URL}/api/project").json()["sheet"]["intake"]
            rw = next(p for p in it["partners"] if p["partner_id"] == "redwood")
            assert rw["price_per_site_cents"] == 1234500
            dc = s.get(f"{BASE_URL}/api/project/demo-content").json()
            assert dc["documents"][0]["label"] == "TEST brief label"
        finally:
            DB.fixtures.replace_one({"_id": backup["_id"]}, backup)
        s = login()
        it = s.get(f"{BASE_URL}/api/project").json()["sheet"]["intake"]
        assert next(p for p in it["partners"] if p["partner_id"] == "redwood")["price_per_site_cents"] == 1280000

    def test_empty_collection_lazy_load(self):
        backup = list(DB.fixtures.find({}))
        try:
            DB.fixtures.delete_many({})
            assert DB.fixtures.count_documents({}) == 0
            s = login()
            assert s.get(f"{BASE_URL}/api/auth/me").status_code == 200
            assert DB.fixtures.count_documents({"fixture_id": "canonical-12-branch"}) == 1
        finally:
            DB.fixtures.delete_many({})
            DB.fixtures.insert_many(backup)
        assert DB.fixtures.count_documents({}) == len(backup)
