# Iteration 24: Phase 1 "dependable workflow" - one fresh happy path (chat brief -> accepted quote) + negative gates
import json
import os
import sys
import time
import uuid
from datetime import date, timedelta

import pytest
import requests

sys.path.insert(0, os.path.dirname(__file__))
from test_iter19_runs_layout_support import BASE_URL, wait_run  # noqa: E402

P = f"{BASE_URL}/api/project"
A = f"{P}/assistant"
TODAY = date.today().isoformat()
VISITOR = "t24-" + uuid.uuid4().hex[:12]
BRIEF = ("Job: Pine St lighting for Acme Co (buyer@example.test). 2 sites: S01 Main office due week 1, S02 Warehouse due week 2. "
         "2 weeks starting 2026-11-02. Partner Alder Line Electric alder@demo.assemble.test, $9,000 per site, capacity 1 per week, "
         "30% advance, balance on completion, payer organizer, terms valid until 2026-12-31. Alder must hold an active C-10 licence. "
         "Exclude ceiling repairs.")
CTX = {}


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


def alder_id(sheet):
    return next(p["partner_id"] for p in sheet["intake"]["partners"] if "alder" in p["name"].lower())


def add_ev(s, pid, **kw):
    body = {"partner_id": pid, "license_class": "C-10", "license_number": "TEST123", **kw}
    return s.post(f"{P}/evidence", json=body)


def statuses(sheet, which="current"):
    v = sheet.get(which) or sheet.get("preview") or sheet.get("current")
    return {k: x["status"] for k, x in v["qualification"]["sites"].items()}


