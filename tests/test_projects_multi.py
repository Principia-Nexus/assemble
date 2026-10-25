# Iteration 12: organizer Projects list, multi-project creation, examples seeding, firm-scoped X-Project-Id authorization, demo reset.
import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
DB = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
ORIGIN = {"Origin": BASE_URL}


def demo_login(visitor=None, email="organizer@demo.assemble.test"):
    s = requests.Session()
    s.headers.update(ORIGIN)
    visitor = visitor or str(uuid.uuid4())
    r = s.post(f"{API}/auth/login", json={"email": email, "password": os.environ["DEMO_PASSWORD"], "visitor_id": visitor})
    assert r.status_code == 200, r.text
    return s, visitor


def register(paid=True):
    DB.email_checks.delete_many({})
    s = requests.Session()
    s.headers.update(ORIGIN)
    email = f"TEST_proj_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}@example.com"
    r = s.post(f"{API}/auth/register", json={"name": "TEST Org", "email": email, "password": "Passw0rd!x", "firm_name": "TEST Firm"})
    assert r.status_code == 200, r.text
    u = DB.users.find_one({"email": email.lower()}) or DB.users.find_one({"email": email})
    if paid:
        DB.firms.update_one({"firm_id": u["firm_id"]}, {"$set": {"pilot_active": True}})
    return s, u


def get(s, path, pid=None):
    r = s.get(f"{API}{path}", headers={"X-Project-Id": pid} if pid else {})
    if path == "/projects" and r.status_code == 200:
        d = r.json()
        for p in d["projects"]:
            p["name"] = p["name"].replace(" (Synthetic)", "")
        r.json = lambda d=d: d
    return r


@pytest.fixture(scope="module")
def demo():
    s, v = demo_login()
    return s, v


@pytest.fixture(scope="module")
def paid():
    return register(True)


# --- Examples seeding (Acceptance 1)
class TestExamples:
    def test_three_examples_in_order_no_dupes(self, demo):
        s, v = demo
        names = [p["name"] for p in get(s, "/projects").json()["projects"]]
        assert names == ["12-branch lighting retrofit", "Six-store lighting refresh", "Warehouse lighting upgrade"], names
        # sign in twice more with same visitor
        for _ in range(2):
            s2, _ = demo_login(v)
            assert len(get(s2, "/projects").json()["projects"]) == 3

    def test_statuses(self, demo):
        s, _ = demo
        st = {p["name"]: p["status"] for p in get(s, "/projects").json()["projects"]}
        assert st["Six-store lighting refresh"] == "Draft"
        assert st["Warehouse lighting upgrade"] == "Needs information"
        assert st["12-branch lighting retrofit"] in ("Draft", "Needs information", "Awaiting partner review")

    def test_example_contents(self, demo):
        s, _ = demo
        rows = {p["name"]: p for p in get(s, "/projects").json()["projects"]}
        six = get(s, "/project", rows["Six-store lighting refresh"]["project_id"]).json()["sheet"]
        it = six["intake"]
        assert it["start_date"] == "2026-12-07" and it["weeks"] == 3 and it["budget_ceiling_cents"] == 8400000
        assert [x["site_id"] for x in it["sites"]] == ["MPL", "BRK", "PIN", "HIL", "LAK", "GRV"]
        assert {p["name"].replace(" (Synthetic)", "") for p in it["partners"]} == {"Juniper Electrical", "Summit Wiring"}
        assert six["current"] is None
        wh = get(s, "/project", rows["Warehouse lighting upgrade"]["project_id"]).json()["sheet"]
        assert wh["intake"]["start_date"] == "2027-01-11" and wh["intake"]["weeks"] == 2
        assert wh["intake"]["budget_ceiling_cents"] == 4500000
        hb = wh["intake"]["partners"][0]
        assert hb["price_per_site_cents"] is None and not hb.get("email")
        assert DB.sources.count_documents({"project_id": rows["Six-store lighting refresh"]["project_id"]}) == 3
        assert DB.sources.count_documents({"project_id": rows["Warehouse lighting upgrade"]["project_id"]}) == 1


