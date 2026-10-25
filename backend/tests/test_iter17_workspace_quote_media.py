# Iteration 17: typed work items ops/undo validation, customer quote lifecycle, voice (Whisper) + photo (Claude vision) inputs
import io
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from dotenv import load_dotenv

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
load_dotenv("/app/backend/.env")


def solo_org():
    """Organizer-only project (no partner firms), so partner support is not required to issue."""
    s = demo_org()
    pid = s.post(f"{BASE_URL}/api/projects", json={"name": "Solo quote test"}).json()["project_id"]
    s.headers["X-Project-Id"] = pid
    return s


def demo_org():
    s = requests.Session()
    s.headers["Origin"] = BASE_URL
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": "organizer@demo.assemble.test", "password": "synthetic-demo",
                                                   "visitor_id": "t17-" + uuid.uuid4().hex[:12]})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def S():
    return demo_org()


def items(s):
    r = s.get(f"{BASE_URL}/api/project/items")
    assert r.status_code == 200, r.text
    return r.json()


def ops(s, rev, o):
    return s.post(f"{BASE_URL}/api/project/items/ops", json={"rev": rev, "ops": o})


# ---- items ops / undo
class TestItems:
    def test_create_group_task_and_undo(self, S):
        d = items(S)
        r = ops(S, d["rev"], [{"op": "create", "kind": "group", "ref": "g", "fields": {"title": "TEST group"}},
                              {"op": "create", "kind": "task", "fields": {"title": "TEST task", "parent_id": "g", "due_date": "2026-03-02"}}])
        assert r.status_code == 200, r.text
        j = r.json()
        g = next(i for i in j["items"] if i["title"] == "TEST group")
        t = next(i for i in j["items"] if i["title"] == "TEST task")
        assert t["parent_id"] == g["item_id"] and t["due_date"] == "2026-03-02"
        u = S.post(f"{BASE_URL}/api/project/items/undo", json={"rev": j["rev"], "batch_id": j["batch"]["batch_id"]})
        assert u.status_code == 200, u.text
        titles = [i["title"] for i in items(S)["items"]]
        assert "TEST group" not in titles and "TEST task" not in titles
        # undo twice rejected
        u2 = S.post(f"{BASE_URL}/api/project/items/undo", json={"rev": u.json()["rev"], "batch_id": j["batch"]["batch_id"]})
        assert u2.status_code == 422

    def test_unknown_firm_site_rejected(self, S):
        d = items(S)
        r = ops(S, d["rev"], [{"op": "create", "kind": "task", "fields": {"title": "TEST x", "firm_id": "nope"}}])
        assert r.status_code == 422 and "unknown firm" in r.text
        r = ops(S, d["rev"], [{"op": "create", "kind": "task", "fields": {"title": "TEST x", "site_ids": ["nosite"]}}])
        assert r.status_code == 422 and "unknown site" in r.text

    def test_cycle_rejected(self, S):
        d = items(S)
        r = ops(S, d["rev"], [{"op": "create", "kind": "task", "ref": "a", "fields": {"title": "TEST A"}},
                              {"op": "create", "kind": "task", "ref": "b", "fields": {"title": "TEST B"}},
                              {"op": "link", "from_id": "a", "to_id": "b", "kind": "prerequisite"}])
        assert r.status_code == 200, r.text
        j = r.json()
        a = next(i for i in j["items"] if i["title"] == "TEST A")["item_id"]
        b = next(i for i in j["items"] if i["title"] == "TEST B")["item_id"]
        r2 = ops(S, j["rev"], [{"op": "link", "from_id": b, "to_id": a, "kind": "prerequisite"}])
        assert r2.status_code == 422 and "loop" in r2.text

    def test_stale_rev_409(self, S):
        d = items(S)
        r = ops(S, d["rev"] - 1, [{"op": "create", "kind": "task", "fields": {"title": "TEST stale"}}])
        assert r.status_code == 409


# ---- customer quote lifecycle
def future():
    return (datetime.now(timezone.utc) + timedelta(days=20)).isoformat()


FIELDS = {"customer_name": "TEST Buyer", "customer_email": "buyer@demo.assemble.test", "site": "Branch 12", "timing": "March",
          "tax_basis": "Sales tax extra", "payment_terms": "Net 30", "valid_until": None, "scope": "Lighting retrofit"}


