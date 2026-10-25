# Iteration 23: retest of fixes - qual _site_result, PUT quote preview merges, partial ack/decisions accumulate, batch PDF citations
import os
import re
import sys
import time

import pytest

sys.path.insert(0, os.path.dirname(__file__))
from test_iter19_runs_layout_support import BASE_URL, demo_org  # noqa: E402
from test_iter17_workspace_quote_media import FIELDS, future  # noqa: E402
from test_iter22_qualification import P, FUT, PAST, branch, draft, ev, get_sheet  # noqa: E402
from conftest import _db  # noqa: E402

sys.path.insert(0, "/app/backend")
from pdf_sample import make_pdf  # noqa: E402


def statuses(qa, pid):
    return {x["status"] for x in qa["sites"].values() if x["owner"] == pid}


# Qualification: second requirement without evidence -> evidence_needed; wrong class / expired -> does_not_fit
class TestQualFix:
    def test_c10_valid_plus_c39_missing_is_evidence_needed(self):
        s = branch()
        draft(s)
        s.post(f"{P}/requirements/sug-C-10/confirm")
        ev(s, "alder", "C-10", FUT)
        r = s.post(f"{P}/requirements", json={"code": "C-39"})
        assert r.status_code == 200, r.text
        qa = r.json()["sheet"]["current"]["qualification"]
        st = statuses(qa, "alder")
        if not st:
            pytest.skip("alder has no sites")
        assert st == {"evidence_needed"}, [x["reasons"] for x in qa["sites"].values() if x["owner"] == "alder"][0]

    def test_wrong_class_and_expired_still_does_not_fit(self):
        s = branch()
        draft(s)
        s.post(f"{P}/requirements/sug-C-10/confirm")
        ev(s, "birch", "C-10", PAST)
        sh = ev(s, "redwood", "C-33", FUT)
        qa = sh["current"]["qualification"]
        checked = 0
        for pid in ("birch", "redwood"):
            st = statuses(qa, pid)
            if st:
                checked += 1
                assert st == {"does_not_fit"}, (pid, st)
        assert checked, "neither birch nor redwood assigned"


# PUT /quotes/{id} preview merges job exclusions + not_covered like GET preview
class TestQuotePutPreview:
    def test_put_preview_has_merges_and_decisions_accumulate(self):
        s = branch()
        draft(s, keep_open=["S03"])
        s.post(f"{P}/exclusions", json={"text": "Ceiling repairs", "level": "job"})
        q = s.post(f"{P}/quotes", json={}).json()["quote"]
        qid = q["quote_id"]
        r = s.put(f"{P}/quotes/{qid}", json={"fields": {**FIELDS, "valid_until": future(), "price_cents": 90000,
                                                         "conditions": ["Access after hours", "Permit by city"]}})
        assert r.status_code == 200, r.text
        pv_put = r.json()["preview"]
        pv_get = s.get(f"{P}/quotes/{qid}/preview").json()
        assert "Ceiling repairs" in pv_put["exclusions"]
        assert any("S03" in n for n in pv_put["not_covered"])
        assert pv_put["exclusions"] == pv_get["snapshot"]["exclusions"]
        assert pv_put["not_covered"] == pv_get["snapshot"]["not_covered"]
        conds = [c["text"] for c in pv_get["readiness"]["conditions"]]
        assert len(conds) >= 2
        # partial ack true then false
        s.put(f"{P}/quotes/{qid}", json={"fields": {"partial_ack": True}})
        assert "Open scopes" not in " ".join(s.get(f"{P}/quotes/{qid}/preview").json()["readiness"]["blockers"])
        s.put(f"{P}/quotes/{qid}", json={"fields": {"partial_ack": False}})
        assert "Open scopes" in " ".join(s.get(f"{P}/quotes/{qid}/preview").json()["readiness"]["blockers"])


# PDF batch citations: pages 21-30 must cite their real page
class TestBatchCitations:
    def test_30_page_pdf_later_pages_cite_real_page(self):
        s = demo_org("t23pdf")
        pid = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST_cite30"}).json()["project_id"]
        s.headers["X-Project-Id"] = pid
        pages = []
        for p in range(1, 31):
            lines = [f"Page {p} Branch S{p % 12 + 1:02d} lighting retrofit specification section {p}."]
            while sum(len(x) for x in lines) < 1900:
                lines.append(f"Replace 2x4 troffer fixtures with LED panels at branch {p}, circuit {len(lines)} per drawing E-{p}.")
            pages.append(lines[:50])
        r = s.post(f"{P}/sources/upload", files={"file": ("cite30.pdf", make_pdf(pages), "application/pdf")},
                   data={"kind": "brief", "label": "TEST cite30", "source_date": ""}, timeout=180)
        assert r.status_code == 200, r.text
        src = r.json()["sources"][-1]
        sid = src["source_id"]
        t0 = time.time()
        while time.time() - t0 < 240:
            j = s.get(f"{P}/readings").json()
            cur = next(x for x in j["sources"] if x["source_id"] == sid)
            if not (cur.get("coverage") or {}).get("queued"):
                break
            time.sleep(5)
        print("COVERAGE", cur.get("coverage"))
        assert not (cur.get("coverage") or {}).get("queued"), cur.get("coverage")
        facts = list(_db.facts.find({"source_id": sid}, {"_id": 0}))
        print("FACTS", len(facts))
        wrong, later = [], 0
        for f in facts:
            loc = f.get("location") or {}
            ex = f.get("excerpt") or ""
            m = re.search(r"(?:drawing E-|branch |section |Page )(\d+)", ex)
            if not m or not loc.get("page"):
                continue
            real = int(m.group(1))
            if real > 20:
                later += 1
            print(real, loc.get("page"), ex[:80])
            if real != loc["page"]:
                wrong.append((real, loc, ex[:80]))
        assert not wrong, wrong
        if not later:
            pytest.skip("No facts from pages 21-30 extracted by LLM")
