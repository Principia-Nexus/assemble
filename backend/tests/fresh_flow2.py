# Stage 2 of the fresh completion path: contacts, evidence, baseline, review, quote, acceptance, v2. Run after fresh_flow.py.
import json
import sys
import uuid
from datetime import date, timedelta

import requests

from fresh_flow import BASE, P, log, login, sheet, OUT

FIRM_KEYS = ["alder", "birch", "cedar", "dogwood", "redwood"]


def total(ch):
    return ch["total_cents"], next(r for r in ch["rules"] if r["key"] == "ceiling")["details"]


def main(visitor, pid):
    s = login("organizer@demo.assemble.test", visitor)
    s.headers["X-Project-Id"] = pid
    sh = sheet(s)
    it = sh["intake"]
    for p in it["partners"]:
        k = next(x for x in FIRM_KEYS if x in p["name"].lower())
        p["email"] = f"{k}@demo.assemble.test"
    body = {**it, "budget_ceiling": it["budget_ceiling_cents"] / 100, "coordination": it["coordination_cents"] / 100,
            "contingency": it["contingency_cents"] / 100,
            "partners": [{**p, "price_per_site": p["price_per_site_cents"] / 100} for p in it["partners"]]}
    r = s.put(f"{P}/intake", json={"rev": sh["project"]["rev"], "intake": body})
    assert r.status_code == 200, r.text
    log("contacts", [(p["name"], p["email"]) for p in r.json()["sheet"]["intake"]["partners"]])
    reqs = r.json()["sheet"]["qual"]["requirements"]
    for q in reqs:
        if q["status"] == "suggested" and q.get("applies_to") != "prime":
            s.post(f"{P}/requirements/{q['req_id']}/confirm")
        elif q["status"] == "suggested":
            s.post(f"{P}/requirements/{q['req_id']}/dismiss", json={"reason": "Organizer holds the prime licence (test record)"})
    codes = sorted({q["code"] for q in sheet(s)["qual"]["requirements"] if q["status"] in ("required", "confirmed") and q.get("applies_to") != "prime"})
    log("codes", codes)
    # negative: wrong class and expired status
    al = next(p["partner_id"] for p in it["partners"] if "alder" in p["name"].lower())
    wrong = s.post(f"{P}/evidence", json={"partner_id": al, "license_class": "C-33", "source_record": "Fictional test record", "observed_status": "active", "observed_on": date.today().isoformat()})
    exp = s.post(f"{P}/evidence", json={"partner_id": al, "license_class": codes[0] if codes else "C-10", "source_record": "Fictional test record", "observed_status": "expired", "observed_on": date.today().isoformat()})
    r = s.post(f"{P}/draft", json={"rev": sheet(s)["project"]["rev"], "partner_ids": [p["partner_id"] for p in it["partners"]], "include_own": False})
    neg = {k: v["status"] for k, v in r.json()["sheet"]["current"]["qualification"]["sites"].items() if v.get("owner") == al}
    log("neg_wrong_or_expired_licence", {"alder_sites": neg, "assigned_to_alder": bool(neg)})
    for e in sheet(s)["qual"]["evidence"]:
        s.delete(f"{P}/evidence/{e['ev_id']}")
    for p in it["partners"]:
        for c in codes:
            s.post(f"{P}/evidence", json={"partner_id": p["partner_id"], "license_class": c, "license_number": "FICT-0001", "entity_name": p["name"],
                                          "source_record": "Fictional test record", "observed_status": "active", "observed_on": date.today().isoformat(),
                                          "expires": "2027-12-31"})
    r = s.post(f"{P}/draft", json={"rev": sheet(s)["project"]["rev"], "partner_ids": [p["partner_id"] for p in it["partners"]], "include_own": False})
    assert r.status_code == 200, r.text
    cur = r.json()["sheet"]["current"]
    names = {p["partner_id"]: p["name"] for p in it["partners"]}
    log("baseline", {"total": total(cur["checker"]), "overall": cur["checker"]["overall"],
                     "assign": {k: (names.get(a["owner"]), a["week"]) for k, a in sorted(cur["version"]["assignments"].items())},
                     "fails": [r["label"] + ": " + " ".join(r["details"]) for r in cur["checker"]["rules"] if r["status"] != "pass"]})
    sel = s.post(f"{P}/plan/select", json={"rev": sheet(s)["project"]["rev"]})
    log("select", sel.status_code if sel.status_code == 200 else sel.text)
    toks = {}
    for o in {a["owner"] for a in cur["version"]["assignments"].values() if a["owner"]}:
        lk = s.post(f"{P}/links", json={"partner_id": o})
        assert lk.status_code == 200, lk.text
        toks[o] = lk.json()["link"]["token"]
        s.post(f"{P}/links/{toks[o]}/shared")
    for o, tok in toks.items():
        k = next(x for x in FIRM_KEYS if x in names[o].lower())
        a = login(f"{k}@demo.assemble.test", visitor)
        d = a.get(f"{BASE}/api/review/{tok}").json()
        other = [x["site_id"] for x in d["terms"]["sites"]]
        body = {"version_id": d["version"]["version_id"], "terms_hash": d["terms_hash"], "action": "confirm", "idempotency_key": "i-" + uuid.uuid4().hex}
        if k == "birch":
            body["conditions"] = "Brightline arranges lift rental at each branch."
        rr = a.post(f"{BASE}/api/review/{tok}/respond", json=body)
        log(f"review_{k}", {"status": rr.status_code, "sites": other, "shared_conditions": len(d.get("shared_conditions") or [])})
    q = s.post(f"{P}/quotes", json={}).json()["quote"]
    log("quote_prefill", {k: q.get(k) for k in ("timing", "payment_terms", "price_cents", "customer_name")})
    fields = {"customer_email": "buyer@example.test", "site": "12 Harborview branches", "tax_basis": "Sales tax extra", "scope": "LED retrofit and panel labeling",
              "price_cents": 19800000, "valid_until": (date.today() + timedelta(days=30)).isoformat() + "T00:00:00Z"}
    assert s.put(f"{P}/quotes/{q['quote_id']}", json={"fields": fields}).status_code == 200
    pv = s.get(f"{P}/quotes/{q['quote_id']}/preview").json()
    conds = pv["readiness"]["conditions"]
    log("material_conditions", [c["text"] for c in conds])
    s.put(f"{P}/quotes/{q['quote_id']}", json={"fields": {"condition_decisions": {c["text"]: "in_offer" for c in conds}}})
    pv = s.get(f"{P}/quotes/{q['quote_id']}/preview").json()
    log("blockers", pv["readiness"]["blockers"])
    r = s.post(f"{P}/quotes/{q['quote_id']}/issue", json={"digest": pv["digest"]})
    assert r.status_code == 200, r.text
    tok = r.json()["path"].split("/quote/")[1]
    c = requests.post(f"{BASE}/api/quote/{tok}/code").json()
    ses = requests.post(f"{BASE}/api/quote/{tok}/verify", json={"code": c["synthetic_code"]}).json()["session"]
    h = {"X-Quote-Session": ses}
    view = requests.get(f"{BASE}/api/quote/{tok}/view", headers=h).json()
    leak = [n for n in ("Alder", "Birch", "Cedar", "Dogwood", "Redwood", "12,000", "1200000") if n.lower() in json.dumps(view).lower()]
    ask = requests.post(f"{BASE}/api/quote/{tok}/ask", headers=h, json={"message": "What does each firm charge per branch and what is your margin?"})
    log("customer_ask", {"status": ask.status_code, "text": ask.text[:300]})
    acc = requests.post(f"{BASE}/api/quote/{tok}/respond", headers=h, json={"action": "accept", "digest": (view.get("quote") or {}).get("digest") or pv["digest"], "signer_name": "Fictional Buyer", "intent": True, "key": "k-" + uuid.uuid4().hex})
    log("accept", {"status": acc.status_code, "state": acc.json().get("state"), "leak": leak})
    again = requests.get(f"{BASE}/api/quote/{tok}/view", headers=h).json()
    log("reload", {"customer_state": (again.get("quote") or again).get("state"), "organizer": [x["state"] for x in s.get(f"{P}/quotes").json()["quotes"]]})
    dog = next(p["partner_id"] for p in it["partners"] if "dogwood" in p["name"].lower())
    for sid in ("S01", "S02"):
        r = s.post(f"{P}/plan/assign", json={"rev": sheet(s)["project"]["rev"], "site_id": sid, "owner": dog, "week": 1})
        assert r.status_code == 200, r.text
    sh = sheet(s)
    log("v2", {"preview_total": total(sh["preview"]["checker"]), "v": sh["preview"]["version"]["number"],
               "affected": [(x["name"], x["state"]) for x in sh["preview"]["diff"]["partners"]],
               "current_v": sh["current"]["version"]["number"], "q1": [x["state"] for x in s.get(f"{P}/quotes").json()["quotes"]],
               "v1_responses": [(x["name"], x["status"]) for x in sh["current"]["partners"]]})
    json.dump(OUT, open("/app/test_reports/fresh_flow_completion.json", "w"), indent=1, default=str)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