def make_issued(s, price=90000, amend_of=None):
    r = s.post(f"{BASE_URL}/api/project/quotes", json={"amend_of": amend_of})
    assert r.status_code == 200, r.text
    q = r.json()["quote"]
    r = s.put(f"{BASE_URL}/api/project/quotes/{q['quote_id']}", json={"fields": {**FIELDS, "valid_until": future(), "price_cents": price}})
    assert r.status_code == 200, r.text
    assert r.json()["missing"] == []
    pv = s.get(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/preview").json()
    r = s.post(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/issue", json={"digest": pv["digest"]})
    assert r.status_code == 200, r.text
    return r.json()["quote"], r.json()["path"].split("/quote/")[1]


def verify(token):
    c = requests.post(f"{BASE_URL}/api/quote/{token}/code").json()
    assert c["sent"] is False and len(c["synthetic_code"]) == 6
    r = requests.post(f"{BASE_URL}/api/quote/{token}/verify", json={"code": c["synthetic_code"]})
    assert r.status_code == 200, r.text
    return r.json()["session"]


class TestQuote:
    def test_issue_guards(self):
        s = solo_org()
        q = s.post(f"{BASE_URL}/api/project/quotes", json={}).json()["quote"]
        s.put(f"{BASE_URL}/api/project/quotes/{q['quote_id']}", json={"fields": {**FIELDS, "valid_until": future(), "price_cents": None}})
        pv = s.get(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/preview").json()
        assert any("price" in m for m in pv["missing"])
        r = s.post(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/issue", json={"digest": pv["digest"]})
        assert r.status_code == 422
        s.put(f"{BASE_URL}/api/project/quotes/{q['quote_id']}", json={"fields": {"price_cents": 500}})
        r = s.post(f"{BASE_URL}/api/project/quotes/{q['quote_id']}/issue", json={"digest": "wrongdigest"})
        assert r.status_code == 409

    def test_lifecycle(self):
        s = solo_org()
        q, token = make_issued(s)
        assert q["number"] == "Q1" and q["state"] == "issued"
        bad = requests.post(f"{BASE_URL}/api/quote/{token}/verify", json={"code": "000000x"})
        assert bad.status_code == 422
        sid = verify(token)
        r = requests.post(f"{BASE_URL}/api/quote/{token}/respond", headers={"X-Quote-Session": "bogus"},
                          json={"action": "accept", "digest": q["digest"], "signer_name": "B", "intent": True, "key": "k1"})
        assert r.status_code == 401
        h = {"X-Quote-Session": sid}
        v = requests.get(f"{BASE_URL}/api/quote/{token}/view", headers=h).json()
        assert v["snapshot"]["price_cents"] == 90000
        body = {"action": "accept", "digest": q["digest"], "signer_name": "TEST Buyer", "intent": True, "key": "k1"}
        r1 = requests.post(f"{BASE_URL}/api/quote/{token}/respond", headers=h, json=body)
        assert r1.status_code == 200 and r1.json()["state"] == "accepted", r1.text
        r2 = requests.post(f"{BASE_URL}/api/quote/{token}/respond", headers=h, json=body)
        assert r2.status_code == 200 and r2.json()["receipt"]["receipt_id"] == r1.json()["receipt"]["receipt_id"]
        # amendment declined keeps Q1 accepted
        a, t2 = make_issued(s, price=120000, amend_of=q["quote_id"])
        assert a["kind"] == "amendment" and a["baseline_number"] == "Q1"
        sid2 = verify(t2)
        r = requests.post(f"{BASE_URL}/api/quote/{t2}/respond", headers={"X-Quote-Session": sid2},
                          json={"action": "decline", "digest": a["digest"], "signer_name": "TEST Buyer", "key": "k2"})
        assert r.status_code == 200 and r.json()["state"] == "declined"
        r = requests.post(f"{BASE_URL}/api/quote/{t2}/respond", headers={"X-Quote-Session": sid2},
                          json={"action": "accept", "digest": a["digest"], "signer_name": "TEST Buyer", "intent": True, "key": "k3"})
        assert r.status_code == 409
        qs = {x["number"]: x["state"] for x in s.get(f"{BASE_URL}/api/project/quotes").json()["quotes"]}
        assert qs["Q1"] == "accepted" and qs["Q2"] == "declined"


# ---- media
def jpeg_bytes():
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (640, 480), (230, 230, 220))
    d = ImageDraw.Draw(img)
    d.rectangle([60, 60, 300, 200], fill=(40, 40, 40))
    d.ellipse([360, 220, 560, 420], fill=(200, 160, 30))
    d.text((80, 260), "PANEL A - 200A MAIN BREAKER", fill=(0, 0, 0))
    for x in range(0, 640, 40):
        d.line([x, 440, x + 20, 470], fill=(120, 30, 30), width=3)
    b = io.BytesIO()
    img.save(b, "JPEG")
    return b.getvalue()


class TestMedia:
    def test_photo_read(self, S):
        r = S.post(f"{BASE_URL}/api/project/photos", files={"file": ("site.jpg", jpeg_bytes(), "image/jpeg")}, timeout=150)
        assert r.status_code == 200, r.text
        p = r.json()["photo"]
        print(p)
        assert p["status"] == "read", p
        assert p["observations"]

    def test_photo_bad_type(self, S):
        r = S.post(f"{BASE_URL}/api/project/photos", files={"file": ("a.gif", b"GIF89a....", "image/gif")})
        assert r.status_code == 422

    def test_transcribe(self, S):
        path = "/tmp/t17_speech.mp3"
        if not os.path.exists(path):
            import asyncio
            from emergentintegrations.llm.openai import OpenAITextToSpeech
            tts = OpenAITextToSpeech(api_key=os.environ["EMERGENT_LLM_KEY"])
            audio = asyncio.run(tts.generate_speech(text="Add a task to replace the lobby fixtures next Monday.", model="tts-1", voice="alloy"))
            with open(path, "wb") as f:
                f.write(audio)
        with open(path, "rb") as f:
            r = S.post(f"{BASE_URL}/api/project/transcribe", files={"file": ("speech.mp3", f.read(), "audio/mpeg")}, timeout=150)
        assert r.status_code == 200, r.text
        print(r.json())
        assert "lobby" in r.json()["text"].lower()

    def test_transcribe_bad_type(self, S):
        r = S.post(f"{BASE_URL}/api/project/transcribe", files={"file": ("a.txt", b"hello", "text/plain")})
        assert r.status_code == 422
