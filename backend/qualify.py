"""Scope requirements, firm evidence and the four assignment results (Fits / Does not fit / Evidence needed / Review needed)."""
import json
import re
from datetime import date
from pathlib import Path

RULES = json.loads((Path(__file__).parent / "rules" / "ca_license_rules.json").read_text())
RULES_VERSION = RULES["version"]
ACTIVE = ("required", "confirmed")
RANK = {"fits": 0, "review_needed": 1, "evidence_needed": 2, "does_not_fit": 3}
LABEL = {"fits": "Fits", "review_needed": "Review needed", "evidence_needed": "Evidence needed", "does_not_fit": "Does not fit", "open": "Open"}


def _hits(text, kws):
    return [k for k in kws if re.search(rf"\b{re.escape(k)}\b", text)]


def suggestions(it, source_labels=()):
    """Rule-grounded suggestions from the job text. Never active until the organizer confirms."""
    text = " ".join([it.get("job_name") or "", it.get("customer_name") or "", *[s.get("name") or "" for s in it.get("sites") or []],
                     *[c.get("text") or "" for c in it.get("job_conditions") or []], *source_labels]).lower()
    out = []
    for c in RULES["classes"]:
        h = _hits(text, c["keywords"])
        if h:
            out.append({"req_id": f"sug-{c['code']}", "code": c["code"], "label": c["label"], "sites": "all", "origin": "rule",
                        "status": "suggested", "source": {"label": f"{RULES['jurisdiction']} rules {RULES_VERSION}"},
                        "reason": f"The job mentions {', '.join(h[:3])}, which is usually {c['label']} work in California."})
    if len(out) >= RULES["general"]["min_specialties"]:
        g = RULES["general"]
        out.append({"req_id": f"sug-{g['code']}", "code": g["code"], "label": g["label"], "sites": "all", "origin": "rule",
                    "status": "suggested", "source": {"label": f"{RULES['jurisdiction']} rules {RULES_VERSION}"}, "reason": g["reason"],
                    "applies_to": "prime"})
    return out


def requirements(p, source_labels=()):
    stored = p.get("requirements") or []
    decided = {r["req_id"] for r in stored}
    return stored + [s for s in suggestions(p["intake"], source_labels) if s["req_id"] not in decided]


def _applies(r, sid):
    return r.get("applies_to") != "prime" and (r["sites"] == "all" or sid in r["sites"])


def _site_result(owner, sid, reqs, evidence, today):
    if not owner:
        return {"status": "open", "reasons": ["No firm assigned."]}
    reasons, worst = [], "fits"
    mine = [e for e in evidence if e["partner_id"] == owner]

    def bump(st, msg):
        nonlocal worst
        reasons.append(msg)
        if RANK[st] > RANK[worst]:
            worst = st
    active = {r["code"].upper() for r in reqs if _applies(r, sid) and r["status"] in ACTIVE}
    relevant = any(e["license_class"].upper() in active for e in mine)
    for r in reqs:
        if not _applies(r, sid) or r["status"] == "dismissed":
            continue
        if r["status"] == "suggested":
            bump("review_needed", f"{r['label']}: suggested requirement not reviewed yet.")
            continue
        match = [e for e in mine if e["license_class"].upper() == r["code"].upper()]
        valid = [e for e in match if not e.get("expires") or date.fromisoformat(e["expires"]) >= today]
        if valid:
            e = valid[0]
            reasons.append(f"{r['label']}: evidence reviewed by {e['reviewed_by']}, {e['reviewed_at'][:10]}"
                           + (f" (expires {e['expires']})" if e.get("expires") else "") + ".")
        elif match:
            bump("does_not_fit", f"{r['label']}: the only evidence expired on {match[0]['expires']}.")
        elif mine and not relevant:
            bump("does_not_fit", f"{r['label']}: evidence on file is {', '.join(sorted({e['license_class'] for e in mine}))}, not {r['code']}.")
        elif mine:
            bump("evidence_needed", f"{r['label']}: no {r['code']} evidence on file yet (has {', '.join(sorted({e['license_class'] for e in mine}))}).")
        else:
            bump("evidence_needed", f"{r['label']}: no licence evidence on file.")
    if not reasons:
        reasons.append("No requirements apply.")
    return {"status": worst, "reasons": reasons}


def assess(v, p, reqs, today=None):
    """Per-site qualification for a plan version, plus coverage kept separate from budget/schedule checks."""
    today = today or date.today()
    ev = p.get("evidence") or []
    sites = {}
    for s in v["sites"]:
        a = v["assignments"].get(s["site_id"]) or {}
        sites[s["site_id"]] = {**_site_result(a.get("owner"), s["site_id"], reqs, ev, today), "owner": a.get("owner")}
    open_ = sorted(k for k, x in sites.items() if x["status"] == "open")
    assigned = [x for x in sites.values() if x["status"] != "open"]
    q = max((x["status"] for x in assigned), key=lambda s: RANK[s]) if assigned else "fits"
    prime = [r for r in reqs if r.get("applies_to") == "prime" and r["status"] != "dismissed"]
    return {"sites": sites, "coverage": {"status": "complete" if not open_ else "partial", "open": open_},
            "qualification": q, "prime": prime, "rules_version": RULES_VERSION}


def blocked_pairs(it, p, reqs, today=None):
    """(site, owner) pairs that definitely do not fit; drafting never uses them."""
    today = today or date.today()
    ev = p.get("evidence") or []
    owners = [x["partner_id"] for x in it["partners"]] + ["own"]
    return {(s["site_id"], o) for s in it["sites"] for o in owners
            if _site_result(o, s["site_id"], reqs, ev, today)["status"] == "does_not_fit"}