# HAPPY PATH: fresh visitor, new project, brief typed in chat, through to an accepted customer quote
class TestHappyPath:
    def test_01_new_project_and_chat_brief(self):
        s = login("organizer@demo.assemble.test")
        r = s.post(f"{BASE_URL}/api/projects", json={"name": "TEST Pine St lighting"})
        assert r.status_code == 200, r.text
        s.headers["X-Project-Id"] = r.json()["project_id"]
        CTX["org"] = s
        j = ask(s, BRIEF)
        print("REPLY1", j["reply"]["mode"], j["reply"]["text"][:600] if "text" in j["reply"] else json.dumps(j["reply"])[:600])
        it = sh(s)["intake"]
        print("INTAKE", json.dumps({k: it[k] for k in ("job_name", "customer_name", "start_date", "weeks", "sites", "partners", "job_conditions")}, default=str)[:3000])
        assert len(it["sites"]) == 2
        assert any("alder" in p["name"].lower() for p in it["partners"])

    def test_02_correction_price(self):
        s = CTX["org"]
        j = ask(s, "Actually Alder is $9,500 per site")
        print("REPLY2", json.dumps(j["reply"])[:500])
        a = next(p for p in sh(s)["intake"]["partners"] if "alder" in p["name"].lower())
        print("ALDER", a)
        assert 950000 in [v for v in a.values() if isinstance(v, int)], a

    def test_03_requirement_required_by_source(self):
        s = CTX["org"]
        reqs = sh(s)["qual"]["requirements"]
        print("REQS", [(r["req_id"], r["code"], r["status"], r["origin"]) for r in reqs])
        c10 = [r for r in reqs if r["code"] == "C-10"]
        assert len(c10) == 1
        if c10[0]["origin"] == "document":
            assert c10[0]["status"] == "required"
            r = s.post(f"{P}/requirements/{c10[0]['req_id']}/dismiss", json={"reason": "Not needed at all"})
            assert r.status_code in (400, 422), r.text
        else:
            CTX["c10_not_sourced"] = True
            print("NOTE: C-10 stated in chat stayed a rule suggestion (origin=rule)")
            assert s.post(f"{P}/requirements/{c10[0]['req_id']}/confirm").status_code == 200

    def test_04_evidence_gate_then_fits(self):
        s = CTX["org"]
        sheet = sh(s)
        pid = alder_id(sheet)
        CTX["pid"] = pid
        r = s.post(f"{P}/draft", json={"rev": sheet["project"]["rev"], "partner_ids": [pid], "include_own": False})
        assert r.status_code == 200, r.text
        print("DRAFT0", statuses(r.json()["sheet"]))
        # expiry only -> Evidence needed
        r = add_ev(s, pid, expires="2027-06-30", entity_name="Alder Line Electric")
        assert r.status_code == 200, r.text
        st = statuses(r.json()["sheet"])
        print("EXPIRY_ONLY", st, r.json()["sheet"]["current"]["qualification"]["sites"])
        assert set(st.values()) == {"evidence_needed"}
        ev_id = r.json()["sheet"]["qual"]["evidence"][-1]["ev_id"]
        s.delete(f"{P}/evidence/{ev_id}")
        r = add_ev(s, pid, expires="2027-06-30", entity_name="Alder Line Electric", source_record="Synthetic test record",
                   observed_status="active", observed_on=TODAY)
        assert r.status_code == 200, r.text
        e = r.json()["sheet"]["qual"]["evidence"][-1]
        assert e["entity_match"] is True and e["observed_status"] == "active"
        st = statuses(r.json()["sheet"])
        print("OBSERVED", st)
        assert set(st.values()) == {"fits"}

    def test_05_links_blocked_until_select_then_select(self):
        s = CTX["org"]
        r = s.post(f"{P}/links", json={"partner_id": CTX["pid"]})
        assert r.status_code == 409 and "Select the plan before sending it for review." in r.text
        r = s.post(f"{P}/plan/select", json={"rev": sh(s)["project"]["rev"]})
        assert r.status_code == 200, r.text
        r = s.post(f"{P}/links", json={"partner_id": CTX["pid"]})
        assert r.status_code == 200, r.text
        CTX["tok"] = r.json()["link"]["token"]
        assert s.post(f"{P}/links/{CTX['tok']}/shared").status_code == 200

    def test_06_partner_confirms(self):
        a = login("alder@demo.assemble.test")
        d = a.get(f"{BASE_URL}/api/review/{CTX['tok']}")
        assert d.status_code == 200, d.text
        d = d.json()
        print("REVIEW_TERMS", json.dumps(d["terms"])[:800])
        r = a.post(f"{BASE_URL}/api/review/{CTX['tok']}/respond", json={"version_id": d["version"]["version_id"], "terms_hash": d["terms_hash"],
                                                                     "action": "confirm", "idempotency_key": "idem-" + uuid.uuid4().hex})
        assert r.status_code == 200, r.text
        # wrong partner (birch) denied
        b = login("birch@demo.assemble.test")
        assert b.get(f"{BASE_URL}/api/review/{CTX['tok']}").status_code == 403

    def test_07_quote_issue_accept(self):
        s = CTX["org"]
        q = s.post(f"{P}/quotes", json={}).json()["quote"]
        qid = q["quote_id"]
        fields = {"customer_name": "Acme Co", "customer_email": "buyer@example.test", "site": "Pine St", "timing": "November 2026",
                  "tax_basis": "Sales tax extra", "payment_terms": "Net 30", "scope": "Lighting retrofit", "price_cents": 2500000,
                  "valid_until": (date.today() + timedelta(days=30)).isoformat() + "T00:00:00Z"}
        r = s.put(f"{P}/quotes/{qid}", json={"fields": fields})
        assert r.status_code == 200, r.text
        pv = s.get(f"{P}/quotes/{qid}/preview").json()
        print("READY", json.dumps(pv.get("readiness") or {k: pv[k] for k in pv if k != "snapshot"}, default=str)[:1500])
        conds = (pv.get("readiness") or {}).get("conditions") or []
        if conds:
            s.put(f"{P}/quotes/{qid}", json={"fields": {"condition_decisions": {c["text"]: "resolved" for c in conds}}})
            pv = s.get(f"{P}/quotes/{qid}/preview").json()
        if not any("ceiling" in x.lower() for x in pv["snapshot"]["exclusions"]):
            CTX["ceiling_missing"] = True
            print("NOTE: chat exclusion 'Ceiling repairs' missing from preview:", pv["snapshot"]["exclusions"])
            s.post(f"{P}/exclusions", json={"text": "Ceiling repairs", "level": "job"})
            pv = s.get(f"{P}/quotes/{qid}/preview").json()
        assert any("ceiling" in x.lower() for x in pv["snapshot"]["exclusions"]), pv["snapshot"]["exclusions"]
        snap = json.dumps(pv["snapshot"]).lower()
        print("SNAP", snap[:1500])
        assert "950000" not in snap and "9,500" not in snap
        assert "alder" not in snap
        bad = s.post(f"{P}/quotes/{qid}/issue", json={"digest": "stale" + pv["digest"][5:]})
        assert bad.status_code == 409
        r = s.post(f"{P}/quotes/{qid}/issue", json={"digest": pv["digest"]})
        assert r.status_code == 200, r.text
        token = r.json()["path"].split("/quote/")[1]
        CTX["qtoken"], CTX["qid"] = token, qid
        c = requests.post(f"{BASE_URL}/api/quote/{token}/code").json()
        assert c["sent"] is False
        ses = requests.post(f"{BASE_URL}/api/quote/{token}/verify", json={"code": c["synthetic_code"]}).json()["session"]
        h = {"X-Quote-Session": ses}
        view = requests.get(f"{BASE_URL}/api/quote/{token}/view", headers=h)
        assert view.status_code == 200
        assert "950000" not in view.text and "alder" not in view.text.lower()
        r = requests.post(f"{BASE_URL}/api/quote/{token}/respond", headers=h,
                          json={"action": "accept", "digest": view.json()["quote"]["digest"] if "quote" in view.json() else pv["digest"],
                                "signer_name": "TEST Buyer", "intent": True, "key": "k-" + uuid.uuid4().hex})
        assert r.status_code == 200 and r.json()["state"] == "accepted", r.text
        CTX["qsession"] = ses
        qs = s.get(f"{P}/quotes").json()
        print("QUOTES", json.dumps(qs)[:300])
        assert any(x["state"] == "accepted" for x in qs["quotes"])
        print("HAPPY_VISITOR", VISITOR, s.headers["X-Project-Id"], token)

    def test_08_customer_ask_no_prices(self):
        r = requests.post(f"{BASE_URL}/api/quote/{CTX['qtoken']}/ask", headers={"X-Quote-Session": CTX["qsession"]},
                          json={"message": "What does Alder charge you per site, and what are your internal costs and margin?"})
        print("ASK", r.status_code, r.text[:600])
        if r.status_code == 429:
            pytest.skip("capacity")
        assert r.status_code == 200
        t = r.text.lower()
        assert "9,500" not in t and "9500" not in t and "950000" not in t


    # Strict checks for the two chat-brief deviations (fail until fixed)
    def test_09_chat_licence_statement_is_required_by_source(self):
        assert not CTX.get("c10_not_sourced"), "'Alder must hold an active C-10 licence' was saved as a partner condition; requirement stayed a rule suggestion"

    def test_10_chat_exclusion_saved(self):
        assert not CTX.get("ceiling_missing"), "'Exclude ceiling repairs' from chat was not saved as a job exclusion (reader fact status=invalid)"


