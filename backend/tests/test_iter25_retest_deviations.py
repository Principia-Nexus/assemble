# Iteration 25: deterministic retests for iter23 deviations A/B, firm-name redaction, future observed_on, page provenance
import json
import os
import sys
import uuid
from datetime import date, timedelta

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
from test_iter19_runs_layout_support import BASE_URL, wait_run  # noqa: E402

P = f"{BASE_URL}/api/project"
A = f"{P}/assistant"
CTX = {}


def login(visitor):
    s = requests.Session()
    s.headers["Origin"] = BASE_URL
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "organizer@demo.assemble.test", "password": "synthetic-demo", "visitor_id": visitor})
    assert r.status_code == 200, r.text
    return s


def sh(s):
    return s.get(P).json()["sheet"]


def put_intake(s, **changes):
    cur = sh(s)
    it = {**cur["intake"], **changes}
    r = s.put(f"{P}/intake", json={"rev": cur["project"]["rev"], "intake": it})
    assert r.status_code == 200, r.text
    return r.json().get("sheet") or sh(s)


@pytest.fixture(scope="module")
def org():
    s = login("t25-" + uuid.uuid4().hex[:10])
    pid = next(x["project_id"] for x in s.get(f"{BASE_URL}/api/projects").json()["projects"] if x["name"].startswith("12-branch"))
    s.headers["X-Project-Id"] = pid
    sheet = sh(s)
    parts = sheet["intake"]["partners"]
    print("PARTNERS", [(p["partner_id"], p["name"]) for p in parts])
    alder = next(p for p in parts if "alder" in p["name"].lower())
    CTX["alder"] = alder
    parts = [{**p, "conditions": "Alder must hold an active C-10 licence", "conditions_source": "Chat brief"} if p is alder else p for p in parts]
    put_intake(s, partners=parts,
               job_conditions=[{"text": "Work hours 7am to 3pm only", "source": "Spec book page 4"},
                               {"text": "Contractor must hold an active C-7 licence", "source": "Spec book page 9"}])
    return s


# DEVIATION B: firm-scoped Required-by-source licence requirement
class TestRequiredBySource:
    def test_doc_req_for_alder(self, org):
        reqs = sh(org)["qual"]["requirements"]
        print("REQS", [(r["req_id"], r["status"], r["origin"], r.get("firm"), r.get("source")) for r in reqs])
        rid = f"doc-C-10-{CTX['alder']['partner_id']}"
        r = next((x for x in reqs if x["req_id"] == rid), None)
        assert r, f"{rid} missing"
        assert r["origin"] == "document" and r["status"] == "required" and r["firm"] == CTX["alder"]["partner_id"]
        assert not any(x["req_id"] == "sug-C-10" for x in reqs), "sug-C-10 should be suppressed"

    def test_dismiss_422(self, org):
        rid = f"doc-C-10-{CTX['alder']['partner_id']}"
        r = org.post(f"{P}/requirements/{rid}/dismiss", json={"reason": "Not needed at all"})
        print("DISMISS", r.status_code, r.text[:200])
        assert r.status_code == 422

    def test_page_number_on_job_condition(self, org):
        reqs = sh(org)["qual"]["requirements"]
        c7 = next((x for x in reqs if x["req_id"] == "doc-C-7"), None)
        assert c7, [x["req_id"] for x in reqs]
        assert c7["source"]["page"] == 9, c7["source"]

    def test_applies_only_to_alder_sites(self, org):
        sheet = sh(org)
        r = org.post(f"{P}/draft", json={"rev": sheet["project"]["rev"], "partner_ids": [p["partner_id"] for p in sheet["intake"]["partners"]],
                                         "include_own": True})
        assert r.status_code == 200, r.text
        cur = r.json()["sheet"]["current"]
        asg = cur["version"]["assignments"]
        aid = CTX["alder"]["partner_id"]
        others = 0
        for sid, x in cur["qualification"]["sites"].items():
            owner = asg.get(sid, {}).get("owner")
            c10 = [m for m in x["reasons"] if "C-10" in m or "Electrical" in m]
            print(sid, owner, x["status"], x["reasons"][:3])
            if owner and owner != aid:
                others += 1
                assert not c10, f"{sid} owned by {owner} asked for C-10: {c10}"
        print("OTHER_OWNED_SITES", others)

    def test_open_condition_not_duplicated(self, org):
        s = sh(org)
        oc = s["gap"]["open_conditions"]
        print("OPEN_CONDS", [c["text"] for c in oc])
        assert not any("C-10" in c["text"] for c in oc)
        q = org.post(f"{P}/quotes", json={}).json()["quote"]
        CTX["qid"] = q["quote_id"]
        pv = org.get(f"{P}/quotes/{q['quote_id']}/preview").json()
        conds = (pv.get("readiness") or {}).get("conditions") or []
        print("QUOTE_CONDS", [c["text"] for c in conds])
        assert not any("C-10" in c["text"] for c in conds)


# Evidence provenance: future observed_on rejected
class TestEvidence:
    def test_future_observed_on_422(self, org):
        fut = (date.today() + timedelta(days=3)).isoformat()
        r = org.post(f"{P}/evidence", json={"partner_id": CTX["alder"]["partner_id"], "license_class": "C-10", "observed_status": "active",
                                            "observed_on": fut, "source_record": "Synthetic record"})
        print("FUT", r.status_code, r.text[:200])
        assert r.status_code == 422 and "Observed on cannot be in the future." in r.text


# Firm-name redaction in customer snapshot
class TestRedaction:
    def test_firm_names_scrubbed(self, org):
        a = CTX["alder"]
        full = a["name"]
        short = full.split()[0]
        parts = [{**p, "conditions": f"{full} needs site access from 6am daily"} if p["partner_id"] == a["partner_id"] else p
                 for p in sh(org)["intake"]["partners"]]
        put_intake(org, partners=parts)
        sheet = sh(org)
        r = org.post(f"{P}/draft", json={"rev": sheet["project"]["rev"], "partner_ids": [p["partner_id"] for p in sheet["intake"]["partners"]],
                                         "include_own": True})
        assert r.status_code == 200, r.text
        r = org.post(f"{P}/exclusions", json={"text": f"{full} excludes patching and painting", "level": "firm", "target": a["partner_id"]})
        assert r.status_code == 200, r.text
        r = org.post(f"{P}/exclusions", json={"text": f"{short} excludes core drilling", "level": "firm", "target": a["partner_id"]})
        assert r.status_code == 200, r.text
        qid = org.post(f"{P}/quotes", json={}).json()["quote"]["quote_id"]  # own quote: xdist-safe
        pv = org.get(f"{P}/quotes/{qid}/preview").json()
        print("PV_KEYS", list(pv.keys()))
        conds = (pv.get("readiness") or {}).get("conditions") or []
        dec = {c["text"]: ("in_offer" if "6am" in c["text"] else "resolved") for c in conds}
        org.put(f"{P}/quotes/{qid}", json={"fields": {"condition_decisions": dec}})
        pv = org.get(f"{P}/quotes/{qid}/preview").json()
        snap = pv["snapshot"]
        print("SNAP_EXC", snap["exclusions"])
        print("SNAP_CON", snap["conditions"])
        txt = json.dumps({"e": snap["exclusions"], "c": snap["conditions"]}).lower()
        assert any("6am" in c for c in snap["conditions"]), "in_offer condition missing"
        assert full.lower() not in txt, "full firm name leaked"
        assert "the subcontractor" in txt
        CTX["short_leak"] = short.lower() in txt
        assert not CTX["short_leak"], f"short firm name '{short}' leaked: {snap['exclusions']}"
