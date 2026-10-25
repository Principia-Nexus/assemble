# Iteration 27: fresh-project completion repairs (deterministic checks; no LLM)
import os
import sys
import uuid

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import logic as L  # noqa: E402
import extract_routes as X  # noqa: E402
from fresh_flow import BASE, login  # noqa: E402

P = f"{BASE}/api/project"


def version(assign, sites=None, **kw):
    sites = sites or [{"site_id": "S01", "deadline_week": 1, "access_start": "2026-11-02", "access_end": "2026-11-06"},
                      {"site_id": "S02", "deadline_week": 2, "access_start": "2026-11-09", "access_end": "2026-11-13"}]
    return {"weeks": 2, "start_date": "2026-11-02", "sites": sites, "assignments": assign, "budget_ceiling_cents": 3000000,
            "partners": [{"partner_id": "p_a", "name": "A", "price_per_site_cents": 1000000, "capacity": [2, 2], "max_sites": 2}], **kw}


def rule(ch, key):
    return next(r for r in ch["rules"] if r["key"] == key)


def test_unassigned_site_fails_schedule_and_narrowed_passes():
    v = version({"S01": {"owner": "p_a", "week": 1}, "S02": {"owner": None, "week": None}})
    assert rule(L.check(v), "crew_week")["status"] == "fail"
    assert "S02 is unassigned." in rule(L.check(v), "crew_week")["details"]
    assert rule(L.check({**v, "narrowed": ["S02"]}), "crew_week")["status"] == "pass"


def test_access_conflict_and_window():
    v = version({"S01": {"owner": "p_a", "week": 1}, "S02": {"owner": "p_a", "week": 1}})
    ac = rule(L.check(v), "access")
    assert ac["status"] == "fail" and ac["details"][0].startswith("Access conflict: S02")
    ok = version({"S01": {"owner": "p_a", "week": 1}, "S02": {"owner": "p_a", "week": 2}})
    assert rule(L.check(ok), "access")["status"] == "pass"


def test_cost_lines_in_total_and_unknown_price_incomplete():
    v = version({"S01": {"owner": "p_a", "week": 1}, "S02": {"owner": "p_a", "week": 2}}, coordination_cents=200000, contingency_cents=100000)
    ch = L.check(v)
    assert ch["total_cents"] == 2300000
    assert "Firms $20,000 + coordination $2,000 + contingency $1,000 = $23,000." in rule(ch, "ceiling")["details"]
    v["partners"][0]["price_per_site_cents"] = None
    ch = L.check(v)
    assert ch["total_cents"] is None and rule(ch, "ceiling")["status"] == "unknown"


def test_access_windows_fill_job_and_generator_respects_them():
    it = {"start_date": None, "weeks": None, "sites": [
        {"site_id": "S01", "access_start": "2026-11-02", "access_end": "2026-11-06", "deadline_week": None},
        {"site_id": "S09", "access_start": "2026-11-16", "access_end": "2026-11-20", "deadline_week": None}]}
    L.derive_from_access(it)
    assert it["start_date"] == "2026-11-02" and it["weeks"] == 3
    assert [s["deadline_week"] for s in it["sites"]] == [1, 3]
    it.update(own_capacity=[0, 0, 0], partners=[{"partner_id": "p_a", "name": "A", "price_per_site_cents": 1, "capacity": [2, 2, 2]}])
    a, _ = L.generate(it, ["p_a"], False)
    assert a["S09"]["week"] == 3 and a["S01"]["week"] == 1


def test_undated_source_does_not_outrank_dated():
    base = {"status": "proposed", "target": "t", "label": "x", "field": "site_scope", "scope": "site", "partner_name": None,
            "site_id": "S01", "week": None, "created_at": "2026-10-01"}
    dated = {**base, "fact_id": "a", "source_id": "s1", "parsed": "From drawing", "source_order": "2026-10-05-0001"}
    undated = {**base, "fact_id": "b", "source_id": "s2", "parsed": "From note", "source_order": "0000-0002", "created_at": "2026-10-09"}
    r = X.readings_from([dated, undated])[0]
    assert r["reading"]["fact_id"] == "a"


def test_condition_sites_kept_through_intake():
    it, e = L.validate_intake({"sites": [{"site_id": "S01"}], "partners": [], "job_conditions": [{"text": "Central needs badge access", "sites": ["s01"]}]})
    assert not e and it["job_conditions"][0]["sites"] == ["S01"]
    assert L.open_conditions(it)[0]["scope"] == "S01"


def _org():
    s = login("organizer@demo.assemble.test", "t27-" + uuid.uuid4().hex[:8])
    r = s.post(f"{BASE}/api/projects", json={"name": "TEST t27 items"})
    s.headers["X-Project-Id"] = r.json()["project_id"]
    return s


def test_rapid_task_edits_persist_and_date_range_rejected():
    s = _org()
    rev = s.get(P).json()["sheet"]["project"]["rev"] if "sheet" in s.get(P).json() else s.get(P).json()["project"]["rev"]
    r = s.post(f"{P}/items/ops", json={"rev": rev, "ops": [{"op": "create", "kind": "task", "fields": {"title": "Order fixtures"}}], "summary": "add"})
    assert r.status_code == 200, r.text
    iid, rev = r.json()["items"][0]["item_id"], r.json()["rev"]
    for f in ({"title": "Order LED fixtures"}, {"start_date": "2026-11-02"}, {"due_date": "2026-11-06"}, {"date_kind": "target"}, {"notes": "Confirm lead time"}):
        r = s.post(f"{P}/items/ops", json={"rev": rev, "ops": [{"op": "update", "item_id": iid, "fields": f}], "summary": "edit"})
        assert r.status_code == 200, r.text
        rev = r.json()["rev"]
    stale = s.post(f"{P}/items/ops", json={"rev": rev - 1, "ops": [{"op": "update", "item_id": iid, "fields": {"title": "Stale"}}], "summary": "stale"})
    assert stale.status_code == 409
    it = next(i for i in s.get(f"{P}/items").json()["items"] if i["item_id"] == iid)
    assert (it["title"], it["start_date"], it["due_date"], it["date_kind"], it["notes"]) == ("Order LED fixtures", "2026-11-02", "2026-11-06", "target", "Confirm lead time")
    bad = s.post(f"{P}/items/ops", json={"rev": rev, "ops": [{"op": "update", "item_id": iid, "fields": {"due_date": "2026-11-01"}}], "summary": "bad"})
    assert bad.status_code == 422 and "before the start date" in bad.text
