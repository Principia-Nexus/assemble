# Fresh-project completion path on the canonical twelve-site documents (preview). Run: python tests/fresh_flow.py
import json
import os
import sys
import time
import uuid

import requests

BASE = os.environ.get("BASE_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0]
P = f"{BASE}/api/project"
DOCS = json.load(open(os.path.join(os.path.dirname(__file__), "fresh_fixture_docs.json")))
FIRMS = {"alder": "Alder", "birch": "Birch", "cedar": "Cedar", "dogwood": "Dogwood", "redwood": "Redwood"}
OUT = {}


def log(k, v):
    OUT[k] = v
    print(k, json.dumps(v, default=str)[:900], flush=True)


def login(email, visitor):
    s = requests.Session()
    s.headers["Origin"] = BASE
    r = s.post(f"{BASE}/api/auth/login", json={"email": email, "password": "synthetic-demo", "visitor_id": visitor})
    assert r.status_code == 200, r.text
    return s


def sheet(s):
    return s.get(P).json()["sheet"] if "sheet" in s.get(P).json() else s.get(P).json()


def add_and_apply(s, key):
    d = DOCS[key]
    r = s.post(f"{P}/sources", json={"kind": d["kind"], "label": d["label"], "text": d["text"], "source_date": d["date"]})
    assert r.status_code == 200, r.text
    for _ in range(90):
        rd = s.get(f"{P}/readings").json()
        src = next(x for x in rd["sources"] if x["label"] == d["label"])
        if src["status"] not in ("reading", "stored", "queued"):
            break
        time.sleep(2)
    assert src["status"] == "read", src
    ids = [r["reading"]["fact_id"] for r in rd["readings"] if r["reading"] and r["reading"]["source_id"] == src["source_id"]
           and r["reading"]["status"] in ("proposed", "corrected")]
    bad = [(f["label"], f["value"], f["issues"]) for r in rd["readings"] for f in r["facts"] if f["source_id"] == src["source_id"] and f["status"] == "invalid"]
    if ids:
        rev = sheet(s)["project"]["rev"]
        a = s.post(f"{P}/readings/apply", json={"rev": rev, "fact_ids": ids})
        assert a.status_code == 200, a.text
    return len(ids), bad


def main():
    visitor = "fresh-" + uuid.uuid4().hex[:10]
    s = login("organizer@demo.assemble.test", visitor)
    r = s.post(f"{BASE}/api/projects", json={"name": "Fresh 12-branch completion test"})
    s.headers["X-Project-Id"] = r.json()["project_id"]
    log("project", {"visitor": visitor, "project_id": r.json()["project_id"]})
    log("brief", add_and_apply(s, "brief"))
    sh = sheet(s)
    log("questions", sh.get("questions"))
    if sh.get("questions"):
        y = s.post(f"{P}/readings/year", json={"rev": sh["project"]["rev"], "year": 2026})
        assert y.status_code == 200, y.text
    it = sheet(s)["intake"]
    log("job", {k: it.get(k) for k in ("start_date", "weeks", "budget_ceiling_cents", "customer_payment_terms")})
    log("sites", [(x["site_id"], x.get("access_start"), x.get("access_end"), x.get("deadline_week"), x.get("scope")) for x in it["sites"]])
    for k in ("costs", "alder", "birch", "cedar", "dogwood", "redwood", "redwood_email"):
        log(k, add_and_apply(s, k))
    it = sheet(s)["intake"]
    log("costs_saved", {k: it.get(k) for k in ("coordination_cents", "contingency_cents")})
    log("capacity", {p["name"]: (p.get("capacity"), p.get("price_per_site_cents"), p.get("max_sites")) for p in it["partners"]})
    json.dump(OUT, open("/app/test_reports/fresh_flow_reading.json", "w"), indent=1, default=str)


if __name__ == "__main__":
    sys.exit(main())
