# Iteration 26: short-name redaction, chat exclusion capitalisation, dict-source job conditions, clean-copy, assistant wording
import json
import os
import re
import sys
import uuid

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


def projects(s):
    return s.get(f"{BASE_URL}/api/projects").json()["projects"]


def ask(s, msg):
    r = s.post(A, json={"message": msg, "rev": sh(s)["project"]["rev"], "async_run": True})
    assert r.status_code == 200, r.text
    return wait_run(s, r.json()["run"]["run_id"], limit=240)


def reply_text(j):
    rp = j["reply"]
    return rp.get("text") or rp.get("answer") or json.dumps(rp)


@pytest.fixture(scope="module")
def org():
    s = login("t26-" + uuid.uuid4().hex[:10])
    pid = next(x["project_id"] for x in projects(s) if x["name"].startswith("12-branch"))
    s.headers["X-Project-Id"] = pid
    return s


# Redaction: short names, possessive, email local part, full name with (Synthetic)
class TestRedactionVariants:
    def test_variants(self, org):
        parts = sh(org)["intake"]["partners"]
        a = next(p for p in parts if "alder" in p["name"].lower())
        r = next(p for p in parts if "redwood" in p["name"].lower())
        texts = [(f"{a['name']} excludes trenching", a), ("Alder's crew excludes lifts", a), ("alder excludes permits", a),
                 ("Redwood excludes core drilling", r), (f"{r['name']} excludes painting", r)]
        sheet = sh(org)
        assert org.post(f"{P}/draft", json={"rev": sheet["project"]["rev"], "partner_ids": [p["partner_id"] for p in parts],
                                             "include_own": True}).status_code == 200
        for t, p in texts:
            assert org.post(f"{P}/exclusions", json={"text": t, "level": "firm", "target": p["partner_id"]}).status_code == 200
        qid = org.post(f"{P}/quotes", json={}).json()["quote"]["quote_id"]
        snap = org.get(f"{P}/quotes/{qid}/preview").json()["snapshot"]
        print("SNAP_EXC", snap["exclusions"])
        txt = " ".join(snap["exclusions"]).lower()
        for bad in ["alder", "redwood", "synthetic", "electric", "circuit"]:
            assert not re.search(rf"\b{bad}", txt), f"'{bad}' leaked: {snap['exclusions']}"
        assert "the subcontractor excludes core drilling" in txt


# Job condition with dict source {label, page}
class TestDictSource:
    def test_dict_source(self, org):
        cur = sh(org)
        it = {**cur["intake"], "job_conditions": (cur["intake"].get("job_conditions") or []) + [
            {"text": "Contractor must hold an active C-10 licence", "source": {"label": "TEST Spec book", "page": 7}}]}
        r = org.put(f"{P}/intake", json={"rev": cur["project"]["rev"], "intake": it})
        assert r.status_code == 200, r.text
        s2 = sh(org)
        jc = [c for c in s2["intake"]["job_conditions"] if "C-10" in c["text"]]
        print("JC", jc)
        assert jc and jc[0]["source"] == "TEST Spec book, page 7"
        reqs = [x for x in s2["qual"]["requirements"] if x["code"] == "C-10"]
        print("REQS", [(x["req_id"], x.get("origin"), x.get("source")) for x in reqs])
        assert any((x.get("source") or {}).get("page") == 7 for x in reqs if isinstance(x.get("source"), dict))


# Clean copy for the fixture; 400 for a non-fixture project
class TestCleanCopy:
    def test_clean_copy(self):
        s = login("t26cc-" + uuid.uuid4().hex[:10])
        orig = next(x for x in projects(s) if x["name"].startswith("12-branch"))
        s.headers["X-Project-Id"] = orig["project_id"]
        sheet = sh(s)
        assert s.post(f"{P}/draft", json={"rev": sheet["project"]["rev"], "partner_ids": [p["partner_id"] for p in sheet["intake"]["partners"]],
                                           "include_own": True}).status_code == 200
        assert s.post(f"{P}/exclusions", json={"text": "TEST orig exclusion", "level": "job"}).status_code == 200
        q = s.post(f"{P}/quotes", json={}).json()["quote"]["quote_id"]
        before = sh(s)
        hist_before = s.get(f"{P}/history").json() if s.get(f"{P}/history").status_code == 200 else None
        r = s.post(f"{P}/clean-copy")
        print("CC", r.status_code, r.text[:200])
        assert r.status_code == 200
        new = r.json()["project_id"]
        assert new != orig["project_id"]
        names = {x["project_id"]: x["name"] for x in projects(s)}
        print("PROJECTS", names)
        assert names[new].endswith("· recording copy")
        # original untouched
        after = sh(s)
        assert after["project"]["rev"] == before["project"]["rev"]
        assert any(x["text"] == "TEST orig exclusion" for x in after["intake"].get("exclusions") or after.get("exclusions") or []) or \
            "TEST orig exclusion" in json.dumps(after)
        assert any(x["quote_id"] == q for x in s.get(f"{P}/quotes").json()["quotes"])
        if hist_before is not None:
            assert len(s.get(f"{P}/history").json().get("events", [])) >= len(hist_before.get("events", []))
        # copy is fresh
        s.headers["X-Project-Id"] = new
        cs = sh(s)
        assert "TEST orig exclusion" not in json.dumps(cs)
        assert cs.get("current") in (None, {}) or not cs.get("current", {}).get("assignments")
        assert s.get(f"{P}/quotes").json()["quotes"] == []
        assert len(cs["intake"]["sites"]) == len(before["intake"]["sites"])
        # non-fixture project -> 400
        r = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST blank"})
        s.headers["X-Project-Id"] = r.json()["project_id"]
        r = s.post(f"{P}/clean-copy")
        print("CC_BLANK", r.status_code, r.text)
        assert r.status_code == 400
        others = [x for x in projects(s) if not x["name"].startswith("12-branch") and "recording copy" not in x["name"] and not x["name"].startswith("TEST")]
        for o in others:
            s.headers["X-Project-Id"] = o["project_id"]
            r = s.post(f"{P}/clean-copy")
            print("CC_OTHER", o["name"], r.status_code)
            assert r.status_code == 400


# Chat exclusion capitalised + assistant wording
class TestChat:
    def test_chat_exclusion_capitalised(self):
        s = login("t26ch-" + uuid.uuid4().hex[:10])
        s.headers["X-Project-Id"] = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST Pine"}).json()["project_id"]
        ask(s, "Job: Pine St lighting for Acme Co (buyer@example.test). 2 sites: S01 Main office due week 1, S02 Warehouse due week 2. "
               "2 weeks starting 2026-11-02. Partner Alder Line Electric alder@demo.assemble.test, $9,000 per site, capacity 1 per week. "
               "Exclude ceiling repairs.")
        sheet = sh(s)
        exc = sheet["qual"]["exclusions"]
        print("EXC", exc)
        job = [x for x in exc if "ceiling" in x["text"].lower()]
        assert job and job[0]["text"][0].isupper(), exc
        assert job[0].get("source")
        CTX["chat"] = s

    def test_assistant_wording(self):
        s = CTX.get("chat") or pytest.skip("no chat session")
        bad = []
        for q in ["What is Alder's total price and how much per site?", "Which sites are still open and why?"]:
            t = reply_text(ask(s, q))
            print("Q", q, "->", t)
            for w in ["snapshot", "work_items", "checker", "_cents", "json"]:
                if w in t.lower():
                    bad.append((q, w))
            if "price" in q:
                assert re.search(r"\$\d{1,3}(,\d{3})+", t) or "$" in t, t
        assert not bad, bad