# --- Create + dedupe + validation (Acceptance 3, 8)
class TestCreate:
    def test_create_empty_project_and_persist_intake(self, demo):
        s, _ = demo
        r = s.post(f"{API}/projects", json={"name": "TEST Demo acceptance — new project", "customer": "TEST Cust"})
        assert r.status_code == 200, r.text
        pid = r.json()["project_id"]
        sh = get(s, "/project", pid).json()["sheet"]
        assert sh["project"]["project_id"] == pid and sh["intake"]["sites"] == [] and sh["intake"]["partners"] == []
        assert sh["current"] is None
        assert DB.sources.count_documents({"project_id": pid}) == 0
        raw = {"job_name": "TEST Demo acceptance — new project", "customer_name": "TEST Cust", "start_date": "2027-03-01",
               "weeks": 2, "budget_ceiling": "50000", "sites": [], "partners": []}
        r = s.put(f"{API}/project/intake", json={"rev": sh["project"]["rev"], "intake": raw}, headers={"X-Project-Id": pid})
        assert r.status_code == 200, r.text
        it = get(s, "/project", pid).json()["sheet"]["intake"]
        assert it["start_date"] == "2027-03-01" and it["weeks"] == 2 and it["budget_ceiling_cents"] == 5000000
        st = {p["project_id"]: p["status"] for p in get(s, "/projects").json()["projects"]}
        assert st[pid] == "Needs information"

    def test_request_key_dedupe(self, demo):
        s, _ = demo
        k = uuid.uuid4().hex
        a = s.post(f"{API}/projects", json={"name": "TEST dedupe", "request_key": k}).json()["project_id"]
        b = s.post(f"{API}/projects", json={"name": "TEST dedupe", "request_key": k}).json()["project_id"]
        assert a == b
        assert DB.projects.count_documents({"create_key": k}) == 1

    def test_empty_name_rejected(self, demo):
        s, _ = demo
        r = s.post(f"{API}/projects", json={"name": "   "})
        assert r.status_code == 422

    def test_edit_one_only_changes_that(self, demo):
        s, _ = demo
        rows = {p["name"]: p["project_id"] for p in get(s, "/projects").json()["projects"]}
        wh = rows["Warehouse lighting upgrade"]
        before_six = get(s, "/project", rows["Six-store lighting refresh"]).json()["sheet"]["intake"]
        sh = get(s, "/project", wh).json()["sheet"]
        # roundtrip raw intake
        it = sh["intake"]
        raw = {"job_name": "Warehouse lighting upgrade EDITED", "customer_name": it["customer_name"],
               "scope_summary": it["scope_summary"], "start_date": it["start_date"], "weeks": it["weeks"],
               "budget_ceiling": "45000", "own_capacity": it["own_capacity"], "sites": it["sites"], "partners": [],
               "job_conditions": it.get("job_conditions")}
        r = s.put(f"{API}/project/intake", json={"rev": sh["project"]["rev"], "intake": raw}, headers={"X-Project-Id": wh})
        assert r.status_code == 200, r.text
        assert "EDITED" in get(s, "/project", wh).json()["sheet"]["project"]["name"]
        assert get(s, "/project", rows["Six-store lighting refresh"]).json()["sheet"]["intake"] == before_six


# --- Authorization across firms (Acceptance 7)
class TestCrossFirm:
    def test_foreign_project_404(self, demo, paid):
        s, _ = demo
        foreign = get(s, "/projects").json()["projects"][1]["project_id"]
        other, _ = paid
        for path in ("/project", "/project/history", "/project/readings"):
            r = get(other, path, foreign)
            assert r.status_code == 404, (path, r.status_code, r.text)
            assert r.json()["detail"] == "Project not found for your business."
        r = other.put(f"{API}/project/intake", json={"rev": 0, "intake": {"job_name": "x"}}, headers={"X-Project-Id": foreign})
        assert r.status_code == 404
        src = DB.sources.find_one({"project_id": foreign})
        r = get(other, f"/project/sources/{src['source_id']}/file", foreign)
        assert r.status_code == 404
        r = other.post(f"{API}/project/sources", json={"kind": "brief", "label": "x", "text": "x"}, headers={"X-Project-Id": foreign})
        assert r.status_code == 404

    def test_same_firm_wrong_project_source(self, demo):
        s, _ = demo
        rows = get(s, "/projects").json()["projects"]
        src = DB.sources.find_one({"project_id": rows[1]["project_id"]})
        r = get(s, f"/project/sources/{src['source_id']}/file", rows[2]["project_id"])
        assert r.status_code == 404


# --- Billing gating (Acceptance 9)
class TestBilling:
    def test_paid_creates_multiple(self, paid):
        s, _ = paid
        a = s.post(f"{API}/projects", json={"name": "TEST paid A"})
        b = s.post(f"{API}/projects", json={"name": "TEST paid B"})
        assert a.status_code == 200 and b.status_code == 200
        assert len(get(s, "/projects").json()["projects"]) >= 2

    def test_unpaid_402(self):
        s, _ = register(False)
        assert get(s, "/projects").status_code == 402
        assert s.post(f"{API}/projects", json={"name": "TEST unpaid"}).status_code == 402


# --- Demo reset (Acceptance 11)
class TestReset:
    def test_reset_six_store_only(self):
        s, _ = demo_login()
        rows = {p["name"]: p["project_id"] for p in get(s, "/projects").json()["projects"]}
        six, wh, can = rows["Six-store lighting refresh"], rows["Warehouse lighting upgrade"], rows["12-branch lighting retrofit"]
        mine = s.post(f"{API}/projects", json={"name": "TEST mine"}).json()["project_id"]
        sh = get(s, "/project", six).json()["sheet"]
        raw = {"job_name": "SIX EDITED", "weeks": 3, "start_date": "2026-12-07", "sites": [], "partners": []}
        assert s.put(f"{API}/project/intake", json={"rev": sh["project"]["rev"], "intake": raw}, headers={"X-Project-Id": six}).status_code == 200
        can_before = get(s, "/project", can).json()["sheet"]["intake"]
        r = s.post(f"{API}/project/demo-reset", headers={"X-Project-Id": six})
        assert r.status_code == 200, r.text
        after = get(s, "/project", six).json()["sheet"]
        assert after["project"]["project_id"] == six and after["intake"]["job_name"].startswith("Six-store lighting refresh")
        assert len(after["intake"]["sites"]) == 6
        assert DB.sources.count_documents({"project_id": six}) == 3
        assert get(s, "/project", can).json()["sheet"]["intake"] == can_before
        names = [p["name"] for p in get(s, "/projects").json()["projects"]]
        assert len(names) == 4 and "TEST mine" in names
        r = s.post(f"{API}/project/demo-reset", headers={"X-Project-Id": mine})
        assert r.status_code == 400

    def test_reset_forbidden_for_real_organizer(self, paid):
        s, _ = paid
        assert s.post(f"{API}/project/demo-reset").status_code == 403
