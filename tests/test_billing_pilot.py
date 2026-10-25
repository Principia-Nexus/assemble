# Billing / pilot paywall + email-first auth API tests (iteration 10). Lives outside backend/tests so the
# conftest pilot auto-grant does NOT apply: registered firms here are genuinely unpaid.
import os
import time
import uuid

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
DEMO_PW = "synthetic-demo"


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
        assert a["required"] is True and a["active"] is False and a["demo"] is False
        r = s.get(f"{API}/project")
        assert r.status_code == 402, r.text
        r = s.post(f"{API}/project", json={"name": "TEST job"})
        assert r.status_code == 402, r.text

    def test_demo_organizer_free(self):
        s = demo("organizer@demo.assemble.test")
        a = s.get(f"{API}/billing/access").json()
        assert a["required"] is False and a["demo"] is True
        assert s.get(f"{API}/project").status_code == 200
        r = s.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL})
        assert r.status_code == 400

    def test_partner_free(self):
        s = demo("alder@demo.assemble.test")
        a = s.get(f"{API}/billing/access").json()
        assert a["required"] is False
        assert s.get(f"{API}/review/my-reviews").status_code in (200,) or s.get(f"{API}/my-reviews").status_code == 200

    def test_unauth(self):
        assert requests.get(f"{API}/billing/access").status_code == 401
        assert requests.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL}).status_code == 401


# --- checkout session creation / reuse / ownership
class TestCheckout:
    def test_checkout_reuse_and_ownership(self):
        s, _ = register()
        r1 = s.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL})
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert d1["checkout_url"].startswith("https://checkout.stripe.com/")
        assert d1["session_id"].startswith("cs_test_")
        r2 = s.post(f"{API}/billing/checkout", json={"origin_url": BASE_URL})
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
        assert r.status_code == 400
