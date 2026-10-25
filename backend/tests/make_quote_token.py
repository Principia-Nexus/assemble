# Helper (not a test): issues a quote on a fresh partner-less demo project and prints the /quote/<token> path for UI testing
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from test_iter17_workspace_quote_media import BASE_URL, FIELDS, future, solo_org  # noqa: E402

s = solo_org()
q = s.post(f"{BASE_URL}/api/project/quotes", json={"amend_of": None}).json()["quote"]
s.put(f"{BASE_URL}/api/project/quotes/{q['quote_id']}", json={"fields": {**FIELDS, "customer_email": "buyer@example.test",
      "valid_until": future(), "price_cents": 500000, "inclusions": ["LED fixtures"], "exclusions": ["Ceiling repair"]}})
pv = s.get(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/preview").json()
r = s.post(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/issue", json={"digest": pv["digest"]})
print(r.status_code, r.json().get("path"))
