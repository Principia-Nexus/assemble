# Helper to drive an isolated demo sandbox (by visitor_id) into specific states for UI testing.
# Usage: python assemble_state.py <visitor_id> <stage>  stages: draft | links | answer:<ids> | preview
import os, sys, uuid, requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
PW = "synthetic-demo"
VID = sys.argv[1]


def login(email):
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json={"email": email, "password": PW, "visitor_id": VID})
    r.raise_for_status()
    return s


def sheet(s):
    return s.get(f"{BASE}/project").json()["sheet"]


def main():
    org = login("organizer@demo.assemble.test")
    for stage in sys.argv[2:]:
        sh = sheet(org)
        if stage == "draft":
            r = org.post(f"{BASE}/project/draft", json={"rev": sh["project"]["rev"], "partner_ids": ["alder", "birch", "cedar"], "include_own": True})
            print("draft", r.status_code, r.json().get("sheet", {}).get("current", {}).get("checker", {}).get("total_cents"))
        elif stage == "links":
            for p in sh["current"]["partners"]:
                if not p.get("link"):
                    r = org.post(f"{BASE}/project/links", json={"partner_id": p["partner_id"]})
                    print("link", p["partner_id"], r.status_code)
        elif stage.startswith("answer:"):
            ids = stage.split(":")[1].split(",")
            for p in sh["current"]["partners"]:
                pid = p["partner_id"]
                if pid not in ids:
                    continue
                ps = login(f"{pid}@demo.assemble.test")
                tok = p["link"]["token"]
                d = ps.get(f"{BASE}/review/{tok}").json()
                cond = "Need site access by 7am" if pid == ids[0] else None
                r = ps.post(f"{BASE}/review/{tok}/respond", json={"version_id": d["version"]["version_id"], "terms_hash": d["terms_hash"], "action": "confirm",
                                                              "note": "ok", "conditions": cond, "proposed_total": None, "idempotency_key": str(uuid.uuid4())})
                print("answer", pid, r.status_code, r.text[:120] if r.status_code != 200 else "")
        elif stage == "preview":
            demo = requests.get(f"{BASE}/demo/content").json() if False else None
            cc = {"note": "Customer asks to move S09 and S10 into week 1", "moves": [{"site_id": "S09", "new_week": "1"}, {"site_id": "S10", "new_week": "1"}]}
            r = org.post(f"{BASE}/project/change-requests", json=cc)
            print("cr", r.status_code, r.text[:150] if r.status_code != 200 else "")
            sh = r.json()["sheet"]
            cr = [c for c in sh["change_requests"] if c["status"] == "open" and not c.get("partner_id")][0]
            r = org.post(f"{BASE}/project/preview", json={"rev": sh["project"]["rev"], "change_request_id": cr["cr_id"]})
            print("preview", r.status_code, r.text[:150] if r.status_code != 200 else "")
    sh = sheet(org)
    cur = sh.get("current")
    print("STATE v", cur and cur["version"]["number"], cur and cur["checker"]["overall"], [(p["partner_id"], p["status"]) for p in (cur or {}).get("partners", [])], "preview:", bool(sh.get("preview")))


main()
