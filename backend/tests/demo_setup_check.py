# Demo setup via the assistant on a fresh project, then a real-work guard check. Run: python tests/demo_setup_check.py
import json
import time
import uuid

from fresh_flow import BASE, P, login, sheet

s = login("organizer@demo.assemble.test", "demo-" + uuid.uuid4().hex[:8])
pid = s.post(f"{BASE}/api/projects", json={"name": "Demo lighting retrofit"}).json()["project_id"]
s.headers["X-Project-Id"] = pid


def ask(msg):
    r = s.post(f"{P}/assistant", json={"message": msg, "rev": sheet(s)["project"]["rev"], "async_run": True})
    assert r.status_code == 200, r.text
    run = r.json()["run"]
    for _ in range(120):
        d = s.get(f"{P}/assistant/runs/{run['run_id']}").json()
        if d["run"]["status"] not in ("queued", "working", "committing") and d.get("reply"):
            return d
        time.sleep(2)
    return d


d = ask("Build a fictional California lighting-retrofit demo: 6 sites over 3 weeks, 3 firms.")
sh = sheet(s)
it = sh["intake"]
out = {"project_id": pid, "reply_mode": d["reply"].get("mode"), "reply": d["reply"]["text"][:300], "errors": d["reply"].get("errors"),
       "demo": sh["project"].get("demo"), "sites": len(it["sites"]), "partners": [(p["name"], p.get("email"), p.get("capacity"), p.get("price_per_site_cents")) for p in it["partners"]],
       "start": it.get("start_date"), "weeks": it.get("weeks"), "ceiling": it.get("budget_ceiling_cents"), "questions": sh.get("questions")}
d2 = ask("Rebuild the demo scenario.")
it2 = sheet(s)["intake"]
out["rerun_no_duplicates"] = {"sites": len(it2["sites"]), "partners": len(it2["partners"]), "reply": d2["reply"]["text"][:200]}
r = s.post(f"{BASE}/api/projects", json={"name": "Real job"}).json()["project_id"]
s.headers["X-Project-Id"] = r
rv = sheet(s)["project"]["rev"]
it = sheet(s)["intake"]
s.put(f"{P}/intake", json={"rev": rv, "intake": {**it, "sites": [{"site_id": "S01", "name": "Main"}]}})
d3 = ask("Build a fictional lighting demo here.")
out["real_project_guard"] = {"errors": d3["reply"].get("errors"), "demo": sheet(s)["project"].get("demo")}
print(json.dumps(out, indent=1, default=str))
json.dump(out, open("/app/test_reports/demo_setup_check.json", "w"), indent=1, default=str)
