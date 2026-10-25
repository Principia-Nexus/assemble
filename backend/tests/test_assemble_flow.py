# Assemble Phase 1 MVP - end-to-end API regression (auth, intake, draft, links, review, amendments, sandbox)
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
PW = "synthetic-demo"
VISITOR = "test-" + uuid.uuid4().hex[:16]


def login(key, visitor=VISITOR):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": f"{key}@demo.assemble.test", "password": PW,
                                                   "visitor_id": visitor})
    assert r.status_code == 200, r.text
    return s


def to_raw(it):
    d = lambda c: None if c is None else str(c / 100)
    return {**{k: it[k] for k in ("job_name", "customer_name", "scope_summary", "start_date", "weeks", "own_capacity",
                                  "sites")},
            "budget_ceiling": d(it["budget_ceiling_cents"]), "own_cost_per_site": d(it["own_cost_per_site_cents"]),
            "partners": [{**p, "price_per_site": d(p["price_per_site_cents"])} for p in it["partners"]]}


def status_map(sheet, which="current"):
    return {x["partner_id"]: x["status"] for x in sheet[which]["partners"]}


@pytest.fixture(scope="module")
def ctx():
    return {"org": login("organizer")}


def get_sheet(org):
    r = org.get(f"{BASE_URL}/api/project")
    assert r.status_code == 200
    return r.json()["sheet"]


# Auth
class TestAuth:
    def test_demo_accounts(self):
        r = requests.get(f"{BASE_URL}/api/auth/demo-accounts")
        assert r.status_code == 200
        d = r.json()
        assert d["password"] == PW
        assert {a["key"] for a in d["accounts"]} == {"organizer", "alder", "birch", "cedar", "redwood", "dogwood"}

    def test_demo_login_needs_visitor(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "organizer@demo.assemble.test", "password": PW})
        assert r.status_code == 400

    def test_demo_wrong_password(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "organizer@demo.assemble.test",
                                                              "password": "nope", "visitor_id": VISITOR})
        assert r.status_code == 401

    def test_register_and_create_project(self):
        s = requests.Session()
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST User", "email": email,
                                                          "password": "password123", "firm_name": "TEST Firm"})
        assert r.status_code == 200, r.text
        assert "access_token" in r.headers.get("set-cookie", "") and "HttpOnly" in r.headers.get("set-cookie", "")
        assert s.get(f"{BASE_URL}/api/project").json()["sheet"] is None
        r = s.post(f"{BASE_URL}/api/project", json={"name": "TEST job"})
        assert r.status_code == 200
        assert r.json()["sheet"]["intake"]["job_name"] == "TEST job"
        assert s.post(f"{BASE_URL}/api/project", json={"name": "x"}).status_code == 200
        assert len(s.get(f"{BASE_URL}/api/projects").json()["projects"]) == 2
        # login again + duplicate register
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "password123"})
        assert r.status_code == 200
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"name": "a", "email": email,
                                                                 "password": "password123", "firm_name": "b"})
        assert r.status_code == 400

    def test_origin_guard(self, ctx):
        r = ctx["org"].post(f"{BASE_URL}/api/project/draft", json={"select": True, "rev": 0, "partner_ids": []},
                            headers={"Origin": "https://evil.example.com"})
        assert r.status_code == 403


