# Iteration 28: assistant-created Demo project end to end (setup -> plan -> partner confirm -> quote -> accept -> amendment) + guards
import json
import os
import re
import sys
import uuid
from datetime import date, timedelta

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
from test_iter19_runs_layout_support import BASE_URL, wait_run  # noqa: E402

P = f"{BASE_URL}/api/project"
A = f"{P}/assistant"
TODAY = date.today().isoformat()
VISITOR = "t28-" + uuid.uuid4().hex[:12]
CTX = {}
OUT = "/app/test_reports/iter28_demo_ctx.json"


def login(email, visitor=VISITOR):
    s = requests.Session()
    s.headers["Origin"] = BASE_URL
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "synthetic-demo", "visitor_id": visitor})
    assert r.status_code == 200, r.text
    return s


def sh(s):
    return s.get(P).json()["sheet"]


def ask(s, msg):
    r = s.post(A, json={"message": msg, "rev": sh(s)["project"]["rev"], "async_run": True})
    assert r.status_code == 200, r.text
    return wait_run(s, r.json()["run"]["run_id"], limit=290)


def resume():
    if "org" not in CTX and os.path.exists(OUT):
        d = json.load(open(OUT))
        CTX.update(d)
        global VISITOR
        VISITOR = d["visitor"]
        s = login("organizer@demo.assemble.test", VISITOR)
        s.headers["X-Project-Id"] = d["project_id"]
        CTX["org"] = s
        if "owners" not in CTX:
            CTX["owners"] = sorted({a["owner"] for a in sh(s)["current"]["version"]["assignments"].values() if a.get("owner") not in (None, "own")})


def ensure_ev(s, pid, name, codes):
    for code in codes:
        r = s.post(f"{P}/evidence", json={"partner_id": pid, "license_class": code, "license_number": "TEST" + pid[-4:].upper(),
                                           "expires": "2027-12-31", "entity_name": name, "source_record": "Synthetic test record",
                                           "observed_status": "active", "observed_on": TODAY})
        assert r.status_code == 200, r.text


def save():
    json.dump({k: v for k, v in CTX.items() if isinstance(v, (str, int, list, dict, bool))}, open(OUT, "w"), indent=1, default=str)


