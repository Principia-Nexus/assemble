# One-off verifier for a UI-paid session: owner sees paid, other users get 404, DB has a single paid tx.
import os, sys, uuid, requests
from dotenv import load_dotenv
from pymongo import MongoClient
load_dotenv("/app/frontend/.env"); load_dotenv("/app/backend/.env")
API = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
email, sid = sys.argv[1], sys.argv[2]
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
own = requests.Session()
print("owner login", own.post(f"{API}/auth/login", json={"email": email, "password": "Passw0rd!x"}).status_code)
r = own.get(f"{API}/billing/status/{sid}"); print("owner status", r.status_code, r.json())
print("owner checkout", own.post(f"{API}/billing/checkout", json={"origin_url": "x"}).status_code)
print("owner project", own.get(f"{API}/project").status_code)
o = requests.Session()
o.post(f"{API}/auth/register", json={"name": "O", "email": f"TEST_other_{uuid.uuid4().hex[:6]}@example.com", "password": "Passw0rd!x", "firm_name": "TEST O"})
print("other status", o.get(f"{API}/billing/status/{sid}").status_code)
d = requests.Session()
d.post(f"{API}/auth/login", json={"email": "organizer@demo.assemble.test", "password": "synthetic-demo", "visitor_id": str(uuid.uuid4())})
print("demo org status", d.get(f"{API}/billing/status/{sid}").status_code)
txs = list(db.payment_transactions.find({"session_id": sid}, {"_id": 0}))
print("tx count", len(txs), [(t["payment_status"], t["status"], t["amount"]) for t in txs])
f = db.firms.find_one({"firm_id": txs[0]["firm_id"]}, {"_id": 0, "pilot_until": 1, "pilot_mode": 1, "pilot_session_id": 1})
print("firm", f)
print("pending count for firm", db.payment_transactions.count_documents({"firm_id": txs[0]["firm_id"]}))
