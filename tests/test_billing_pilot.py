# Billing / pilot paywall + email-first auth API tests (iteration 10, updated iteration 11: no-expiry pilot_active model, Origin check, throttle). Lives outside backend/tests so the
# conftest pilot auto-grant does NOT apply: registered firms here are genuinely unpaid.
import os
import time
import uuid

import hashlib
import hmac
import json

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
DEMO_PW = "synthetic-demo"
ORIGIN = {"Origin": BASE_URL}
DB = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


@pytest.fixture(autouse=True, scope="session")
def _clear_email_checks():
    DB.email_checks.delete_many({})
    yield
    DB.email_checks.delete_many({})


def signed_webhook(event):
    payload = json.dumps(event).encode()
    t = str(int(time.time()))
    sig = hmac.new(os.environ["STRIPE_WEBHOOK_SECRET"].encode(), f"{t}.".encode() + payload, hashlib.sha256).hexdigest()
    return requests.post(f"{API}/stripe/webhook", data=payload, headers={"stripe-signature": f"t={t},v1={sig}", "Content-Type": "application/json"})


def register(prefix="TEST_pilot"):
    s = requests.Session()
    email = f"{prefix}_{int(time.time()*1000)}_{uuid.uuid4().hex[:4]}@example.com"
    r = s.post(f"{API}/auth/register", json={"name": "Test Org", "email": email, "password": "Passw0rd!x", "firm_name": "TEST Firm"})
    assert r.status_code == 200, r.text
    return s, email


def demo(email):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": DEMO_PW, "visitor_id": str(uuid.uuid4())})
    assert r.status_code == 200, r.text
    return s


# --- check-email (email-first login)
class TestCheckEmail:
    def test_known_demo(self):
        r = requests.post(f"{API}/auth/check-email", json={"email": "organizer@demo.assemble.test"})
        assert r.status_code == 200 and r.json()["exists"] is True

    def test_known_case_insensitive(self):
        r = requests.post(f"{API}/auth/check-email", json={"email": "  Organizer@Demo.Assemble.TEST "})
        assert r.status_code == 200 and r.json()["exists"] is True

    def test_unknown(self):
        r = requests.post(f"{API}/auth/check-email", json={"email": f"nobody_{uuid.uuid4().hex}@example.com"})
        assert r.status_code == 200 and r.json()["exists"] is False

    def test_invalid(self):
        r = requests.post(f"{API}/auth/check-email", json={"email": "not-an-email"})
        assert r.status_code == 422

    def test_registered_then_exists(self):
        _, email = register()
        r = requests.post(f"{API}/auth/check-email", json={"email": email})
        assert r.json()["exists"] is True


# --- paywall
class TestPaywall:
    def test_unpaid_access_and_402(self):
        s, _ = register()
        a = s.get(f"{API}/billing/access").json()
        assert a == {"required": True, "active": False, "demo": False}
        r = s.get(f"{API}/project")
        assert r.status_code == 402, r.text
        r = s.post(f"{API}/project", json={"name": "TEST job"})
        assert r.status_code == 402, r.text

    def test_demo_organizer_free(self):
        s = demo("organizer@demo.assemble.test")
        a = s.get(f"{API}/billing/access").json()
        assert a["required"] is False and a["demo"] is True
        assert s.get(f"{API}/project").status_code == 200
        r = s.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL}, headers=ORIGIN)
        assert r.status_code == 400

    def test_partner_free(self):
        s = demo("alder@demo.assemble.test")
        a = s.get(f"{API}/billing/access").json()
        assert a["required"] is False
        assert s.get(f"{API}/review/my-reviews").status_code in (200,) or s.get(f"{API}/my-reviews").status_code == 200

    def test_unauth(self):
        assert requests.get(f"{API}/billing/access").status_code == 401
        assert requests.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL}, headers=ORIGIN).status_code == 401


# --- checkout session creation / reuse / ownership
class TestCheckout:
    def test_checkout_reuse_and_ownership(self):
        s, _ = register()
        r1 = s.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL}, headers=ORIGIN)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["checkout_url"].startswith("https://checkout.stripe.com/")
        assert d1["session_id"].startswith("cs_test_")
        r2 = s.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL}, headers=ORIGIN)
        assert r2.status_code == 200 and r2.json()["session_id"] == d1["session_id"]
        st = s.get(f"{API}/billing/status/{d1['session_id']}")
        assert st.status_code == 200
        j = st.json()
        assert j["payment_status"] == "pending" and j["access"]["active"] is False
        # other user cannot see it
        other, _ = register()
        assert other.get(f"{API}/billing/status/{d1['session_id']}").status_code == 404
        partner = demo("birch@demo.assemble.test")
        assert partner.get(f"{API}/billing/status/{d1['session_id']}").status_code == 404
        # still not active after status checks
        assert s.get(f"{API}/project").status_code == 402

    def test_fake_session(self):
        s, _ = register()
        assert s.get(f"{API}/billing/status/fake").status_code == 404
        assert s.get(f"{API}/billing/access").json()["active"] is False

    def test_webhook_bad_signature(self):
        r = requests.post(f"{API}/stripe/webhook", data=b'{"type":"checkout.session.completed"}', headers={"stripe-signature": "t=1,v1=bad"})
        assert r.status_code in (400, 503)


# --- open-redirect fix: origin_url must match the request Origin header
class TestOriginCheck:
    def test_no_origin_header(self):
        s, _ = register()
        assert s.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL}).status_code == 400

    def test_mismatched_origin(self):
        s, _ = register()
        r = s.post(f"{API}/billing/checkout", json={"origin_url": "https://evil.example.com"}, headers=ORIGIN)
        assert r.status_code == 400
        r = s.post(f"{API}/billing/checkout", json={"origin_url": "https://evil.example.com"}, headers={"Origin": "https://evil.example.com"})
        # CORS / Origin spoofing outside browsers is possible; record behaviour
        print("spoofed-origin checkout status", r.status_code)


# --- webhooks are refused while no real signing secret is configured; forged events can't activate
class TestWebhookFulfil:
    def _sess(self, sid, firm_id, amount=9900, paid="paid"):
        return {"id": "evt_test_" + uuid.uuid4().hex, "type": "checkout.session.completed", "object": "event",
                "data": {"object": {"id": sid, "object": "checkout.session", "payment_status": paid, "amount_subtotal": amount,
                                    "currency": "usd", "metadata": {"firm_id": firm_id}, "payment_intent": "pi_test_x"}}}

    def test_forged_webhook_rejected(self):
        s, _ = register()
        d = s.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL}, headers=ORIGIN).json()
        tx = DB.payment_transactions.find_one({"session_id": d["session_id"]})
        assert signed_webhook(self._sess(d["session_id"], tx["firm_id"])).status_code == 503
        assert s.get(f"{API}/billing/access").json()["active"] is False


# --- check-email throttle: >30 per IP per 10-min window -> 429
class TestThrottle:
    def test_throttle(self):
        DB.email_checks.delete_many({})
        codes = [requests.post(f"{API}/auth/check-email", json={"email": f"t{i}@example.com"}).status_code for i in range(32)]
        DB.email_checks.delete_many({})
        assert codes[:30] == [200] * 30, codes
        assert codes[30] == 429 and codes[31] == 429
