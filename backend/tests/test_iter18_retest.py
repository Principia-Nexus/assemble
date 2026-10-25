# Iteration 18: retest restore/edge injection hole, valid_until tz normalization + expiry, email validation, no-speech filter
import io
import math
import os
import struct
import sys
import time
import random
import wave
from datetime import datetime, timedelta, timezone

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
from test_iter17_workspace_quote_media import BASE_URL, FIELDS, demo_org, items, ops, solo_org, verify  # noqa: E402


@pytest.fixture(scope="module")
def S():
    return demo_org()


def pid_of(s):
    return s.get(f"{BASE_URL}/api/project").json()["sheet"]["project"]["project_id"]


# ---- items ops security
class TestOpsSecurity:
    def test_client_restore_rejected(self, S):
        g = items(S)
        r = ops(S, g["rev"], [{"op": "restore", "doc": {"item_id": "itm_injected", "project_id": pid_of(S), "kind": "task",
                                                         "title": "<script>x</script>", "status": "hacked", "firm_id": "unknown_firm"}}])
        assert r.status_code == 422, r.text
        assert "cannot restore" in r.text
        assert not any(i["item_id"] == "itm_injected" for i in items(S)["items"])

    def test_client_restore_existing_item_rejected(self, S):
        g = items(S)
        r = ops(S, g["rev"], [{"op": "create", "kind": "task", "fields": {"title": "TEST victim"}}])
        assert r.status_code == 200
        j = r.json()
        v = next(i for i in j["items"] if i["title"] == "TEST victim")
        r2 = ops(S, j["rev"], [{"op": "restore", "doc": {**v, "status": "hacked", "title": "PWNED"}}])
        assert r2.status_code == 422
        v2 = next(i for i in items(S)["items"] if i["item_id"] == v["item_id"])
        assert v2["title"] == "TEST victim" and v2["status"] == "open"

    def test_client_edge_object_ignored(self, S):
        g = items(S)
        r = ops(S, g["rev"], [{"op": "create", "kind": "task", "ref": "a", "fields": {"title": "TEST EA"}},
                              {"op": "create", "kind": "task", "ref": "b", "fields": {"title": "TEST EB"}}])
        j = r.json()
        a = next(i for i in j["items"] if i["title"] == "TEST EA")["item_id"]
        b = next(i for i in j["items"] if i["title"] == "TEST EB")["item_id"]
        # client tries to smuggle edge object with chosen edge_id / bogus kind
        r2 = ops(S, j["rev"], [{"op": "link", "edge": {"edge_id": "edg_injected", "from_id": a, "to_id": b, "kind": "bogus"}}])
        assert r2.status_code == 422, r2.text
        assert not any(e["edge_id"] == "edg_injected" for e in items(S)["edges"])
        # valid top-level link still works; edge_id is server generated
        r3 = ops(S, j["rev"], [{"op": "link", "from_id": a, "to_id": b, "kind": "prerequisite", "edge_id": "edg_chosen"}])
        assert r3.status_code == 200, r3.text
        e = [e for e in r3.json()["edges"] if e["from_id"] == a and e["to_id"] == b]
        assert e and e[0]["edge_id"] != "edg_chosen"

    def test_delete_then_undo_restores(self, S):
        g = items(S)
        r = ops(S, g["rev"], [{"op": "create", "kind": "task", "fields": {"title": "TEST undoable"}}])
        j = r.json()
        iid = next(i for i in j["items"] if i["title"] == "TEST undoable")["item_id"]
        r2 = ops(S, j["rev"], [{"op": "delete", "item_id": iid}])
        assert r2.status_code == 200
        assert not any(i["item_id"] == iid for i in r2.json()["items"])
        u = S.post(f"{BASE_URL}/api/project/items/undo", json={"rev": r2.json()["rev"], "batch_id": r2.json()["batch"]["batch_id"]})
        assert u.status_code == 200, u.text
        assert any(i["item_id"] == iid and i["title"] == "TEST undoable" for i in u.json()["items"])

    def test_cross_sandbox_isolation(self, S):
        other = demo_org()
        g = items(S)
        r = ops(S, g["rev"], [{"op": "create", "kind": "task", "fields": {"title": "TEST private"}}])
        iid = next(i for i in r.json()["items"] if i["title"] == "TEST private")["item_id"]
        og = items(other)
        assert not any(i["item_id"] == iid for i in og["items"])
        r2 = ops(other, og["rev"], [{"op": "update", "item_id": iid, "fields": {"title": "HIJACK"}}])
        assert r2.status_code == 422
        assert next(i for i in items(S)["items"] if i["item_id"] == iid)["title"] == "TEST private"


