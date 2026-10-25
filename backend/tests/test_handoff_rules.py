# Handoff round: negative payments, guarded selection, blocked links, job-wide conditions, carried response times
import uuid
import requests

from test_assemble_flow import BASE_URL, login, get_sheet, status_map, to_raw

V = "test-" + uuid.uuid4().hex[:16]


def rows(pv, owners=None):
    owners = owners or {}
    return [{"site_id": s["site_id"], "owner": owners.get(s["site_id"], pv["assignments"][s["site_id"]]["owner"]),
             "week": pv["assignments"][s["site_id"]]["week"], "deadline_week": s["deadline_week"]} for s in pv["sites"]]


def confirm(pid, tok):
    s = login(pid, visitor=V)
    d = s.get(f"{BASE_URL}/api/review/{tok}").json()
    r = s.post(f"{BASE_URL}/api/review/{tok}/respond", json={"version_id": d["version"]["version_id"],
               "terms_hash": d["terms_hash"], "action": "confirm", "idempotency_key": uuid.uuid4().hex})
    assert r.status_code == 200, r.text


def test_handoff_rules():
    org = login("organizer", visitor=V)
    sh = get_sheet(org)
    # failing plan: links blocked
    r = org.post(f"{BASE_URL}/api/project/draft", json={"rev": sh["project"]["rev"], "partner_ids": ["alder", "redwood"]})
    assert r.json()["sheet"]["current"]["checker"]["overall"] == "fail"
    r = org.post(f"{BASE_URL}/api/project/links", json={"partner_id": "alder"})
    assert r.status_code == 409 and "fails a check" in r.json()["detail"]
    # job-wide condition survives save and appears in checker
    it = to_raw(get_sheet(org)["intake"])
    it["job_conditions"] = [{"text": "After-hours access confirmed for every branch", "source": "brief", "resolved": False}]
    sh = get_sheet(org)
    r = org.put(f"{BASE_URL}/api/project/intake", json={"rev": sh["project"]["rev"], "intake": it})
    assert r.status_code == 200, r.text
    sh = r.json()["sheet"]
    assert any("After-hours" in c["text"] for c in sh["gap"]["open_conditions"])
    r = org.post(f"{BASE_URL}/api/project/draft", json={"rev": sh["project"]["rev"], "partner_ids": ["alder", "birch", "cedar"]})
    sh = r.json()["sheet"]
    chk = sh["current"]["checker"]
    assert chk["overall"] == "pass" and any(c["scope"] == "Job" for c in chk["open_conditions"])
    toks = {}
    for pid in ("alder", "birch", "cedar"):
        toks[pid] = org.post(f"{BASE_URL}/api/project/links", json={"partner_id": pid}).json()["link"]["token"]
        confirm(pid, toks[pid])
    sh = get_sheet(org)
    birch_at = next(p for p in sh["current"]["partners"] if p["partner_id"] == "birch")["response"]["created_at"]
    # customer change preview + Dogwood repair
    r = org.post(f"{BASE_URL}/api/project/change-requests", json={"note": "Move S09/S10 to week 1",
                 "moves": [{"site_id": "S09", "new_week": 1}, {"site_id": "S10", "new_week": 1}]})
    cr = r.json()["sheet"]["change_requests"][0]["cr_id"]
    sh = org.post(f"{BASE_URL}/api/project/preview", json={"rev": r.json()["sheet"]["project"]["rev"], "change_request_id": cr}).json()["sheet"]
    pv = sh["preview"]["version"]
    # failing preview cannot be selected
    r = org.post(f"{BASE_URL}/api/project/preview/select", json={"rev": sh["project"]["rev"]})
    assert r.status_code == 409 and "fails a check" in r.json()["detail"]
    sh = get_sheet(org)
    rep = rows(pv, {"S09": "dogwood", "S10": "dogwood"})
    # excessive discount rejected server-side
    r = org.put(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"], "sites": rep, "adjustments": {"alder": "-100000"}})
    assert r.status_code == 422 and "largest discount allowed is $28,000" in str(r.json())
    # zero boundary ok, then valid discount ok
    r = org.put(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"], "sites": rep, "adjustments": {"alder": "-28000"}})
    assert r.status_code == 200, r.text
    sh = r.json()["sheet"]
    assert next(x for x in sh["preview"]["checker"]["rules"] if x["key"] == "payments")["status"] == "pass"
    r = org.put(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"], "sites": rep, "adjustments": {"dogwood": "100000"}})
    sh = r.json()["sheet"]
    assert sh["preview"]["checker"]["overall"] == "fail" and sh["preview"]["checker"]["total_cents"] == 27200000
    r = org.put(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"], "sites": rep, "adjustments": {}})
    sh = r.json()["sheet"]
    assert sh["preview"]["checker"]["total_cents"] == 17200000
    # stale expected version rejected
    r = org.post(f"{BASE_URL}/api/project/preview/select", json={"rev": sh["project"]["rev"], "expected_version_id": "ver_wrong"})
    assert r.status_code == 409
    sh = get_sheet(org)
    r = org.post(f"{BASE_URL}/api/project/preview/select", json={"rev": sh["project"]["rev"], "expected_version_id": sh["preview"]["version"]["version_id"]})
    assert r.status_code == 200, r.text
    sh = r.json()["sheet"]
    st = status_map(sh)
    assert st["birch"] == "confirmed" and st["cedar"] == "confirmed" and st["alder"] == "needs_rereview"
    birch = next(p for p in sh["current"]["partners"] if p["partner_id"] == "birch")["response"]
    assert birch["carried_from"] and birch["responded_at"] == birch_at
    assert any(c["scope"] == "Job" for c in sh["current"]["checker"]["open_conditions"])
    org.post(f"{BASE_URL}/api/project/demo-reset")
