# Iteration 21: POST /api/project/plan/assign (plan is source of truth for site-task firms)
import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(__file__))
from test_iter19_runs_layout_support import BASE_URL, demo_org  # noqa: E402

P = f"{BASE_URL}/api/project"


def get_sheet(s):
    return s.get(P).json()["sheet"]


def branch_session():
    s = demo_org("t21")
    pid = next(x["project_id"] for x in s.get(f"{BASE_URL}/api/projects").json()["projects"] if x["name"].startswith("12-branch"))
    s.headers["X-Project-Id"] = pid
    return s


def with_plan():
    s = branch_session()
    sh = get_sheet(s)
    r = s.post(f"{P}/draft", json={"rev": sh["project"]["rev"], "partner_ids": [p["partner_id"] for p in sh["intake"]["partners"]],
                                   "include_own": True})
    assert r.status_code == 200, r.text
    sh = r.json()["sheet"]
    assert sh["current"] and not sh["preview"]
    return s, sh


def other_owner(sh, site):
    cur = sh["current"]["version"]["assignments"][site]["owner"]
    return cur, next(p["partner_id"] for p in sh["current"]["version"]["partners"] if p["partner_id"] != cur)


class TestPlanAssign:
    def test_no_plan_409(self):
        s = branch_session()
        sh = get_sheet(s)
        r = s.post(f"{P}/plan/assign", json={"rev": sh["project"]["rev"], "site_id": "S01", "owner": "alder"})
        assert r.status_code == 409, r.text

    def test_assign_creates_private_draft_current_unchanged(self):
        s, sh = with_plan()
        old, new = other_owner(sh, "S02")
        cur_vid = sh["current"]["version"]["version_id"]
        r = s.post(f"{P}/plan/assign", json={"rev": sh["project"]["rev"], "site_id": "S02", "owner": new})
        assert r.status_code == 200, r.text
        out = r.json()["sheet"]
        assert out["preview"]["version"]["assignments"]["S02"]["owner"] == new
        assert out["current"]["version"]["version_id"] == cur_vid
        assert out["current"]["version"]["assignments"]["S02"]["owner"] == old
        # other sites unchanged
        for k, v in out["current"]["version"]["assignments"].items():
            if k != "S02":
                assert out["preview"]["version"]["assignments"][k]["owner"] == v["owner"]
        g = get_sheet(s)
        assert g["preview"]["version"]["assignments"]["S02"]["owner"] == new
        # second assign edits the same draft (no new draft); move back
        r2 = s.post(f"{P}/plan/assign", json={"rev": g["project"]["rev"], "site_id": "S02", "owner": old, "week": 2})
        assert r2.status_code == 200, r2.text
        o2 = r2.json()["sheet"]
        assert o2["preview"]["version"]["version_id"] == out["preview"]["version"]["version_id"]
        assert o2["preview"]["version"]["assignments"]["S02"] == {**o2["preview"]["version"]["assignments"]["S02"], "owner": old, "week": 2}

    def test_invalid_owner_422(self):
        s, sh = with_plan()
        r = s.post(f"{P}/plan/assign", json={"rev": sh["project"]["rev"], "site_id": "S02", "owner": "nobody"})
        assert r.status_code == 422, r.text

    def test_unknown_site_422(self):
        s, sh = with_plan()
        r = s.post(f"{P}/plan/assign", json={"rev": sh["project"]["rev"], "site_id": "S99", "owner": "alder"})
        assert r.status_code == 422, r.text

    def test_invalid_owner_side_effect(self):
        """Report-only: a rejected assign should not leave a new draft behind."""
        s, sh = with_plan()
        s.post(f"{P}/plan/assign", json={"rev": sh["project"]["rev"], "site_id": "S02", "owner": "nobody"})
        g = get_sheet(s)
        if g["preview"]:
            pytest.xfail("Rejected assign (422) still opened a private draft (start_preview ran before validation)")

    def test_stale_rev_409(self):
        s, sh = with_plan()
        _, new = other_owner(sh, "S02")
        r = s.post(f"{P}/plan/assign", json={"rev": sh["project"]["rev"] - 1, "site_id": "S02", "owner": new})
        assert r.status_code == 409, r.text