# Demo setup through the assistant on a fresh project
class TestDemo:
    def test_01_demo_setup(self):
        s = login("organizer@demo.assemble.test")
        r = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST Demo CA lighting"})
        assert r.status_code == 200, r.text
        CTX["project_id"] = r.json()["project_id"]
        CTX["visitor"] = VISITOR
        s.headers["X-Project-Id"] = CTX["project_id"]
        CTX["org"] = s
        save()
        j = ask(s, "Build a California lighting-retrofit demo")
        rep = j["reply"]
        print("REPLY", rep.get("mode"), rep.get("errors"), rep.get("text", "")[:700])
        sheet = sh(s)
        it = sheet["intake"]
        print("INTAKE", json.dumps({k: it.get(k) for k in ("job_name", "start_date", "weeks", "scope_summary")}),
              len(it["sites"]), [(p["name"], p.get("email"), p.get("capacity"), p.get("price_per_site_cents")) for p in it["partners"]])
        print("SITES", [(x["site_id"], x.get("name"), x.get("scope"), x.get("due_week")) for x in it["sites"]][:12])
        assert rep.get("mode") == "demo"
        assert sheet["project"].get("demo") is True
        assert len(it["sites"]) >= 2 and len(it["partners"]) >= 1
        assert it.get("start_date") and it.get("weeks")
        assert re.search(r"fictional|unverified|not real|made.up", rep.get("text", ""), re.I), rep.get("text")

    def test_02_real_project_guard(self):
        s = login("organizer@demo.assemble.test")
        pid = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST Real job"}).json()["project_id"]
        s.headers["X-Project-Id"] = pid
        sheet = sh(s)
        r = s.put(f"{P}/intake", json={"rev": sheet["project"]["rev"], "intake": {**sheet["intake"], "sites": [{"site_id": "S01", "name": "Main"}]}})
        assert r.status_code == 200, r.text
        before = sh(s)
        j = ask(s, "Build a California lighting-retrofit demo")
        print("GUARD", j["reply"].get("mode"), j["reply"].get("errors"), j["reply"].get("text", "")[:200])
        after = sh(s)
        assert "This project holds real work" in json.dumps(j["reply"])
        assert not after["project"].get("demo")
        assert after["intake"]["sites"] == before["intake"]["sites"] and after["intake"]["partners"] == before["intake"]["partners"]

    def test_03_draft_and_evidence(self):
        s = CTX["org"]
        sheet = sh(s)
        ids = [p["partner_id"] for p in sheet["intake"]["partners"]]
        r = s.post(f"{P}/draft", json={"rev": sheet["project"]["rev"], "partner_ids": ids, "include_own": False})
        assert r.status_code == 200, r.text
        sheet = r.json()["sheet"]
        reqs = sheet["qual"]["requirements"]
        print("REQS", [(x["req_id"], x["code"], x["status"], x["origin"]) for x in reqs])
        for x in reqs:
            if x["status"] == "suggested":
                s.post(f"{P}/requirements/{x['req_id']}/confirm")
        codes = [x["code"] for x in sh(s)["qual"]["requirements"] if x["status"] in ("required", "confirmed")]
        owners = sorted({a["owner"] for a in sheet["current"]["version"]["assignments"].values() if a.get("owner") not in (None, "own")})
        CTX["owners"] = owners
        names = {p["partner_id"]: p["name"] for p in sheet["intake"]["partners"]}
        for pid in owners:
            for code in codes:
                r = s.post(f"{P}/evidence", json={"partner_id": pid, "license_class": code, "license_number": "TEST" + pid[:4].upper(),
                                                   "expires": "2027-12-31", "entity_name": names[pid], "source_record": "Synthetic test record",
                                                   "observed_status": "active", "observed_on": TODAY})
                assert r.status_code == 200, r.text
        cur = sh(s)["current"]
        st = {k: x["status"] for k, x in cur["qualification"]["sites"].items()}
        print("QUAL", st, "CHECK", cur["checker"]["overall"], "OPEN", cur["qualification"]["coverage"]["open"])
        assert owners
        assert set(st.values()) <= {"fits", "open"}, st

    def test_04_select_and_links_no_email(self):
        resume()
        s = CTX["org"]
        r = s.post(f"{P}/plan/select", json={"rev": sh(s)["project"]["rev"]})
        if r.status_code == 409 and "fails a check" in r.text:
            # KNOWN BUG: generator ignores max_sites (quoted_limits). Work around by moving excess sites to a firm with room.
            CTX["quoted_limits_bug"] = True
            cur = sh(s)["current"]
            fail = [d for x in cur["checker"]["rules"] if x["status"] == "fail" for d in x["details"]]
            print("SELECT_FAIL", fail)
            it = sh(s)["intake"]
            mx = {p["partner_id"]: p.get("max_sites") or 99 for p in it["partners"]}
            asg = dict(cur["version"]["assignments"])
            for sid, a in sorted(asg.items()):
                o = a.get("owner")
                cnt = lambda pid: sum(1 for v in asg.values() if v.get("owner") == pid)  # noqa: E731
                if o in mx and cnt(o) > mx[o]:
                    for alt in sorted(mx, key=lambda k: -(mx[k] - cnt(k))):
                        busy = sum(1 for v in asg.values() if v.get("owner") == alt and v.get("week") == a["week"])
                        capw = (next(p for p in it["partners"] if p["partner_id"] == alt).get("capacity") or [0] * 99)[a["week"] - 1] or 0
                        if alt != o and cnt(alt) < mx[alt] and busy < capw:
                            rr = s.post(f"{P}/plan/assign", json={"rev": sh(s)["project"]["rev"], "site_id": sid, "owner": alt, "week": a["week"]})
                            print("MOVE", sid, o, "->", alt, rr.status_code, rr.text[:120])
                            asg[sid] = {"owner": alt, "week": a["week"]}
                            break
            names = {p["partner_id"]: p["name"] for p in it["partners"]}
            codes = [x["code"] for x in sh(s)["qual"]["requirements"] if x["status"] in ("required", "confirmed")]
            for pid in {v["owner"] for v in asg.values() if v.get("owner")} - set(CTX["owners"]):
                ensure_ev(s, pid, names[pid], codes)
            r = s.post(f"{P}/preview/select", json={"rev": sh(s)["project"]["rev"]})
            print("PREVIEW_SELECT", r.status_code, r.text[:200], "plan_selected", sh(s)["project"].get("plan_selected"))
            if not sh(s)["project"].get("plan_selected"):
                r = s.post(f"{P}/plan/select", json={"rev": sh(s)["project"]["rev"]})
                print("PLAN_SELECT2", r.status_code, r.text[:200])
            CTX["owners"] = sorted({v["owner"] for v in sh(s)["current"]["version"]["assignments"].values() if v.get("owner") not in (None, "own")})
        assert r.status_code == 200, r.text
        toks = {}
        for pid in CTX["owners"]:
            r = s.post(f"{P}/links", json={"partner_id": pid})
            assert r.status_code == 200, r.text
            t = r.json()["link"]["token"]
            toks[pid] = t
            pv = s.post(f"{P}/links/{t}/email-preview").json()
            assert pv["sendable"] is False and pv["to"].endswith(".test"), pv
            es = s.post(f"{P}/links/{t}/email-send")
            assert es.status_code == 400 and "no email is sent" in es.text
            assert s.post(f"{P}/links/{t}/shared").status_code == 200
        CTX["tokens"] = toks
        save()

    def test_05_partners_confirm_scoped(self):
        s = CTX["org"]
        it = sh(s)["intake"]
        parts = {p["partner_id"]: p for p in it["partners"]}
        for pid, tok in CTX["tokens"].items():
            email = parts[pid]["email"]
            ps = login(email, CTX["visitor"])
            d = ps.get(f"{BASE_URL}/api/review/{tok}")
            assert d.status_code == 200, d.text
            body = d.json()
            txt = d.text.lower()
            assert body.get("demo") is True or json.dumps(body).count('"demo": true') >= 1, list(body)[:20]
            for oid, o in parts.items():
                if oid == pid:
                    continue
                assert o["email"].lower() not in txt, f"{pid} review leaks {o['email']}"
                if o.get("price_per_site_cents") and o["price_per_site_cents"] != parts[pid].get("price_per_site_cents"):
                    assert str(o["price_per_site_cents"]) not in d.text, f"{pid} review leaks {oid} price"
            r = ps.post(f"{BASE_URL}/api/review/{tok}/respond", json={"version_id": body["version"]["version_id"], "terms_hash": body["terms_hash"],
                                                                        "action": "confirm", "idempotency_key": "idem-" + uuid.uuid4().hex})
            assert r.status_code == 200, r.text
            other = next((t for o, t in CTX["tokens"].items() if o != pid), None)
            if other:
                assert ps.get(f"{BASE_URL}/api/review/{other}").status_code == 403
        st = {x["partner_id"]: x["status"] for x in sh(s)["current"]["partners"]}
        print("PARTNER_STATUS", st)

    def test_06_quote_issue_accept(self):
        resume()
        s = CTX["org"]
        qr = s.post(f"{P}/quotes", json={})
        if qr.status_code == 422 and "Finish or discard" in qr.text:
            q = next(x for x in s.get(f"{P}/quotes").json()["quotes"] if x["state"] == "draft")
        else:
            assert qr.status_code == 200, qr.text
            q = qr.json()["quote"]
        qid = q["quote_id"]
        fields = {"customer_name": "TEST Demo Buyer", "customer_email": "buyer@demo.assemble.test", "site": "Demo sites", "timing": "Per plan",
                  "tax_basis": "Sales tax extra", "payment_terms": "Net 30", "scope": "Lighting retrofit", "price_cents": 7700000,
                  "valid_until": (date.today() + timedelta(days=30)).isoformat() + "T00:00:00Z"}
        r = s.put(f"{P}/quotes/{qid}", json={"fields": fields})
        assert r.status_code == 200, r.text
        pv = s.get(f"{P}/quotes/{qid}/preview").json()
        conds = (pv.get("readiness") or {}).get("conditions") or []
        if conds:
            s.put(f"{P}/quotes/{qid}", json={"fields": {"condition_decisions": {c["text"]: "resolved" for c in conds}}})
            pv = s.get(f"{P}/quotes/{qid}/preview").json()
        print("READY", json.dumps(pv.get("readiness", {}).get("blockers")), pv.get("missing"))
        r = s.post(f"{P}/quotes/{qid}/issue", json={"digest": pv["digest"]})
        if r.status_code != 200:  # resumed run: Q1 already issued
            iq = next(x for x in s.get(f"{P}/quotes").json()["quotes"] if x["state"] == "issued")
            s.post(f"{P}/quotes/{qid}/discard") if qid != iq["quote_id"] else None
            lk = s.get(f"{P}/quotes/{iq['quote_id']}/link").json()
            print("RESUME_LINK", lk)
            r = type("R", (), {"json": lambda self, iq=iq, lk=lk: {"quote": iq, "path": lk.get("path") or lk["link"]["path"]}})()
        snap = r.json()["quote"]["snapshot"]
        print("LINE_ITEMS", snap.get("line_items"))
        cur = sh(s)["current"]["version"]
        assigned = [k for k, a in cur["assignments"].items() if a.get("owner")]
        assert snap["demo"] is True
        assert len(snap["line_items"]) == len(assigned)
        assert all(re.match(r"^S\d+ .+: .+", x) for x in snap["line_items"]), snap["line_items"]
        it = sh(s)["intake"]
        low = json.dumps(snap).lower()
        for p in it["partners"]:
            assert p["email"].lower() not in low
            assert p["name"].lower() not in low, f"firm name {p['name']} leaks"
            if p.get("price_per_site_cents"):
                assert str(p["price_per_site_cents"]) not in low
        token = r.json()["path"].split("/quote/")[1]
        CTX["qtoken"], CTX["qid"], CTX["q1_digest"] = token, qid, r.json()["quote"]["digest"]
        CTX["q1_snap"] = snap
        save()
        # organizer cannot accept with own login
        body = {"action": "accept", "digest": CTX["q1_digest"], "signer_name": "Organizer", "intent": True, "key": "k-" + uuid.uuid4().hex}
        o = s.post(f"{BASE_URL}/api/quote/{token}/respond", json=body)
        print("ORG_ACCEPT", o.status_code, o.text[:150])
        assert o.status_code in (401, 403)
        c = requests.post(f"{BASE_URL}/api/quote/{token}/code").json()
        assert c["sent"] is False and c.get("synthetic_code")
        ses = requests.post(f"{BASE_URL}/api/quote/{token}/verify", json={"code": c["synthetic_code"]}).json()["session"]
        h = {"X-Quote-Session": ses}
        v = requests.get(f"{BASE_URL}/api/quote/{token}/view", headers=h)
        assert v.status_code == 200 and v.json()["snapshot"]["demo"] is True and v.json()["snapshot"]["line_items"]
        r = requests.post(f"{BASE_URL}/api/quote/{token}/respond", headers=h, json={**body, "signer_name": "TEST Demo Buyer"})
        assert r.status_code == 200 and r.json()["state"] == "accepted", r.text

    def test_07_amendment(self):
        resume()
        s = CTX["org"]
        r = s.post(f"{P}/quotes", json={"amend_of": CTX["qid"]})
        assert r.status_code == 200, r.text
        a = r.json()["quote"]
        print("AMEND_DRAFT", {k: a.get(k) for k in ("number", "kind", "baseline_number", "price_cents")})
        assert a["kind"] == "amendment"
        r = s.put(f"{P}/quotes/{a['quote_id']}", json={"fields": {"price_cents": 8100000, "valid_until": (date.today() + timedelta(days=30)).isoformat() + "T00:00:00Z"}})
        assert r.status_code == 200, r.text
        print("AMEND_MISSING", r.json().get("missing"))
        pv = s.get(f"{P}/quotes/{a['quote_id']}/preview").json()
        conds = (pv.get("readiness") or {}).get("conditions") or []
        if any(not c["decision"] for c in conds):
            s.put(f"{P}/quotes/{a['quote_id']}", json={"fields": {"condition_decisions": {c["text"]: "resolved" for c in conds}}})
            pv = s.get(f"{P}/quotes/{a['quote_id']}/preview").json()
        r = s.post(f"{P}/quotes/{a['quote_id']}/issue", json={"digest": pv["digest"]})
        assert r.status_code == 200, r.text
        t2 = r.json()["path"].split("/quote/")[1]
        CTX["qtoken2"] = t2
        save()
        c = requests.post(f"{BASE_URL}/api/quote/{t2}/code").json()
        ses = requests.post(f"{BASE_URL}/api/quote/{t2}/verify", json={"code": c["synthetic_code"]}).json()["session"]
        body = {"action": "accept", "digest": r.json()["quote"]["digest"], "signer_name": "TEST Demo Buyer", "intent": True, "key": "k-" + uuid.uuid4().hex}
        r1 = requests.post(f"{BASE_URL}/api/quote/{t2}/respond", headers={"X-Quote-Session": ses}, json=body)
        assert r1.status_code == 200 and r1.json()["state"] == "accepted", r1.text
        r2 = requests.post(f"{BASE_URL}/api/quote/{t2}/respond", headers={"X-Quote-Session": ses}, json=body)
        assert r2.status_code == 200 and r2.json()["receipt"]["receipt_id"] == r1.json()["receipt"]["receipt_id"]
        qs = s.get(f"{P}/quotes").json()["quotes"]
        print("QUOTES", [(x["number"], x["kind"], x["state"], (x.get("snapshot") or {}).get("price_cents")) for x in qs])
        q1 = next(x for x in qs if x["quote_id"] == CTX["qid"])
        assert q1["digest"] == CTX["q1_digest"] and q1["snapshot"] == CTX["q1_snap"]
        assert sum(1 for x in qs if x["kind"] == "amendment" and x["state"] == "accepted") == 1

    # Strict: the plain draft respects each firm's quoted site limit (fails while the generator ignores max_sites)
    def test_08_draft_respects_quoted_limits(self):
        resume()
        assert not CTX.get("quoted_limits_bug"), "POST /draft assigned a firm more sites than its quoted max_sites; plan fails quoted_limits and cannot be selected"

    # Strict: issuing a new base offer while an earlier offer is still open must supersede it (no two accepted offers)
    def test_09_no_two_live_base_offers(self):
        s = login("organizer@demo.assemble.test", "t28q-" + uuid.uuid4().hex[:10])
        s.headers["X-Project-Id"] = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST two offers"}).json()["project_id"]
        f = {"customer_name": "TEST Buyer", "customer_email": "buyer@demo.assemble.test", "site": "X", "timing": "Soon", "tax_basis": "Sales tax extra",
             "payment_terms": "Net 30", "scope": "Lighting", "valid_until": (date.today() + timedelta(days=30)).isoformat() + "T00:00:00Z"}
        toks = []
        for price in (100000, 120000):
            q = s.post(f"{P}/quotes", json={"amend_of": None}).json()["quote"]
            s.put(f"{P}/quotes/{q['quote_id']}", json={"fields": {**f, "price_cents": price}})
            pv = s.get(f"{P}/quotes/{q['quote_id']}/preview").json()
            r = s.post(f"{P}/quotes/{q['quote_id']}/issue", json={"digest": pv["digest"]})
            assert r.status_code == 200, r.text
            toks.append((r.json()["path"].split("/quote/")[1], r.json()["quote"]["digest"]))
        acc = 0
        for tok, dg in toks:
            c = requests.post(f"{BASE_URL}/api/quote/{tok}/code").json()
            ses = requests.post(f"{BASE_URL}/api/quote/{tok}/verify", json={"code": c["synthetic_code"]}).json()["session"]
            r = requests.post(f"{BASE_URL}/api/quote/{tok}/respond", headers={"X-Quote-Session": ses},
                              json={"action": "accept", "digest": dg, "signer_name": "TEST", "intent": True, "key": "k-" + uuid.uuid4().hex})
            print("ACCEPT", r.status_code, r.text[:120])
            acc += r.status_code == 200 and r.json().get("state") == "accepted"
        qs = [(x["number"], x["kind"], x["state"]) for x in s.get(f"{P}/quotes").json()["quotes"]]
        print("QUOTES", qs)
        assert acc <= 1, f"two independent base offers both accepted: {qs}"


