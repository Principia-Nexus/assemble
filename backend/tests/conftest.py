# Registered (non-demo) test organizers need pilot access; grant it directly in Mongo after a successful register.
import os

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
_db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
_orig_request = requests.Session.request


def _request(self, method, url, *a, **kw):
    r = _orig_request(self, method, url, *a, **kw)
    if method.upper() == "POST" and str(url).endswith("/api/auth/register") and r.status_code == 200:
        firm_id = r.json().get("firm_id")
        if firm_id:
            _db.firms.update_one({"firm_id": firm_id}, {"$set": {"pilot_active": True}})
    return r


requests.Session.request = _request