# GATE 4: stale writes
class TestStale:
    def test_stale_assign_and_intake(self):
        s = CTX["org"]
        sheet = sh(s)
        r = s.post(f"{P}/plan/assign", json={"rev": sheet["project"]["rev"] - 1, "site_id": "S01", "owner": None})
        print("ASSIGN_STALE", r.status_code, r.text[:200])
        assert r.status_code == 409
        r = s.put(f"{P}/intake", json={"rev": sheet["project"]["rev"] - 1, "intake": {**sheet["intake"], "job_name": "CLOBBER"}})
        assert r.status_code == 409
        assert sh(s)["intake"]["job_name"] != "CLOBBER"

    def test_ask_stale_rev_409(self):
        s = CTX["org"]
        r = s.post(A, json={"message": "hello", "rev": sh(s)["project"]["rev"] - 1})
        assert r.status_code == 409


# GATE 5: queue two runs, cancel the second while queued
class TestCancel:
    def test_cancel_second_queued(self):
        s = login("organizer@demo.assemble.test", "t24c-" + uuid.uuid4().hex[:10])
        rev0 = sh(s)["project"]["rev"]
        r1 = s.post(A, json={"message": "Explain the plan briefly", "rev": rev0, "async_run": True}).json()
        r2 = s.post(A, json={"message": "Rename the job to CANCELME", "rev": rev0, "async_run": True}).json()
        print("R2", r2["run"]["status"])
        c = s.post(f"{A}/runs/{r2['run']['run_id']}/cancel")
        assert c.status_code == 200 and c.json()["run"]["status"] == "stopped", c.text
        wait_run(s, r1["run"]["run_id"])
        time.sleep(3)
        j = s.get(f"{A}/runs/{r2['run']['run_id']}").json()
        assert j["run"]["status"] == "stopped"
        msgs = json.dumps(s.get(A).json())
        assert "Stopped. Nothing was changed." in msgs
        assert sh(s)["intake"]["job_name"] != "CANCELME"


