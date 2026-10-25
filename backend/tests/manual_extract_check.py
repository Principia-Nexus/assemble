import sys, uuid
sys.path.insert(0, "/app/backend/tests")
from test_assemble_flow import BASE_URL, login

org = login("organizer", visitor="test-" + uuid.uuid4().hex[:16])
dc = org.get(f"{BASE_URL}/api/project/demo-content").json()
samples = dc.get("documents") or []
print("keys", list(dc.keys()), [s.get("key") for s in samples])
for key in ("brief", "quote"):
    s = next((x for x in samples if x.get("key") == key or x.get("kind") == key), None)
    if not s:
        continue
    r = org.post(f"{BASE_URL}/api/project/sources", json={"kind": s["kind"], "label": s["label"], "text": s["text"],
                                                          "source_date": s.get("source_date")}, timeout=200)
    d = r.json()
    print(key, r.status_code, d["sources"][-1].get("status"), d["sources"][-1].get("reader"))
for rd in d["readings"]:
    if rd.get("scope") == "job_condition" or rd["field"] in ("customer_name", "job_name"):
        print(rd["field"], rd["scope"], rd["label"], "conflict", rd["conflict"], "corr", rd["corroborated"],
              (rd["reading"] or {}).get("status"), (rd["reading"] or {}).get("value"))
