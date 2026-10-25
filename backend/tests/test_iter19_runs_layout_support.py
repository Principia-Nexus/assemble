# Iteration 19: async assistant runs (queue/cancel/advance), rule packs, layout, quote partner support/override, customer ask, PDF coverage
import os
import sys
import time
import uuid

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from test_iter17_workspace_quote_media import BASE_URL, FIELDS, future, solo_org  # noqa: E402
from pdf_sample import make_pdf  # noqa: E402

A = f"{BASE_URL}/api/project/assistant"


def demo_org(prefix="t19"):
    s = requests.Session()
    s.headers["Origin"] = BASE_URL
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "organizer@demo.assemble.test", "password": "synthetic-demo",
                                                   "visitor_id": f"{prefix}-" + uuid.uuid4().hex[:12]})
    assert r.status_code == 200, r.text
    return s


def rev(s):
    return s.get(f"{BASE_URL}/api/project").json()["sheet"]["project"]["rev"]


def wait_run(s, run_id, limit=150):
    t0 = time.time()
    while time.time() - t0 < limit:
        j = s.get(f"{A}/runs/{run_id}").json()
        if j["run"]["status"] not in ("queued", "working", "committing") and j.get("reply"):
            return j
        time.sleep(2)
    pytest.fail(f"run {run_id} did not finish")


# ---- sheet rule pack versions
def test_sheet_rules():
    s = demo_org()
    j = s.get(f"{BASE_URL}/api/project").json()["sheet"]
    assert j["rules"]["checker"] == "crew-week-checker-1"
    assert j["rules"]["packs"] == ["2026-10-25.1"]


# ---- async runs: queue + cancel queued + explain reply with packs
class TestRuns:
    def test_queue_and_cancel(self):
        s = demo_org()
        r1 = s.post(A, json={"message": "What is the total of the current plan?", "rev": rev(s), "async_run": True})
        assert r1.status_code == 200, r1.text
        run1 = r1.json()["run"]
        assert run1["status"] == "queued" and run1["run_id"].startswith("run")
        r2 = s.post(A, json={"message": "Which sites are due in week 1?", "rev": rev(s), "async_run": True})
        run2 = r2.json()["run"]
        time.sleep(1.5)
        st2 = s.get(f"{A}/runs/{run2['run_id']}").json()["run"]["status"]
        assert st2 == "queued", st2
        h = s.get(A).json()
        assert {x["run_id"] for x in h["active_runs"]} >= {run2["run_id"]}
        c = s.post(f"{A}/runs/{run2['run_id']}/cancel")
        assert c.status_code == 200, c.text
        assert c.json()["run"]["status"] == "stopped"
        time.sleep(1.5)
        j2 = s.get(f"{A}/runs/{run2['run_id']}").json()
        assert j2["run"]["status"] == "stopped"
        assert j2["reply"] and j2["reply"]["text"] == "Stopped. Nothing was changed."
        # second cancel -> 422 already finished
        c2 = s.post(f"{A}/runs/{run2['run_id']}/cancel")
        assert c2.status_code == 422
        j1 = wait_run(s, run1["run_id"])
        assert j1["run"]["status"] in ("draft_ready", "needs_input"), j1["run"]
        assert j1["reply"]["meta"]["packs"] and all("@" in x for x in j1["reply"]["meta"]["packs"])
        assert j1["run"]["packs"] == j1["reply"]["meta"]["packs"]
        assert j1["reply"]["meta"]["checker"] == "crew-week-checker-1"

    def test_cancel_unknown_404(self):
        s = demo_org()
        assert s.post(f"{A}/runs/run_nope/cancel").status_code == 404
        assert s.get(f"{A}/runs/run_nope").status_code == 404

    def test_advance_mode(self):
        s = demo_org()
        r = s.post(A, json={"message": "Assign all the sites to firms and move it forward", "rev": rev(s), "async_run": True})
        j = wait_run(s, r.json()["run"]["run_id"], limit=200)
        rep = j["reply"]
        assert rep["mode"] == "advance", rep
        assert rep["wrote"] is True, rep
        assert "Drafted v" in rep["text"], rep["text"]
        assert "nothing was selected or sent" in rep["text"] or "Nothing was sent" in rep["text"] or "no review links" in rep["text"] or "amendment" in rep["text"], rep["text"]
        sh = j["sheet"]
        v = sh.get("preview") or sh.get("current")
        assert v and len(v["version"]["assignments"]) >= 12
        # links prepared, none shared/sent
        for p in (sh.get("current") or {}).get("partners", []):
            assert p["status"] in ("link_not_shared", "no_link", "awaiting"), p


