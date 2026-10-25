# Iteration 16: Stage 2 evidence graph (/api/project/graph), shortened invitation email preview, assistant meta (Jev removed)
import time
import uuid

import pytest

from test_stage123_security import BASE_URL, DB, NF, register, demo_org, sheet, sess

BRIEF = ("Two-site lighting replacement for Audit Retail. Start December 7, 2026. Two weeks beginning December 7 and "
         "December 14. North store is due December 13. South store is due December 20. Each store needs one crew-week. "
         "Customer budget ceiling is $30,000.")


def graph(s):
    r = s.get(f"{BASE_URL}/api/project/graph")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def N():
    a, ua = register("G")
    b, _ = register("H")
    pa = a.post(f"{BASE_URL}/api/projects", json={"name": "TEST Audit Retail"}).json()["project_id"]
    a.headers["X-Project-Id"] = pa
    r = a.post(f"{BASE_URL}/api/project/sources", json={"kind": "brief", "label": "TEST Audit brief", "text": BRIEF,
                                                       "source_date": "2026-11-01"}, timeout=180)
    assert r.status_code == 200, r.text
    rd = r.json()
    ids = [x["reading"]["fact_id"] for x in rd["readings"] if x.get("reading") and x["reading"]["status"] in ("proposed", "corrected")]
    assert ids, rd
    r = a.post(f"{BASE_URL}/api/project/readings/apply", json={"rev": sheet(a)["project"]["rev"], "fact_ids": ids})
    assert r.status_code == 200, r.text
    return {"a": a, "b": b, "pa": pa, "src": rd["sources"][-1]["source_id"]}


# Graph on a project built from a read brief
class TestGraphNew:
    def test_bands_and_edges(self, N):
        g = graph(N["a"])
        print({k: [n["label"] for n in g["nodes"] if n["band"] == k] for k in range(4)})
        print(g["edges"])
        ids = {n["id"] for n in g["nodes"]}
        assert all(n["band"] in (0, 1, 2, 3) for n in g["nodes"])
        assert f"src:{N['src']}" in ids
        chg = [n for n in g["nodes"] if n["band"] == 1]
        assert chg and all(n["sub"] == "applied fact" for n in chg)
        sites = [n for n in g["nodes"] if n["band"] == 2]
        assert len(sites) == 2, sites
        e = {(x["from"], x["to"]) for x in g["edges"]}
        assert all(a in ids and b in ids for a, b in e)
        src_chg = {b for a, b in e if a == f"src:{N['src']}"}
        assert src_chg
        assert any((c, s["id"]) in e for c in src_chg for s in sites), "no source->change->site path"

    def test_cross_firm_404(self, N):
        x = sess()
        x.cookies.update(N["b"].cookies)
        x.headers["X-Project-Id"] = N["pa"]
        r = x.get(f"{BASE_URL}/api/project/graph")
        assert r.status_code == 404 and r.json()["detail"] == NF and "nodes" not in r.text

    def test_anon_401(self, N):
        import requests
        r = requests.get(f"{BASE_URL}/api/project/graph", headers={"X-Project-Id": N["pa"]})
        assert r.status_code == 401


@pytest.fixture(scope="module")
def C():
    s = demo_org("t16-" + uuid.uuid4().hex[:10])
    projs = s.get(f"{BASE_URL}/api/projects").json()["projects"]
    s.headers["X-Project-Id"] = projs[0]["project_id"]
    sh = sheet(s)
    r = s.post(f"{BASE_URL}/api/project/draft", json={"select": True, "rev": sh["project"]["rev"], "partner_ids": ["alder", "birch", "cedar", "redwood"]})
    assert r.status_code == 200, r.text
    return {"s": s, "sheet": r.json()["sheet"]}


# Graph in canonical 12-site demo after a checked draft
class TestGraphCanonical:
    def test_sites_to_firms(self, C):
        g = graph(C["s"])
        sites = [n for n in g["nodes"] if n["band"] == 2]
        firms = {n["id"]: n for n in g["nodes"] if n["band"] == 3}
        assert len(sites) == 12
        e = {(x["from"], x["to"]) for x in g["edges"]}
        owners = {b for a, b in e if a.startswith("site:")}
        assert owners and owners <= set(firms), (owners, set(firms))
        assert "firm:alder" in firms
        assert all(firms[f]["sub"] != "not in plan" for f in owners)

    def test_private_draft_nodes(self, C):
        s = C["s"]
        sh = sheet(s)
        r = s.post(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"]})
        assert r.status_code == 200, r.text
        sh = r.json()["sheet"]
        sites = sh["preview"]["version"]["assignments"] if "version" in sh["preview"] else None
        cur = sh["current"]["version"]["assignments"]
        # move first site owned by alder to another week
        sid, a = next((k, v) for k, v in cur.items() if v.get("owner") == "alder")
        dl = {x["site_id"]: x.get("deadline_week") for x in sh["preview"]["version"]["sites"]}
        body_sites = [{"site_id": k, "owner": v["owner"], "week": v["week"], "deadline_week": dl[k]} for k, v in cur.items()]
        for x in body_sites:
            if x["site_id"] == sid:
                x["week"] = 2 if a["week"] != 2 else 1
        r = s.put(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"], "sites": body_sites})
        print(r.status_code, r.text[:300])
        assert r.status_code == 200, r.text
        g = graph(s)
        mv = [n for n in g["nodes"] if n["sub"] == "private draft"]
        print(mv)
        assert [n["id"] for n in mv] == [f"mv:{sid}"], mv
        e = {(x["from"], x["to"]) for x in g["edges"]}
        assert (f"mv:{sid}", f"site:{sid}") in e, (sid, mv)
        r = s.post(f"{BASE_URL}/api/project/preview/discard", json={"rev": sheet(s)["project"]["rev"]})
        assert r.status_code == 200
        assert not [n for n in graph(s)["nodes"] if n["sub"] == "private draft"]


# Shortened invitation email preview (no send)
class TestEmailPreview:
    def test_preview_text(self, C):
        s = C["s"]
        r = s.post(f"{BASE_URL}/api/project/links", json={"partner_id": "alder"})
        assert r.status_code == 200, r.text
        tok = r.json()["link"]["token"]
        r = s.post(f"{BASE_URL}/api/project/links/{tok}/email-preview")
        assert r.status_code == 200, r.text
        d = r.json()
        print(d)
        job = sheet(s)["project"]["name"]
        assert d["subject"] == f"Review your terms: {job}"
        assert d["text"].endswith(f"to review sites, dates and price for {job}.")
        assert " asks " in d["text"] and d["text"].count(".") <= 2 + job.count(".")
        assert d["sendable"] is False


# Assistant meta: model + elapsed only (no Jev topics)
class TestAssistantMeta:
    def test_meta(self, C):
        s = C["s"]
        t = time.time()
        r = s.post(f"{BASE_URL}/api/project/assistant", json={"message": "Why is Alder needed?", "rev": sheet(s)["project"]["rev"]},
                   timeout=150)
        print(f"{time.time()-t:.1f}s", r.text[:500])
        if r.status_code == 429:
            pytest.skip("capacity")
        assert r.status_code == 200, r.text
        rep = r.json()["reply"]
        assert rep["mode"] in ("explain", "error")
        assert "topics" not in (rep.get("meta") or {}), rep.get("meta")
        assert "model" in rep["meta"] and "elapsed_ms" in rep["meta"]
