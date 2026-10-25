import json
import sys

from fresh_flow import BASE, P, login, sheet

visitor, pid = sys.argv[1], sys.argv[2]
s = login("organizer@demo.assemble.test", visitor)
s.headers["X-Project-Id"] = pid
sh = sheet(s)
alder = next(p["partner_id"] for p in sh["intake"]["partners"] if "alder" in p["name"].lower())
r = s.post(f"{P}/plan/assign", json={"rev": sh["project"]["rev"], "site_id": "S09", "owner": alder, "week": 1})
sh = r.json()["sheet"]
acc = next((x for x in sh["preview"]["checker"]["rules"] if x["key"] == "access"), None)
sel = s.post(f"{P}/preview/select", json={"rev": sh["project"]["rev"], "expected_version_id": sh["preview"]["version"]["version_id"]})
out = {"assign": r.status_code, "access_rule": acc and (acc["status"], acc["details"][:2]), "select_status": sel.status_code, "select_detail": sel.text[:200]}
print(json.dumps(out))
json.dump(out, open("/app/test_reports/fresh_access_gate.json", "w"), indent=1)