# ---- layout persistence
class TestLayout:
    def test_layout_save_and_validate(self):
        s = demo_org()
        r = s.put(f"{BASE_URL}/api/project/layout", json={"id": "itm_TEST1", "x": 40.4, "y": -12.6})
        assert r.status_code == 200 and r.json()["ok"]
        p = s.get(f"{BASE_URL}/api/project").json()
        lay = p["sheet"]["project"].get("layout") or p["sheet"].get("layout") or {}
        assert lay.get("itm_TEST1") == {"x": 40, "y": -13}, p["sheet"].keys()
        assert s.put(f"{BASE_URL}/api/project/layout", json={"id": "bad id$", "x": 1, "y": 1}).status_code == 422
        assert s.put(f"{BASE_URL}/api/project/layout", json={"id": "ok", "x": 99999, "y": 1}).status_code == 422


# ---- quote partner support + override, customer view hides support, customer ask
class TestQuoteSupport:
    @pytest.fixture(scope="class")
    def ctx(self):  # noqa
        s = demo_org()
        q = s.post(f"{BASE_URL}/api/project/quotes", json={}).json()["quote"]
        r = s.put(f"{BASE_URL}/api/project/quotes/{q['quote_id']}", json={"fields": {**FIELDS, "valid_until": future(), "price_cents": 90000}})
        assert r.status_code == 200, r.text
        return s, q

    def test_preview_support_and_issue_guard(self, ctx):
        s, q = ctx
        pv = s.get(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/preview").json()
        sup = pv["support"]
        assert sup["ok"] is False and sup["missing"] and all("text" in f for f in sup["firms"])
        r = s.post(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/issue", json={"digest": pv["digest"]})
        assert r.status_code == 422 and "must confirm the selected plan first" in r.text
        r = s.post(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/issue", json={"digest": pv["digest"], "override_reason": "Customer needs it today"})
        assert r.status_code == 422, "a written reason must not stand in for partner confirmation"
        solo = solo_org()
        sq = solo.post(f"{BASE_URL}/api/project/quotes", json={}).json()["quote"]
        solo.put(f"{BASE_URL}/api/project/quotes/{sq['quote_id']}", json={"fields": {**FIELDS, "valid_until": future(), "price_cents": 90000}})
        spv = solo.get(f"{BASE_URL}/api/project/quotes/{sq['quote_id']}/preview").json()
        assert spv["support"]["ok"] is True
        r = solo.post(f"{BASE_URL}/api/project/quotes/{sq['quote_id']}/issue", json={"digest": spv["digest"]})
        assert r.status_code == 200, r.text
        ctx_token = r.json()["path"].split("/quote/")[1]
        TestQuoteSupport.token = ctx_token

    def test_customer_view_no_support(self, ctx):
        tok = TestQuoteSupport.token
        c = requests.post(f"{BASE_URL}/api/quote/{tok}/code").json()
        sid = requests.post(f"{BASE_URL}/api/quote/{tok}/verify", json={"code": c["synthetic_code"]}).json()["session"]
        TestQuoteSupport.sid = sid
        v = requests.get(f"{BASE_URL}/api/quote/{tok}/view", headers={"X-Quote-Session": sid})
        assert v.status_code == 200
        j = v.json()
        assert "support" not in j and "support" not in (j.get("snapshot") or {})
        assert "override" not in v.text.lower()

    def test_customer_ask_unauth_401(self, ctx):
        r = requests.post(f"{BASE_URL}/api/quote/{TestQuoteSupport.token}/ask", json={"message": "hi"})
        assert r.status_code == 401

    def test_customer_ask_and_draft(self, ctx):
        h = {"X-Quote-Session": TestQuoteSupport.sid}
        r = requests.post(f"{BASE_URL}/api/quote/{TestQuoteSupport.token}/ask", json={"message": "What are the payment terms?"}, headers=h, timeout=90)
        assert r.status_code == 200, r.text
        a = r.json()
        assert "couldn't answer" not in a["answer"] and len(a["answer"]) > 5
        assert "30" in a["answer"] or "net" in a["answer"].lower(), a
        r = requests.post(f"{BASE_URL}/api/quote/{TestQuoteSupport.token}/ask", json={"message": "Change payment terms to Net 45", "draft_change": True}, headers=h, timeout=90)
        assert r.status_code == 200, r.text
        assert r.json()["change_request"] and "45" in r.json()["change_request"]


# ---- PDF page-by-page reading record
def test_pdf_two_pages_coverage():
    s = demo_org()
    pdf = make_pdf([["Quote from TEST Firm", "Price per site 900 USD"], ["Page two terms", "Valid for 30 days"]])
    r = s.post(f"{BASE_URL}/api/project/sources/upload", files={"file": ("two.pdf", pdf, "application/pdf")},
               data={"kind": "quote", "label": "TEST two-page", "source_date": ""}, timeout=200)
    assert r.status_code == 200, r.text
    allsrc = s.get(f"{BASE_URL}/api/project/readings").json()["sources"]
    src = next((x for x in allsrc if x.get("label") == "TEST two-page"), None)
    assert src, [x.get("label") for x in allsrc]
    assert len(src["manifest"]) == 2
    cov = src["coverage"]
    print(cov)
    assert cov.get("readable") == 2 and cov.get("total") == 2, cov
