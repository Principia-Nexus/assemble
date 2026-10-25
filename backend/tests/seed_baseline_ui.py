# Helper (not a test): put visitor sandbox into "baseline A+B+C confirmed" state for UI tests. Usage: python seed_baseline_ui.py <visitor_id>
import sys
import uuid
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from test_assemble_flow import BASE_URL, login, get_sheet  # noqa: E402

V = sys.argv[1]
org = login("organizer", visitor=V)
org.post(f"{BASE_URL}/api/project/demo-reset")
sh = get_sheet(org)
sh = org.post(f"{BASE_URL}/api/project/draft", json={"select": True, "rev": sh["project"]["rev"], "partner_ids": ["alder", "birch", "cedar"]}).json()["sheet"]
for pid in ("alder", "birch", "cedar"):
    tok = org.post(f"{BASE_URL}/api/project/links", json={"partner_id": pid}).json()["link"]["token"]
    s = login(pid, visitor=V)
    d = s.get(f"{BASE_URL}/api/review/{tok}").json()
    r = s.post(f"{BASE_URL}/api/review/{tok}/respond", json={"version_id": d["version"]["version_id"], "terms_hash": d["terms_hash"],
               "action": "confirm", "idempotency_key": uuid.uuid4().hex})
    assert r.status_code == 200, r.text
if len(sys.argv) > 2 and sys.argv[2] == "historic":
    # Cedar requests a change, then a selected amendment moves all Cedar sites to Redwood -> Cedar CR becomes historic
    tok = org.post(f"{BASE_URL}/api/project/links", json={"partner_id": "cedar"}).json()["link"]["token"]
    sh = get_sheet(org)
    sh = org.post(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"]}).json()["sheet"]
    pv = sh["preview"]["version"]
    rows = [{"site_id": s["site_id"], "owner": "redwood" if pv["assignments"][s["site_id"]]["owner"] == "cedar" else pv["assignments"][s["site_id"]]["owner"],
             "week": pv["assignments"][s["site_id"]]["week"], "deadline_week": s["deadline_week"]} for s in pv["sites"]]
    # discard first, create CR on current plan via cedar, then redo
    org.post(f"{BASE_URL}/api/project/preview/discard", json={"rev": sh["project"]["rev"]})
    s = login("cedar", visitor=V)
    d = s.get(f"{BASE_URL}/api/review/{tok}").json()
    s.post(f"{BASE_URL}/api/review/{tok}/respond", json={"version_id": d["version"]["version_id"], "terms_hash": d["terms_hash"],
           "action": "request_change", "note": "TEST_ historic cedar ask", "proposed_total": "60000", "idempotency_key": uuid.uuid4().hex})
    sh = get_sheet(org)
    sh = org.post(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"]}).json()["sheet"]
    sh = org.put(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"], "sites": rows, "adjustments": {}}).json()["sheet"]
    r = org.post(f"{BASE_URL}/api/project/preview/select", json={"rev": sh["project"]["rev"], "expected_version_id": sh["preview"]["version"]["version_id"]})
    assert r.status_code == 200, r.text
print("seeded", V, get_sheet(org)["current"]["checker"]["total_cents"])