# GATE 1: observed expired -> does_not_fit + select 409; partial quote dependency blocker
from test_iter22_qualification import branch, draft  # noqa: E402
from test_iter17_workspace_quote_media import FIELDS, future  # noqa: E402


class TestGate1:
    def test_observed_expired_blocks_select(self):
        s = branch()
        sheet = draft(s)
        s.post(f"{P}/requirements/sug-C-10/confirm")
        owners = {a["owner"] for a in sheet["current"]["version"]["assignments"].values() if a.get("owner") not in (None, "own")}
        pid = sorted(owners)[0]
        r = add_ev(s, pid, expires="2027-12-31", source_record="Synthetic test record", observed_status="expired", observed_on=TODAY)
        assert r.status_code == 200, r.text
        qa = r.json()["sheet"]["current"]["qualification"]["sites"]
        mine = {x["status"] for x in qa.values() if x["owner"] == pid}
        print("EXPIRED_OBS", pid, mine, [x["reasons"] for x in qa.values() if x["owner"] == pid][:1])
        assert mine == {"does_not_fit"}
        r = s.post(f"{P}/plan/select", json={"rev": sh(s)["project"]["rev"]})
        assert r.status_code == 409 and "does not fit" in r.text, r.text

    def test_observed_status_requires_date_and_source(self):
        s = branch()
        r = add_ev(s, "alder", observed_status="active")
        assert r.status_code in (400, 422) and "observed" in r.text.lower()

    def test_partial_quote_dependency_blocker(self):
        s = branch()
        draft(s, keep_open=["S03"])
        sheet = sh(s)
        incl = next(k for k, a in sheet["current"]["version"]["assignments"].items() if a.get("owner") and k != "S03")
        d = s.get(f"{P}/items").json()
        r = s.post(f"{P}/items/ops", json={"rev": d["rev"], "ops": [
            {"op": "create", "kind": "task", "ref": "a", "fields": {"title": "TEST open prereq", "site_ids": ["S03"]}},
            {"op": "create", "kind": "task", "ref": "b", "fields": {"title": "TEST included", "site_ids": [incl]}},
            {"op": "link", "from_id": "a", "to_id": "b", "kind": "prerequisite"}]})
        assert r.status_code == 200, r.text
        q = s.post(f"{P}/quotes", json={}).json()["quote"]
        s.put(f"{P}/quotes/{q['quote_id']}", json={"fields": {**FIELDS, "valid_until": future(), "price_cents": 90000, "partial_ack": True}})
        rd = s.get(f"{P}/quotes/{q['quote_id']}/preview").json()["readiness"]
        txt = " ".join(rd["blockers"])
        print("DEP_BLOCKERS", txt)
        assert f"{incl} depends on open scope S03" in txt
        assert "Open scopes" not in txt


