# Iteration 14: site creation from names (brief extraction), shared job conditions on review,
# amendment diff reasons, email-preview/email-send invitation guard
import os
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
ORIGIN = {"Origin": BASE_URL}
PW = "synthetic-demo"
VISITOR = "test-" + uuid.uuid4().hex[:16]
BRIEF = ("Two-site lighting replacement for Audit Retail. Start December 7, 2026. Two weeks beginning December 7 and "
         "December 14. North store is due December 13. South store is due December 20. Each store needs one crew-week. "
         "Customer budget ceiling is $30,000. After-hours access is not confirmed. No partner quotes or capacity have "
         "been supplied.")


def demo(key, visitor=VISITOR):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": f"{key}@demo.assemble.test", "password": PW,
                                                   "visitor_id": visitor})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def ctx():
    return {}


# Blocker 1: site creation from site names in a brief (new project)
class TestBriefSites:
    def test_01_new_project_brief(self, ctx):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST Iter14", "email": f"test_{uuid.uuid4().hex[:8]}@example.com",
                                                          "password": "password123", "firm_name": "TEST Firm14"})
        assert r.status_code == 200, r.text
        r = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST Audit Retail"})
        assert r.status_code == 200
        s.headers["X-Project-Id"] = r.json()["project_id"]
        sh = s.get(f"{BASE_URL}/api/project").json()["sheet"]
        assert sh["intake"]["sites"] == [] and sh["gap"]["site_count"] == 0
        r = s.post(f"{BASE_URL}/api/project/sources", json={"kind": "brief", "label": "TEST brief", "text": BRIEF,
                                                            "source_date": "2026-11-20"}, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["sources"][0]["status"] == "read", d["sources"][0].get("error")
        ctx["s"], ctx["readings"] = s, d["readings"]
        site_r = [x for x in d["readings"] if x["scope"] == "site"]
        for x in site_r:
            print(x["field"], x["site_id"], x["reading"] and x["reading"]["value"], x["facts"][-1]["issues"])
        ids = {x["site_id"] for x in site_r}
        assert {"NORTH-STORE", "SOUTH-STORE"} <= ids, ids
        all_issues = [i for x in site_r for f in x["facts"] for i in f["issues"]]
        assert not any("site" in i.lower() and "no site" in i.lower() for i in all_issues), all_issues
        dl = {x["site_id"]: x["reading"]["parsed"] for x in site_r if x["field"] == "site_deadline_week" and x["reading"]}
        assert dl.get("NORTH-STORE") == 1 and dl.get("SOUTH-STORE") == 2, dl

    def test_02_apply_creates_named_sites_and_gap(self, ctx):
        s = ctx["s"]
        sh = s.get(f"{BASE_URL}/api/project").json()["sheet"]
        ids = [x["reading"]["fact_id"] for x in ctx["readings"] if x["reading"] and x["reading"]["status"] in ("proposed", "corrected")]
        r = s.post(f"{BASE_URL}/api/project/readings/apply", json={"rev": sh["project"]["rev"], "fact_ids": ids})
        assert r.status_code == 200, r.text
        it = r.json()["sheet"]["intake"]
        names = {x["site_id"]: x["name"] for x in it["sites"]}
        print("sites", it["sites"], "weeks", it["weeks"], "start", it["start_date"])
        assert len(it["sites"]) == 2 and names.get("NORTH-STORE") and names.get("SOUTH-STORE")
        gap = r.json()["sheet"]["gap"]
        assert gap["weekly"], gap
        assert sum(w["due"] for w in gap["weekly"]) == 2 and gap["weekly"][-1]["short"] == 2
        assert any("after-hours" in c["text"].lower() for c in it.get("job_conditions") or [])

    def test_03_apply_again_no_duplicate(self, ctx):
        s = ctx["s"]
        r = s.post(f"{BASE_URL}/api/project/sources", json={"kind": "brief", "label": "TEST brief 2", "text": BRIEF,
                                                            "source_date": "2026-11-21"}, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        ids = [x["reading"]["fact_id"] for x in d["readings"] if x["reading"] and x["reading"]["status"] in ("proposed", "corrected")]
        if not ids:
            pytest.skip("No new proposed readings on re-read")
        sh = s.get(f"{BASE_URL}/api/project").json()["sheet"]
        r = s.post(f"{BASE_URL}/api/project/readings/apply", json={"rev": sh["project"]["rev"], "fact_ids": ids})
        assert r.status_code == 200, r.text
        assert len(r.json()["sheet"]["intake"]["sites"]) == 2


# Blocker 2/3 + email: canonical demo flow
class TestCanonical:
    def test_01_draft_links_email(self, ctx):
        org = demo("organizer")
        ctx["org"] = org
        sh = org.get(f"{BASE_URL}/api/project").json()["sheet"]
        r = org.post(f"{BASE_URL}/api/project/draft", json={"select": True, "rev": sh["project"]["rev"], "partner_ids": ["alder", "birch", "cedar"]})
        assert r.status_code == 200, r.text
        toks = {}
        for pid in ("alder", "birch", "cedar"):
            r = org.post(f"{BASE_URL}/api/project/links", json={"partner_id": pid})
            assert r.status_code == 200
            toks[pid] = r.json()["link"]["token"]
        ctx["toks"] = toks
        r = org.post(f"{BASE_URL}/api/project/links/{toks['alder']}/email-preview", headers=ORIGIN)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["to"].endswith(".test") and p["sendable"] is False and p["reason"]
        assert p["subject"] and "review" in p["subject"].lower()
        r = org.post(f"{BASE_URL}/api/project/links/{toks['alder']}/email-send", headers=ORIGIN)
        assert r.status_code == 400 and "synthetic" in r.json()["detail"].lower()
        assert org.post(f"{BASE_URL}/api/project/links/bogus/email-preview", headers=ORIGIN).status_code == 404

    def test_02_review_shared_conditions(self, ctx):
        a = demo("alder")
        ctx["alder"] = a
        r = a.get(f"{BASE_URL}/api/review/{ctx['toks']['alder']}")
        assert r.status_code == 200
        print("fresh canonical shared_conditions:", r.json().get("shared_conditions"))
        # Job conditions only exist after the customer brief is read and its condition applied
        org = ctx["org"]
        doc = org.get(f"{BASE_URL}/api/project/demo-content").json()["documents"][0]
        r = org.post(f"{BASE_URL}/api/project/sources", json={"kind": doc["kind"], "label": doc["label"], "text": doc["text"],
                                                              "source_date": doc.get("source_date")}, timeout=180)
        assert r.status_code == 200, r.text
        jc = [x["reading"]["fact_id"] for x in r.json()["readings"] if x["scope"] == "job_condition" and x["reading"]]
        assert jc, "brief produced no job condition"
        sh = org.get(f"{BASE_URL}/api/project").json()["sheet"]
        r = org.post(f"{BASE_URL}/api/project/readings/apply", json={"rev": sh["project"]["rev"], "fact_ids": jc})
        assert r.status_code == 200, r.text
        print("recalc:", r.json().get("recalc"))
        if r.json()["sheet"].get("preview"):
            org.post(f"{BASE_URL}/api/project/preview/discard", json={"rev": r.json()["sheet"]["project"]["rev"]})
        r = a.get(f"{BASE_URL}/api/review/{ctx['toks']['alder']}")
        assert r.status_code == 200
        sc = r.json().get("shared_conditions")
        print(sc)
        assert sc and all({"text", "source", "resolved"} <= set(c) for c in sc)
        assert any("after" in c["text"].lower() for c in sc)

    def test_03_amend_diff_reasons(self, ctx):
        org = ctx["org"]
        sh = org.get(f"{BASE_URL}/api/project").json()["sheet"]
        r = org.post(f"{BASE_URL}/api/project/change-requests", json={"note": "TEST move S09 S10 to week 1",
                     "moves": [{"site_id": "S09", "new_week": 1}, {"site_id": "S10", "new_week": 1}]})
        assert r.status_code == 200
        cr = r.json()["sheet"]["change_requests"][0]["cr_id"]
        r = org.post(f"{BASE_URL}/api/project/preview", json={"rev": r.json()["sheet"]["project"]["rev"], "change_request_id": cr})
        assert r.status_code == 200, r.text
        d = r.json()["sheet"]["preview"]["diff"]
        changed = [p for p in d["partners"] if p["state"] == "changed"]
        print([(p["name"], p["reasons"]) for p in changed])
        assert changed and all(p["reasons"] for p in changed)
        assert any("moves from week" in x for p in changed for x in p["reasons"])
        assert d["sites"] and d["sites"][0]["after"].get("week_start") and "name" in d["sites"][0]["after"]
        org.post(f"{BASE_URL}/api/project/preview/discard", json={"rev": r.json()["sheet"]["project"]["rev"]})
        org.post(f"{BASE_URL}/api/project/demo-reset")
