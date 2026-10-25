# helper: dump state for a visitor/project (iter25 UI fresh path verification)
import json, os, sys, requests
B = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
vis, pid = sys.argv[1], sys.argv[2]
s = requests.Session(); s.headers["Origin"] = B
s.post(f"{B}/api/auth/login", json={"email": "organizer@demo.assemble.test", "password": "synthetic-demo", "visitor_id": vis})
s.headers["X-Project-Id"] = pid
sh = s.get(f"{B}/api/project").json()["sheet"]
print("REQS", [(r["req_id"], r["status"], r["origin"]) for r in sh["qual"]["requirements"]])
print("EXCL", [(x["text"], x["level"], x.get("source")) for x in sh.get("exclusions") or sh["qual"].get("exclusions") or []])
print("PARTNERS", [(p["partner_id"], p["name"], p.get("price_per_site_cents"), p.get("conditions")) for p in sh["intake"]["partners"]])
print("EVID", [(e["license_class"], e["observed_status"], e["observed_on"]) for e in sh["qual"]["evidence"]])
print("SEL", sh["project"].get("plan_selected"), "CUR", bool(sh.get("current")), "QUOTES", json.dumps(sh.get("quotes"))[:200])
if sh.get("current"):
    print("QUAL", {k: x["status"] for k, x in sh["current"]["qualification"]["sites"].items()})
print("LINKS", [(l.get("partner_id"), l.get("status"), l.get("token")) for l in (s.get(f"{B}/api/project/links").json().get("links") or [])])