# Regression: 'capacity 1 per week' with no week fills every week
class TestCapacityEveryWeek:
    def test_capacity_every_week(self):
        s = login("organizer@demo.assemble.test", "t28c-" + uuid.uuid4().hex[:10])
        pid = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST capacity"}).json()["project_id"]
        s.headers["X-Project-Id"] = pid
        ask(s, "Job: Elm St lighting for Beta Co. 3 sites: S01 Office, S02 Shop, S03 Depot. 3 weeks starting 2026-11-02. "
               "Partner Alder Line Electric alder@demo.assemble.test, $8,000 per site, capacity 1 per week.")
        it = sh(s)["intake"]
        a = next(p for p in it["partners"] if "alder" in p["name"].lower())
        print("CAP", it.get("weeks"), a.get("capacity"))
        assert a["capacity"] and len(a["capacity"]) == it["weeks"] and all(c == 1 for c in a["capacity"]), a["capacity"]


# Assistant 'advance' on a demo project: drafted plan should pass the checker (generator must respect quoted site limits)
class TestDemoAdvance:
    def test_assistant_drafts_demo_plan(self):
        s = login("organizer@demo.assemble.test", "t28a-" + uuid.uuid4().hex[:10])
        pid = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST Demo advance"}).json()["project_id"]
        s.headers["X-Project-Id"] = pid
        j = ask(s, "Build a California lighting-retrofit demo")
        assert j["reply"].get("mode") == "demo"
        j = ask(s, "Draft the plan")
        rep = j["reply"]
        sheet = sh(s)
        cur = sheet.get("preview") or sheet.get("current")
        print("ADVANCE", rep.get("mode"), rep.get("errors"), rep.get("text", "")[:400])
        assert cur, "no plan drafted"
        fails = [d for r in cur["checker"]["rules"] if r["status"] == "fail" for d in r["details"]]
        print("ADV_FAILS", fails, [(p["name"], p.get("max_sites")) for p in sheet["intake"]["partners"]])
        assert rep.get("mode") == "advance"
        assert not fails, fails
