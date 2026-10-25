# Iteration 12: project status 'Awaiting partner review' after links; review link bound to its own project regardless of X-Project-Id.
from test_projects_multi import API, demo_login, get


def test_status_awaiting_and_review_link_scoped():
    s, v = demo_login()
    rows = {p["name"]: p["project_id"] for p in get(s, "/projects").json()["projects"]}
    can, six = rows["12-branch lighting retrofit"], rows["Six-store lighting refresh"]
    sh = get(s, "/project", can).json()["sheet"]
    ids = [p["partner_id"] for p in sh["intake"]["partners"]]
    r = s.post(f"{API}/project/draft", json={"rev": sh["project"]["rev"], "partner_ids": ids, "include_own": True}, headers={"X-Project-Id": can})
    assert r.status_code == 200, r.text
    cur = r.json()["sheet"]["current"]
    owner = next(p["partner_id"] for p in cur["partners"] if p["status"] != "not_in_plan") if cur["partners"] else None
    owners = {a["owner"] for a in cur["version"]["assignments"].values()} - {"__own__", "own"}
    pid = sorted(owners & set(ids))[0]
    r = s.post(f"{API}/project/links", json={"partner_id": pid}, headers={"X-Project-Id": can})
    assert r.status_code == 200, r.text
    token = r.json()["link"]["token"]
    st = {p["project_id"]: p["status"] for p in get(s, "/projects").json()["projects"]}
    assert st[can] == "Awaiting partner review", st
    assert st[six] == "Draft"
    # partner opens with X-Project-Id of six-store -> still sees can terms
    ps, _ = demo_login(v, f"{pid}@demo.assemble.test")
    rv = ps.get(f"{API}/review/{token}", headers={"X-Project-Id": six})
    assert rv.status_code == 200, rv.text
    assert "12-branch" in str(rv.json())
    # partner account cannot use project endpoints
    assert ps.get(f"{API}/project", headers={"X-Project-Id": can}).status_code == 403