# ---- quote valid_until / email
class TestQuoteValidity:
    def _draft(self, s):
        r = s.post(f"{BASE_URL}/api/project/quotes", json={})
        if r.status_code == 200:
            return r.json()["quote"]["quote_id"]
        # only one draft per project: reuse it
        return next(q["quote_id"] for q in s.get(f"{BASE_URL}/api/project/quotes").json()["quotes"] if q["state"] == "draft")

    def test_valid_until_normalized(self, S):
        qid = self._draft(S)
        r = S.put(f"{BASE_URL}/api/project/quotes/{qid}", json={"fields": {"valid_until": "2026-12-01T09:30:00-05:00"}})
        assert r.status_code == 200, r.text
        assert r.json()["quote"]["valid_until"] == "2026-12-01T14:30:00Z"
        r = S.put(f"{BASE_URL}/api/project/quotes/{qid}", json={"fields": {"valid_until": "2026-12-01T09:30:00.000Z"}})
        assert r.json()["quote"]["valid_until"] == "2026-12-01T09:30:00Z"
        r = S.put(f"{BASE_URL}/api/project/quotes/{qid}", json={"fields": {"valid_until": "not a date"}})
        assert r.status_code == 422

    def test_invalid_email_rejected(self, S):
        qid = self._draft(S)
        for bad in ("not-an-email", "a@b", "x y@z.com"):
            r = S.put(f"{BASE_URL}/api/project/quotes/{qid}", json={"fields": {"customer_email": bad}})
            assert r.status_code == 422, (bad, r.text)
            assert "valid address" in r.text
        r = S.put(f"{BASE_URL}/api/project/quotes/{qid}", json={"fields": {"customer_email": " Buyer@Demo.Assemble.Test "}})
        assert r.status_code == 200 and r.json()["quote"]["customer_email"] == "buyer@demo.assemble.test"

    def test_expiry_guard(self):
        s = solo_org()
        qid = s.post(f"{BASE_URL}/api/project/quotes", json={}).json()["quote"]["quote_id"]
        vu = (datetime.now(timezone.utc) + timedelta(seconds=45)).isoformat()
        r = s.put(f"{BASE_URL}/api/project/quotes/{qid}", json={"fields": {**FIELDS, "valid_until": vu, "price_cents": 5000}})
        assert r.status_code == 200 and r.json()["missing"] == [], r.text
        assert r.json()["quote"]["valid_until"].endswith("Z")
        pv = s.get(f"{BASE_URL}/api/project/quotes/{qid}/preview").json()
        r = s.post(f"{BASE_URL}/api/project/quotes/{qid}/issue", json={"digest": pv["digest"]})
        assert r.status_code == 200, r.text
        q, token = r.json()["quote"], r.json()["path"].split("/quote/")[1]
        sid = verify(token)
        time.sleep(50)
        r = requests.post(f"{BASE_URL}/api/quote/{token}/respond", headers={"X-Quote-Session": sid},
                          json={"action": "accept", "digest": q["digest"], "signer_name": "TEST Buyer", "intent": True, "key": "kx"})
        assert r.status_code == 409, r.text
        assert "expired" in r.text
        st = {x["quote_id"]: x["state"] for x in s.get(f"{BASE_URL}/api/project/quotes").json()["quotes"]}
        assert st[qid] == "expired"


# ---- transcription no-speech filter
def noise_wav():
    random.seed(1)
    b = io.BytesIO()
    w = wave.open(b, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(16000)
    frames = b"".join(struct.pack("<h", int(300 * math.sin(i / 7.0) + random.randint(-200, 200))) for i in range(16000 * 4))
    w.writeframes(frames)
    w.close()
    return b.getvalue()


def silence_wav():
    b = io.BytesIO()
    w = wave.open(b, "wb")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(16000)
    w.writeframes(b"\x00\x00" * 16000 * 3)
    w.close()
    return b.getvalue()


class TestNoSpeech:
    @pytest.mark.parametrize("gen", [silence_wav, noise_wav])
    def test_non_speech_422(self, S, gen):
        r = S.post(f"{BASE_URL}/api/project/transcribe", files={"file": ("n.wav", gen(), "audio/wav")}, timeout=150)
        print(gen.__name__, r.status_code, r.text[:200])
        assert r.status_code == 422, r.text
        assert "No speech was recognized" in r.text
