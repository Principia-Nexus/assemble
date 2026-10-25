# Iteration 20 (testing agent): edge cases for async assistant runs, layout validation/scoping, and the partner-support quote gate
import time

import requests

from test_iter17_workspace_quote_media import BASE_URL, FIELDS, future, solo_org
from test_iter19_runs_layout_support import A, demo_org, rev

LAY = f"{BASE_URL}/api/project/layout"


def sheet(s):
    return s.get(f"{BASE_URL}/api/project").json()["sheet"]


# ---- runs: stale rev, cancel lifecycle, active_runs shape
class TestRunEdges:
    def test_stale_rev_409(self):
        s = demo_org("t20")
        r = s.post(A, json={"message": "Summarize the plan", "rev": rev(s) - 1 if rev(s) > 0 else 9999, "async_run": True})
        assert r.status_code == 409, r.text

    def test_cancel_queued_saves_stopped_message(self):
        s = demo_org("t20")
        r1 = s.post(A, json={"message": "What is still open?", "rev": rev(s), "async_run": True}).json()["run"]
        r2 = s.post(A, json={"message": "Which sites are due in week 2?", "rev": rev(s), "async_run": True}).json()["run"]
        h = s.get(A).json()
        ids = {x["run_id"] for x in h["active_runs"]}
        assert r2["run_id"] in ids
        c = s.post(f"{A}/runs/{r2['run_id']}/cancel")
        assert c.status_code == 200, c.text
        for _ in range(20):
            j = s.get(f"{A}/runs/{r2['run_id']}").json()
            if j["run"]["status"] == "stopped" and j.get("reply"):
                break
            time.sleep(1)
        assert j["run"]["status"] == "stopped"
        assert j["reply"]["text"] == "Stopped. Nothing was changed."
        msgs = s.get(A).json()["messages"]
        assert any(m.get("text") == "Stopped. Nothing was changed." for m in msgs)
        s.post(f"{A}/runs/{r1['run_id']}/cancel")

    def test_other_visitor_cannot_read_run(self):
        s = demo_org("t20")
        r1 = s.post(A, json={"message": "Summarize", "rev": rev(s), "async_run": True}).json()["run"]
        o = demo_org("t20o")
        assert o.get(f"{A}/runs/{r1['run_id']}").status_code in (403, 404)
        assert o.post(f"{A}/runs/{r1['run_id']}/cancel").status_code in (403, 404)
        s.post(f"{A}/runs/{r1['run_id']}/cancel")


# ---- layout validation + scoping per project
class TestLayoutEdges:
    def test_y_bound_and_types(self):
        s = demo_org("t20")
        assert s.put(LAY, json={"id": "plan-alder", "x": 1, "y": -20001}).status_code == 422
        assert s.put(LAY, json={"id": "plan-alder", "x": "abc", "y": 1}).status_code == 422
        assert s.put(LAY, json={"x": 1, "y": 1}).status_code == 422

    def test_layout_scoped_per_project(self):
        s = demo_org("t20")
        assert s.put(LAY, json={"id": "plan-alder", "x": 200, "y": 50}).status_code == 200
        lay = sheet(s)["project"]["layout"]
        assert lay["plan-alder"] == {"x": 200, "y": 50}
        pid = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST_layout other"}).json()["project_id"]
        s.headers["X-Project-Id"] = pid
        assert not (sheet(s)["project"].get("layout") or {}).get("plan-alder")


# ---- quote gate: override_reason ignored, partner-less project can issue
class TestQuoteGate:
    def test_override_reason_still_422_on_unconfirmed_plan(self):
        s = demo_org("t20")
        sh = sheet(s)
        d = s.post(f"{BASE_URL}/api/project/draft", json={"rev": sh["project"]["rev"], "partner_ids": [p["partner_id"] for p in sh["intake"]["partners"]], "include_own": True})
        assert d.status_code == 200, d.text
        if d.json()["sheet"].get("preview"):
            pass
        q = s.post(f"{BASE_URL}/api/project/quotes", json={"amend_of": None})
        if q.status_code != 200:
            raise AssertionError(q.text)
        qid = q.json()["quote"]["quote_id"]
        s.put(f"{BASE_URL}/api/project/quotes/{qid}", json={"fields": {**FIELDS, "valid_until": future(), "price_cents": 100000}})
        pv = s.get(f"{BASE_URL}/api/project/quotes/{qid}/preview").json()
        assert pv.get("support"), pv
        r = s.post(f"{BASE_URL}/api/project/quotes/{qid}/issue", json={"digest": pv["digest"], "override_reason": "Need it today"})
        assert r.status_code == 422, r.text

    def test_solo_issue_ok(self):
        s = solo_org()
        q = s.post(f"{BASE_URL}/api/project/quotes", json={"amend_of": None}).json()["quote"]
        s.put(f"{BASE_URL}/api/project/quotes/{q['quote_id']}", json={"fields": {**FIELDS, "valid_until": future(), "price_cents": 5000}})
        pv = s.get(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/preview").json()
        r = s.post(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/issue", json={"digest": pv["digest"]})
        assert r.status_code == 200 and r.json()["quote"]["state"] == "issued"