# Full organizer + partner flow (ordered)
class TestFlow:
    def test_01_intake_seed(self, ctx):
        sh = get_sheet(ctx["org"])
        it = sh["intake"]
        assert [s["site_id"] for s in it["sites"]] == [f"S{i:02d}" for i in range(1, 13)]
        assert it["weeks"] == 3 and it["budget_ceiling_cents"] == 18000000
        assert [p["partner_id"] for p in it["partners"]] == ["alder", "birch", "cedar", "redwood", "dogwood"]

    def test_02_invalid_intake_saves_nothing(self, ctx):
        sh = get_sheet(ctx["org"])
        raw = to_raw(sh["intake"])
        raw["budget_ceiling"] = "180k"
        raw["start_date"] = "2026-13-45"
        r = ctx["org"].put(f"{BASE_URL}/api/project/intake", json={"rev": sh["project"]["rev"], "intake": raw})
        assert r.status_code == 422
        assert len(r.json()["detail"]) >= 2
        sh2 = get_sheet(ctx["org"])
        assert sh2["project"]["rev"] == sh["project"]["rev"]
        assert sh2["intake"]["budget_ceiling_cents"] == 18000000

    def test_03_blank_field_unknown_then_restore(self, ctx):
        sh = get_sheet(ctx["org"])
        raw = to_raw(sh["intake"])
        raw["customer_name"] = ""
        r = ctx["org"].put(f"{BASE_URL}/api/project/intake", json={"rev": sh["project"]["rev"], "intake": raw})
        assert r.status_code == 200, r.text
        assert "Customer: unknown" in r.json()["sheet"]["gap"]["unknowns"]
        sh = r.json()["sheet"]
        raw = to_raw(sh["intake"])
        raw["customer_name"] = "Harborview Credit Union (Synthetic)"
        r = ctx["org"].put(f"{BASE_URL}/api/project/intake", json={"rev": sh["project"]["rev"], "intake": raw})
        assert r.status_code == 200
        # stale rev
        r = ctx["org"].put(f"{BASE_URL}/api/project/intake", json={"rev": sh["project"]["rev"], "intake": raw})
        assert r.status_code == 409

    def test_04_draft_alder_redwood_fails(self, ctx):
        sh = get_sheet(ctx["org"])
        r = ctx["org"].post(f"{BASE_URL}/api/project/draft",
                            json={"select": True, "rev": sh["project"]["rev"], "partner_ids": ["alder", "redwood"]})
        assert r.status_code == 200, r.text
        cur = r.json()["sheet"]["current"]
        # Sites that no included firm can take stay open (never force-filled), so coverage is partial.
        assert cur["qualification"]["coverage"]["status"] == "partial" and cur["qualification"]["coverage"]["open"]
        assert any("left open" in n for n in cur["version"]["generator_notes"])

    def test_05_draft_abc_passes(self, ctx):
        sh = get_sheet(ctx["org"])
        r = ctx["org"].post(f"{BASE_URL}/api/project/draft",
                            json={"select": True, "rev": sh["project"]["rev"], "partner_ids": ["alder", "birch", "cedar"]})
        assert r.status_code == 200
        chk = r.json()["sheet"]["current"]["checker"]
        assert chk["overall"] == "pass"
        assert "168,000" in str(chk)
        loads = [w["load"] for w in chk.get("weekly_load") or chk.get("weekly")]
        assert loads == [4, 4, 4]

    def test_06_links_and_review(self, ctx):
        sh = get_sheet(ctx["org"])
        toks = {}
        for pid in ("alder", "birch", "cedar"):
            r = ctx["org"].post(f"{BASE_URL}/api/project/links", json={"partner_id": pid})
            assert r.status_code == 200
            toks[pid] = r.json()["link"]["token"]
            assert ctx["org"].post(f"{BASE_URL}/api/project/links/{toks[pid]}/shared").status_code == 200
        # Redwood has no sites
        assert ctx["org"].post(f"{BASE_URL}/api/project/links", json={"partner_id": "redwood"}).status_code == 400
        ctx["toks"] = toks
        alder = login("alder")
        ctx["alder"] = alder
        r = alder.get(f"{BASE_URL}/api/review/{toks['alder']}")
        assert r.status_code == 200
        d = r.json()
        assert [s["site_id"] for s in d["terms"]["sites"]] == ["S01", "S02", "S09", "S10"]
        assert d["terms"]["price_total_cents"] == 5600000
        body = r.text.lower()
        assert "birch" not in body and "cedar" not in body and "16800000" not in body

    def test_07_forwarded_link_403(self, ctx):
        r = ctx["alder"].get(f"{BASE_URL}/api/review/{ctx['toks']['birch']}")
        assert r.status_code == 403
        assert "forwarded" in r.json()["detail"].lower()
        # other visitor's sandbox alder also denied
        other = login("alder", visitor="test-" + uuid.uuid4().hex[:16])
        assert other.get(f"{BASE_URL}/api/review/{ctx['toks']['alder']}").status_code == 403

    def test_08_confirm_all_and_duplicate(self, ctx):
        for pid in ("alder", "birch", "cedar"):
            s = ctx["alder"] if pid == "alder" else login(pid)
            ctx[pid] = s
            d = s.get(f"{BASE_URL}/api/review/{ctx['toks'][pid]}").json()
            key = "idem-" + uuid.uuid4().hex
            body = {"version_id": d["version"]["version_id"], "terms_hash": d["terms_hash"], "action": "confirm",
                    "idempotency_key": key}
            r = s.post(f"{BASE_URL}/api/review/{ctx['toks'][pid]}/respond", json=body)
            assert r.status_code == 200 and r.json()["duplicate"] is False
            r = s.post(f"{BASE_URL}/api/review/{ctx['toks'][pid]}/respond", json=body)
            assert r.status_code == 200 and r.json()["duplicate"] is True
            assert len([x for x in r.json()["review"]["responses"] if x["action"] == "confirm"]) == 1
            if pid == "alder":
                ctx["alder_old"] = body
        sh = get_sheet(ctx["org"])
        assert set(status_map(sh).values()) == {"confirmed"}

    def test_09_customer_change_preview_discard(self, ctx):
        sh = get_sheet(ctx["org"])
        r = ctx["org"].post(f"{BASE_URL}/api/project/change-requests", json={
            "note": "Customer asks to move S09 and S10 into week 1",
            "moves": [{"site_id": "S09", "new_week": 1}, {"site_id": "S10", "new_week": 1}]})
        assert r.status_code == 200
        sh = r.json()["sheet"]
        cr = sh["change_requests"][0]
        assert cr["status"] == "open"
        r = ctx["org"].post(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"],
                                                                     "change_request_id": cr["cr_id"]})
        assert r.status_code == 200, r.text
        pre = r.json()["sheet"]["preview"]
        loads = [w["load"] for w in pre["checker"].get("weekly_load") or pre["checker"].get("weekly")]
        assert loads == [6, 4, 2]
        assert pre["checker"]["overall"] == "fail"
        sh = r.json()["sheet"]
        r = ctx["org"].post(f"{BASE_URL}/api/project/preview/discard", json={"rev": sh["project"]["rev"]})
        assert r.status_code == 200
        sh = r.json()["sheet"]
        assert sh["preview"] is None and set(status_map(sh).values()) == {"confirmed"}
        assert sh["change_requests"][0]["status"] == "open"
        ctx["cr"] = cr["cr_id"]

    def test_10_amend_dogwood_select(self, ctx):
        sh = get_sheet(ctx["org"])
        r = ctx["org"].post(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"],
                                                                     "change_request_id": ctx["cr"]})
        sh = r.json()["sheet"]
        pv = sh["preview"]["version"]
        sites = []
        for s in pv["sites"]:
            a = pv["assignments"][s["site_id"]]
            owner = "dogwood" if s["site_id"] in ("S09", "S10") else a["owner"]
            sites.append({"site_id": s["site_id"], "owner": owner, "week": a["week"], "deadline_week": s["deadline_week"]})
        r = ctx["org"].put(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"], "sites": sites})
        assert r.status_code == 200, r.text
        sh = r.json()["sheet"]
        assert sh["preview"]["checker"]["overall"] == "pass"
        assert "172,000" in str(sh["preview"]["checker"])
        diff = {x["partner_id"]: x for x in sh["preview"]["diff"]["partners"]}
        print({k: v.get("change") or v.get("kind") or v.get("status") for k, v in diff.items()})
        r = ctx["org"].post(f"{BASE_URL}/api/project/preview/select", json={"rev": sh["project"]["rev"]})
        assert r.status_code == 200
        st = status_map(r.json()["sheet"])
        assert st["birch"] == "confirmed" and st["cedar"] == "confirmed"
        assert st["alder"] == "needs_rereview"
        assert st["dogwood"] == "no_link"

    def test_11_stale_partner_submit(self, ctx):
        r = ctx["alder"].post(f"{BASE_URL}/api/review/{ctx['toks']['alder']}/respond",
                              json={**ctx["alder_old"], "idempotency_key": "idem-" + uuid.uuid4().hex})
        assert r.status_code == 409

    def test_12_birch_change_70000(self, ctx):
        s = ctx["birch"]
        d = s.get(f"{BASE_URL}/api/review/{ctx['toks']['birch']}").json()
        r = s.post(f"{BASE_URL}/api/review/{ctx['toks']['birch']}/respond", json={
            "version_id": d["version"]["version_id"], "terms_hash": d["terms_hash"], "action": "request_change",
            "note": "Need more", "proposed_total": "70000", "idempotency_key": "idem-" + uuid.uuid4().hex})
        assert r.status_code == 200, r.text
        sh = get_sheet(ctx["org"])
        cr = next(x for x in sh["change_requests"] if x["source"] == "partner")
        r = ctx["org"].post(f"{BASE_URL}/api/project/preview", json={"rev": sh["project"]["rev"],
                                                                     "change_request_id": cr["cr_id"]})
        assert r.status_code == 200, r.text
        chk = r.json()["sheet"]["preview"]["checker"]
        assert chk["overall"] == "fail" and "186,000" in str(chk)
        sh = r.json()["sheet"]
        ctx["org"].post(f"{BASE_URL}/api/project/preview/discard", json={"rev": sh["project"]["rev"]})

    def test_13_history(self, ctx):
        r = ctx["org"].get(f"{BASE_URL}/api/project/history")
        assert r.status_code == 200 and len(r.json()["events"]) > 10

    def test_14_partner_cannot_reset_or_read_project(self, ctx):
        assert ctx["alder"].get(f"{BASE_URL}/api/project").status_code == 403
        assert ctx["alder"].post(f"{BASE_URL}/api/project/demo-reset").status_code == 403

    def test_15_isolation_and_reset(self, ctx):
        other = login("organizer", visitor="test-" + uuid.uuid4().hex[:16])
        osh = get_sheet(other)
        assert osh["current"] is None and osh["project"]["sandbox_id"] != get_sheet(ctx["org"])["project"]["sandbox_id"]
        r = ctx["org"].post(f"{BASE_URL}/api/project/demo-reset")
        assert r.status_code == 200
        sh = r.json()["sheet"]
        assert sh["current"] is None and sh["links_count"] == 0
        # old link invalid after reset
        assert ctx["alder"].get(f"{BASE_URL}/api/review/{ctx['toks']['alder']}").status_code == 404
