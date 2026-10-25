# Iteration 25: assistant snapshot includes qualification_by_site / requirements / licence_evidence (LLM answer check)
import os
import sys
import uuid
from datetime import date

import requests

sys.path.insert(0, os.path.dirname(__file__))
from test_iter19_runs_layout_support import BASE_URL, wait_run  # noqa: E402

P = f"{BASE_URL}/api/project"


def test_assistant_sees_evidence():
    s = requests.Session()
    s.headers["Origin"] = BASE_URL
    assert s.post(f"{BASE_URL}/api/auth/login", json={"email": "organizer@demo.assemble.test", "password": "synthetic-demo",
                                                      "visitor_id": "t25a-" + uuid.uuid4().hex[:8]}).status_code == 200
    pid = next(x["project_id"] for x in s.get(f"{BASE_URL}/api/projects").json()["projects"] if x["name"].startswith("12-branch"))
    s.headers["X-Project-Id"] = pid
    sh = s.get(P).json()["sheet"]
    assert s.post(f"{P}/draft", json={"rev": sh["project"]["rev"], "partner_ids": ["alder"], "include_own": False}).status_code == 200
    assert s.post(f"{P}/requirements/sug-C-10/confirm").status_code == 200
    r = s.post(f"{P}/evidence", json={"partner_id": "alder", "license_class": "C-10", "license_number": "TEST1", "expires": "2027-06-30",
                                      "entity_name": "Alder Line Electric", "source_record": "Synthetic CSLB screenshot",
                                      "observed_status": "active", "observed_on": s.get(P).json()["sheet"]["project"].get("today") or date.today().isoformat()})
    if r.status_code == 422 and "future" in r.text:
        r = s.post(f"{P}/evidence", json={"partner_id": "alder", "license_class": "C-10", "expires": "2027-06-30", "entity_name": "Alder Line Electric",
                                          "source_record": "Synthetic CSLB screenshot", "observed_status": "active", "observed_on": "2026-10-01"})
    assert r.status_code == 200, r.text
    st = {k: x["status"] for k, x in r.json()["sheet"]["current"]["qualification"]["sites"].items()}
    print("QUAL", st)
    sh = s.get(P).json()["sheet"]
    j = s.post(f"{P}/assistant", json={"message": "Is there licence evidence on file for Alder, and does Alder fit the C-10 requirement? One sentence.",
                                        "rev": sh["project"]["rev"], "async_run": True})
    assert j.status_code == 200, j.text
    out = wait_run(s, j.json()["run"]["run_id"], limit=150)
    txt = (out["reply"].get("text") or str(out["reply"])).lower()
    print("REPLY", txt[:500])
    assert "no licence evidence" not in txt and "no evidence" not in txt
    assert "fit" in txt or "active" in txt