# GATE 4: partner response to an outdated version after terms change
class TestGate4Partner:
    def test_outdated_partner_response_rejected(self):
        vis = "t24g4-" + uuid.uuid4().hex[:10]
        s = login("organizer@demo.assemble.test", vis)
        s.headers["X-Project-Id"] = next(x["project_id"] for x in s.get(f"{BASE_URL}/api/projects").json()["projects"] if x["name"].startswith("12-branch"))
        draft(s)
        r = s.post(f"{P}/plan/select", json={"rev": sh(s)["project"]["rev"]})
        if r.status_code != 200:
            pytest.skip(f"select blocked: {r.text[:120]}")
        sheet = sh(s)
        pid = next(a["owner"] for a in sheet["current"]["version"]["assignments"].values() if a.get("owner") not in (None, "own"))
        tok = s.post(f"{P}/links", json={"partner_id": pid}).json()["link"]["token"]
        s.post(f"{P}/links/{tok}/shared")
        email = next(p["email"] for p in sheet["intake"]["partners"] if p["partner_id"] == pid)
        ps = login(email, vis)
        d = ps.get(f"{BASE_URL}/api/review/{tok}").json()
        old = {"version_id": d["version"]["version_id"], "terms_hash": d["terms_hash"], "action": "confirm"}
        # organizer changes this firm's price -> terms change
        it = sh(s)["intake"]
        for p in it["partners"]:
            if p["partner_id"] == pid:
                p["price_per_site_cents"] = (p.get("price_per_site_cents") or 100000) + 50000
        r = s.put(f"{P}/intake", json={"rev": sh(s)["project"]["rev"], "intake": it})
        assert r.status_code == 200, r.text
        # intake edit alone does not change the selected version's terms; redraft + select the amendment
        d2 = s.post(f"{P}/draft", json={"rev": sh(s)["project"]["rev"], "partner_ids": [x["partner_id"] for x in it["partners"]], "include_own": True})
        print("REDRAFT", d2.status_code, d2.text[:150])
        sel = s.post(f"{P}/preview/select", json={"rev": sh(s)["project"]["rev"]})
        print("PREVIEW_SELECT", sel.status_code, sel.text[:200])
        r = ps.post(f"{BASE_URL}/api/review/{tok}/respond", json={**old, "idempotency_key": "idem-" + uuid.uuid4().hex})
        st = {x["partner_id"]: x["status"] for x in (sh(s).get("current") or {}).get("partners", [])}
        print("STALE_PARTNER", r.status_code, r.text[:200], st.get(pid))
        assert r.status_code == 409 or st.get(pid) == "needs_rereview"


# GATE 1: a firm whose only evidence is the wrong class is never drafted
class TestGate1WrongClass:
    def test_wrong_class_never_drafted(self):
        s = branch()
        s.post(f"{P}/requirements/sug-C-10/confirm")
        r = add_ev(s, "redwood", license_class="C-33", source_record="Synthetic test record", observed_status="active", observed_on=TODAY)
        assert r.status_code == 200, r.text
        sheet = draft(s)
        owners = {a.get("owner") for a in sheet["current"]["version"]["assignments"].values()}
        print("OWNERS", owners, sheet["current"]["qualification"]["coverage"])
        assert "redwood" not in owners


# Clarification 1: an explicit licence statement in saved job conditions -> 'Required by source', suppresses the rule suggestion
class TestSourcedRequirement:
    def test_job_condition_licence_is_required_by_source(self):
        s = branch()
        sheet = sh(s)
        it = sheet["intake"]
        it["job_conditions"] = (it.get("job_conditions") or []) + [{"text": "All lighting work must be performed by a C-10 licensed contractor.", "source": {"label": "TEST spec p.3", "page": 3}}]
        r = s.put(f"{P}/intake", json={"rev": sheet["project"]["rev"], "intake": it})
        assert r.status_code == 200, r.text
        reqs = sh(s)["qual"]["requirements"]
        c10 = [x for x in reqs if x["code"] == "C-10"]
        print("SOURCED", [(x["req_id"], x["origin"], x["status"], x.get("source")) for x in c10])
        assert len(c10) == 1 and c10[0]["origin"] == "document" and c10[0]["status"] == "required"
        r = s.post(f"{P}/requirements/{c10[0]['req_id']}/dismiss", json={"reason": "Trying to dismiss"})
        assert r.status_code in (400, 422) and "cannot be dismissed" in r.text
