import hashlib
import json
import re
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

OWN = "own"
CHECKER_VERSION = "crew-week-checker-1"
PT = ZoneInfo("America/Los_Angeles")
MONEY_RE = re.compile(r"^-?\$?(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$")
INT_RE = re.compile(r"^\d+$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PID_RE = re.compile(r"^[a-z0-9_-]{1,40}$")
RANK = {"pass": 0, "unknown": 1, "fail": 2}


def today_pacific():
    return datetime.now(PT).date()


def blank(v):
    return v is None or (isinstance(v, str) and not v.strip())


# ---------- strict parsing (never silently adjusts) ----------
def text(v, label, e, n=2000):
    if blank(v):
        return None
    s = str(v).strip()
    if len(s) > n:
        e.append(f"{label}: too long ({len(s)} characters, limit {n}).")
        return None
    return s


def money(v, label, e, signed=False):
    if blank(v):
        return None
    s = str(v).strip()
    if not MONEY_RE.match(s) or (s.startswith("-") and not signed):
        e.append(f'{label}: "{s}" is not a valid US dollar amount. Use digits such as 180000 or 180,000.00.')
        return None
    neg = s.startswith("-")
    s = s.lstrip("-").lstrip("$").replace(",", "")
    whole_part, _, frac = s.partition(".")
    cents = int(whole_part) * 100 + int((frac + "00")[:2])
    return -cents if neg else cents


def whole(v, label, e, lo, hi):
    if blank(v):
        return None
    s = str(v).strip()
    if not INT_RE.match(s):
        e.append(f'{label}: "{s}" must be a whole number.')
        return None
    n = int(s)
    if n < lo or n > hi:
        e.append(f"{label}: {n} must be between {lo} and {hi}.")
        return None
    return n


def iso_date(v, label, e):
    if blank(v):
        return None
    s = str(v).strip()
    try:
        if not DATE_RE.match(s):
            raise ValueError
        return date.fromisoformat(s).isoformat()
    except ValueError:
        e.append(f'{label}: "{s}" is not a valid date. Use YYYY-MM-DD.')
        return None


def caps(raw, weeks, label, e):
    if not weeks:
        return []
    raw = raw or []
    if not isinstance(raw, list) or len(raw) > weeks:
        e.append(f"{label}: expected one value per week ({weeks} weeks).")
        return [None] * weeks
    return [whole(raw[i] if i < len(raw) else None, f"{label}, week {i + 1}", e, 0, 50) for i in range(weeks)]


def validate_intake(raw):
    e = []
    weeks = whole(raw.get("weeks"), "Number of weeks", e, 1, 12)
    it = {
        "job_name": text(raw.get("job_name"), "Job name", e, 200),
        "customer_name": text(raw.get("customer_name"), "Customer", e, 200),
        "scope_summary": text(raw.get("scope_summary"), "Scope summary", e, 2000),
        "start_date": iso_date(raw.get("start_date"), "Start date", e),
        "weeks": weeks,
        "budget_ceiling_cents": money(raw.get("budget_ceiling"), "Budget ceiling", e),
        "own_capacity": caps(raw.get("own_capacity"), weeks, "Your crew capacity", e),
        "own_cost_per_site_cents": money(raw.get("own_cost_per_site"), "Your cost per site", e),
        "sites": [],
        "partners": [],
    }
    raw_sites = raw.get("sites") or []
    if len(raw_sites) > 60:
        e.append("A job can have at most 60 sites.")
    seen = set()
    for i, s in enumerate(raw_sites[:60]):
        sid = text(s.get("site_id"), f"Site row {i + 1} ID", e, 20)
        label = sid or f"Site row {i + 1}"
        if not sid:
            e.append(f"Site row {i + 1}: site ID is required.")
        elif sid.upper() in seen:
            e.append(f"Site {sid}: duplicate site ID.")
        else:
            seen.add(sid.upper())
        it["sites"].append({
            "site_id": sid,
            "name": text(s.get("name"), f"{label} name", e, 120),
            "deadline_week": whole(s.get("deadline_week"), f"{label} deadline week", e, 1, weeks or 12),
            "scope": text(s.get("scope"), f"{label} scope", e, 500),
        })
    raw_partners = raw.get("partners") or []
    if len(raw_partners) > 12:
        e.append("A job can have at most 12 partners.")
    pids = set()
    for i, p in enumerate(raw_partners[:12]):
        name = text(p.get("name"), f"Partner row {i + 1} name", e, 120)
        label = name or f"Partner row {i + 1}"
        if not name:
            e.append(f"Partner row {i + 1}: name is required.")
        pid = p.get("partner_id")
        if not (isinstance(pid, str) and PID_RE.match(pid)) or pid in pids:
            pid = "p_" + uuid.uuid4().hex[:8]
        pids.add(pid)
        email = text(p.get("email"), f"{label} email", e, 200)
        if email and not EMAIL_RE.match(email):
            e.append(f'{label} email: "{email}" is not a valid email address.')
            email = None
        it["partners"].append({
            "partner_id": pid,
            "name": name,
            "email": email.lower() if email else None,
            "price_per_site_cents": money(p.get("price_per_site"), f"{label} price per site", e),
            "capacity": caps(p.get("capacity"), weeks, f"{label} capacity", e),
            "max_sites": whole(p.get("max_sites"), f"{label} quoted site limit", e, 0, 100),
            "payer": text(p.get("payer"), f"{label} payer", e, 200),
            "advance_pct": whole(p.get("advance_pct"), f"{label} advance %", e, 0, 100),
            "balance_terms": text(p.get("balance_terms"), f"{label} balance terms", e, 300),
            "conditions": text(p.get("conditions"), f"{label} conditions", e, 1000),
            "exclusions": text(p.get("exclusions"), f"{label} exclusions", e, 1000),
            "scope": text(p.get("scope"), f"{label} scope", e, 1000),
            "valid_until": iso_date(p.get("valid_until"), f"{label} valid until", e),
        })
    raw_conds = raw.get("job_conditions") or []
    if len(raw_conds) > 30:
        e.append("A job can have at most 30 job-wide conditions.")
    it["job_conditions"] = []
    for i, c in enumerate(raw_conds[:30]):
        t = text(c.get("text"), f"Job condition {i + 1}", e, 500)
        if not t:
            e.append(f"Job condition {i + 1}: describe the condition or remove it.")
            continue
        cid = c.get("id")
        it["job_conditions"].append({
            "id": cid if isinstance(cid, str) and PID_RE.match(cid) else "jc_" + uuid.uuid4().hex[:8],
            "text": t, "source": text(c.get("source"), f"Job condition {i + 1} source", e, 300),
            "resolved": c.get("resolved") is True,
        })
    return it, e


def open_conditions(it, v=None):
    out = [{"scope": "Job", "text": c["text"], "source": c.get("source")}
           for c in it.get("job_conditions") or [] if not c.get("resolved")]
    if v:
        for o in sorted(partner_owners(v), key=lambda x: owner_name(v, x)):
            p = pmap(v).get(o) or {}
            if p.get("conditions"):
                out.append({"scope": p.get("name"), "text": p["conditions"], "source": None})
    return out


# ---------- helpers ----------
def pmap(v):
    return {p["partner_id"]: p for p in v.get("partners") or []}


def week_range(start, w):
    if not start or not isinstance(w, int):
        return None, None
    s = date.fromisoformat(start) + timedelta(days=7 * (w - 1))
    return s.isoformat(), (s + timedelta(days=4)).isoformat()


def owner_name(v, oid):
    if oid == OWN:
        return "Your crew"
    return (pmap(v).get(oid) or {}).get("name") or oid


def owner_capacity(v, oid, w):
    c = v.get("own_capacity") if oid == OWN else (pmap(v).get(oid) or {}).get("capacity")
    c = c or []
    return c[w - 1] if isinstance(w, int) and 0 < w <= len(c) else None


def owner_price(v, oid, count):
    if oid == OWN:
        per, adj = v.get("own_cost_per_site_cents"), 0
    else:
        per = (pmap(v).get(oid) or {}).get("price_per_site_cents")
        adj = (v.get("adjustments") or {}).get(oid, 0)
    if count == 0 and adj == 0:
        return 0
    return None if per is None else per * count + adj


def site_owner_counts(v):
    out = {}
    for s in v["sites"]:
        o = (v["assignments"].get(s["site_id"]) or {}).get("owner")
        if o:
            out[o] = out.get(o, 0) + 1
    return out


def partner_owners(v):
    return {o for o in site_owner_counts(v) if o != OWN}


def is_expired(t):
    vu = t.get("valid_until")
    return bool(vu) and date.fromisoformat(vu) < today_pacific()


def partner_terms(v, pid):
    p = pmap(v).get(pid) or {"name": pid}
    sites = []
    for s in v["sites"]:
        a = v["assignments"].get(s["site_id"]) or {}
        if a.get("owner") == pid:
            ws, we = week_range(v.get("start_date"), a.get("week"))
            sites.append({"site_id": s["site_id"], "name": s.get("name"), "scope": s.get("scope"),
                          "week": a.get("week"), "week_start": ws, "week_end": we})
    total = owner_price(v, pid, len(sites))
    pct = p.get("advance_pct")
    adv = round(total * pct / 100) if total is not None and pct is not None else None
    return {
        "partner_id": pid, "partner_name": p.get("name"), "sites": sites,
        "scope": p.get("scope"), "exclusions": p.get("exclusions"),
        "price_per_site_cents": p.get("price_per_site_cents"),
        "adjustment_cents": (v.get("adjustments") or {}).get(pid, 0),
        "price_total_cents": total, "payer": p.get("payer"), "advance_pct": pct,
        "advance_cents": adv, "balance_cents": total - adv if adv is not None else None,
        "balance_terms": p.get("balance_terms"), "conditions": p.get("conditions"),
        "valid_until": p.get("valid_until"),
    }


def terms_hash(t):
    return hashlib.sha256(json.dumps(t, sort_keys=True, default=str).encode()).hexdigest()[:24]


def fmt(c):
    if c is None:
        return "unknown"
    return ("-" if c < 0 else "") + f"${abs(c) / 100:,.2f}".replace(".00", "")


# ---------- gap analysis ----------
def gap_analysis(it):
    unknowns = []
    for key, label in [("job_name", "Job name"), ("customer_name", "Customer"), ("scope_summary", "Scope summary"),
                       ("start_date", "Start date"), ("weeks", "Number of weeks"),
                       ("budget_ceiling_cents", "Budget ceiling")]:
        if it.get(key) is None:
            unknowns.append(f"{label}: unknown")
    weeks = it.get("weeks") or 0
    for i, c in enumerate(it.get("own_capacity") or []):
        if c is None:
            unknowns.append(f"Your crew capacity, week {i + 1}: unknown")
    for s in it.get("sites") or []:
        if s.get("deadline_week") is None:
            unknowns.append(f"{s.get('name') or s['site_id']} deadline: unknown")
        if not s.get("scope"):
            unknowns.append(f"{s.get('name') or s['site_id']} scope: unknown")
    fields = [("email", "contact email"), ("price_per_site_cents", "price per site"), ("max_sites", "quoted site limit"),
              ("payer", "payer"), ("advance_pct", "advance"), ("balance_terms", "balance terms"),
              ("valid_until", "validity date")]
    for p in it.get("partners") or []:
        for key, label in fields:
            if p.get(key) is None:
                unknowns.append(f"{p['name']} {label}: unknown")
        for i, c in enumerate(p.get("capacity") or []):
            if c is None:
                unknowns.append(f"{p['name']} capacity, week {i + 1}: unknown")
    weekly, cum_due, cum_cap = [], 0, 0
    for w in range(1, weeks + 1):
        due = sum(1 for s in it["sites"] if s.get("deadline_week") == w)
        vals = [(it.get("own_capacity") or [None] * weeks)[w - 1]] + [
            (p.get("capacity") or [None] * weeks)[w - 1] for p in it["partners"]]
        cap = sum(c for c in vals if c is not None)
        cum_due += due
        cum_cap += cap
        weekly.append({"week": w, "due": due, "capacity": cap, "capacity_partial": any(c is None for c in vals),
                       "cumulative_due": cum_due, "cumulative_capacity": cum_cap,
                       "short": max(0, cum_due - cum_cap)})
    return {
        "provisional": True,
        "unknowns": unknowns,
        "open_conditions": open_conditions(it) + [{"scope": p["name"], "text": p["conditions"], "source": None}
                                                  for p in it.get("partners") or [] if p.get("conditions")],
        "weekly": weekly,
        "site_count": len(it.get("sites") or []),
        "sites_without_deadline": sum(1 for s in it.get("sites") or [] if s.get("deadline_week") is None),
        "partner_count": len(it.get("partners") or []),
        "priced_partner_count": sum(1 for p in it.get("partners") or [] if p.get("price_per_site_cents") is not None),
        "budget_ceiling_cents": it.get("budget_ceiling_cents"),
    }


# ---------- generator ----------
def generate(it, partner_ids, include_own, blocked=frozenset(), keep_open=frozenset()):
    weeks = it["weeks"]
    owners = []
    if include_own and any((c or 0) > 0 for c in it.get("own_capacity") or []):
        owners.append(OWN)
    plist = [p for p in it["partners"] if p["partner_id"] in partner_ids]
    order = sorted(range(len(plist)), key=lambda i: (plist[i].get("price_per_site_cents") is None,
                                                      plist[i].get("price_per_site_cents") or 0, i))
    owners += [plist[i]["partner_id"] for i in order]
    pseudo = {"own_capacity": it.get("own_capacity"), "partners": it["partners"]}
    remaining = {o: [owner_capacity(pseudo, o, w) or 0 for w in range(1, weeks + 1)] for o in owners}
    idx = {s["site_id"]: i for i, s in enumerate(it["sites"])}
    sites = sorted(it["sites"], key=lambda s: (s.get("deadline_week") or weeks + 1, idx[s["site_id"]]))
    assignments, notes = {}, []
    for s in sites:
        dl = min(s.get("deadline_week") or weeks, weeks)
        placed = False
        if s["site_id"] in keep_open:
            assignments[s["site_id"]] = {"owner": None, "week": None}
            notes.append(f"{s['site_id']} left open as asked.")
            continue
        for w in range(dl, 0, -1):
            for o in owners:
                if (s["site_id"], o) in blocked:
                    continue
                if remaining[o][w - 1] > 0:
                    remaining[o][w - 1] -= 1
                    assignments[s["site_id"]] = {"owner": o, "week": w}
                    placed = True
                    break
            if placed:
                break
        if not placed:
            assignments[s["site_id"]] = {"owner": None, "week": None}
            notes.append(f"{s['site_id']} left open: no included firm both fits its requirements and has capacity by its deadline.")
        if s.get("deadline_week") is None:
            notes.append(f"{s['site_id']} has no known deadline, so it was placed by the last week.")
    return assignments, notes


# ---------- checker ----------
def _rule(key, label):
    return {"key": key, "label": label, "status": "pass", "details": []}


def _bump(r, st, msg):
    if RANK[st] > RANK[r["status"]]:
        r["status"] = st
    r["details"].append(msg)


def plan_total(v):
    counts = site_owner_counts(v)
    total, unknown = 0, []
    for o, n in counts.items():
        price = owner_price(v, o, n)
        if price is None:
            unknown.append(owner_name(v, o))
        else:
            total += price
    return (None if unknown else total), unknown


def weekly_load(v):
    weeks = v.get("weeks") or 0
    owners = sorted(site_owner_counts(v))
    out = []
    for w in range(1, weeks + 1):
        load = sum(1 for a in v["assignments"].values() if a.get("week") == w)
        cs = [owner_capacity(v, o, w) for o in owners]
        cap = sum(c for c in cs if c is not None)
        out.append({"week": w, "load": load, "capacity": cap, "capacity_partial": any(c is None for c in cs),
                    "gap": max(0, load - cap)})
    return out


def check(v):
    weeks = v.get("weeks") or 0
    A, P = v["assignments"], pmap(v)
    rules = []

    cap = _rule("capacity", "Weekly capacity")
    cells = {}
    for s in v["sites"]:
        a = A.get(s["site_id"]) or {}
        if a.get("owner") and isinstance(a.get("week"), int):
            cells.setdefault((a["owner"], a["week"]), []).append(s["site_id"])
    for (o, w), ids in sorted(cells.items(), key=lambda kv: (kv[0][1], owner_name(v, kv[0][0]))):
        c = owner_capacity(v, o, w)
        if c is None:
            _bump(cap, "unknown", f"Week {w}: {owner_name(v, o)} has {len(ids)} site(s); capacity is unknown.")
        elif len(ids) > c:
            _bump(cap, "fail", f"Week {w}: {owner_name(v, o)} has {len(ids)} site(s) ({', '.join(ids)}) but capacity is {c}.")
    if not cap["details"]:
        cap["details"].append("Every crew stays within its weekly capacity.")
    rules.append(cap)

    cw = _rule("crew_week", "One indivisible crew-week per site")
    for s in v["sites"]:
        a = A.get(s["site_id"]) or {}
        w = a.get("week")
        if a.get("owner") and (not isinstance(w, int) or not 1 <= w <= weeks):
            _bump(cw, "fail", f"{s['site_id']} is not scheduled in exactly one week of the job.")
    if not cw["details"]:
        cw["details"].append("Each site is one crew-week in exactly one week.")
    rules.append(cw)

    dl = _rule("deadlines", "Each site's deadline")
    for s in v["sites"]:
        w = (A.get(s["site_id"]) or {}).get("week")
        d = s.get("deadline_week")
        if d is None:
            _bump(dl, "unknown", f"{s['site_id']}: deadline unknown, so it cannot be checked.")
        elif isinstance(w, int) and w > d:
            _bump(dl, "fail", f"{s['site_id']} is in week {w} but is due by week {d}.")
    if not dl["details"]:
        dl["details"].append("Every site is scheduled on or before its deadline week.")
    rules.append(dl)

    ow = _rule("owner", "Exactly one scope owner per site")
    for s in v["sites"]:
        o = (A.get(s["site_id"]) or {}).get("owner")
        if o and o != OWN and o not in P:
            _bump(ow, "fail", f"{s['site_id']} has no valid scope owner.")
    if not ow["details"]:
        ow["details"].append("Every assigned site has exactly one scope owner. Open scopes are reported under coverage.")
    rules.append(ow)

    ql = _rule("quoted_limits", "Quoted limits")
    for o, n in sorted(site_owner_counts(v).items()):
        if o == OWN:
            continue
        m = (P.get(o) or {}).get("max_sites")
        if m is None:
            _bump(ql, "unknown", f"{owner_name(v, o)} has {n} site(s); quoted site limit is unknown.")
        elif n > m:
            _bump(ql, "fail", f"{owner_name(v, o)} has {n} site(s) but quoted at most {m}.")
    if not ql["details"]:
        ql["details"].append("No partner is assigned more sites than they quoted.")
    rules.append(ql)

    ce = _rule("ceiling", "Total cost against the ceiling")
    total, unknown_prices = plan_total(v)
    ceiling = v.get("budget_ceiling_cents")
    headroom = None
    if unknown_prices:
        _bump(ce, "unknown", f"Price unknown for {', '.join(unknown_prices)}, so the total cannot be checked.")
    elif ceiling is None:
        _bump(ce, "unknown", f"Total {fmt(total)}; the budget ceiling is unknown.")
    elif total > ceiling:
        _bump(ce, "fail", f"Total {fmt(total)} exceeds the {fmt(ceiling)} ceiling by {fmt(total - ceiling)}.")
    else:
        headroom = ceiling - total
        ce["details"].append(f"Total {fmt(total)} is within the {fmt(ceiling)} ceiling. "
                             f"Budget headroom {fmt(headroom)}.")
    rules.append(ce)

    pay = _rule("payments", "Resulting payments are not negative")
    for o in sorted(partner_owners(v) | set(v.get("adjustments") or {}), key=lambda x: owner_name(v, x)):
        t = partner_terms(v, o)
        if t["price_total_cents"] is not None and t["price_total_cents"] < 0:
            _bump(pay, "fail", f"{t['partner_name']}: total {fmt(t['price_total_cents'])} after a "
                               f"{fmt(t['adjustment_cents'])} adjustment. A discount cannot exceed the sites' price.")
    if not pay["details"]:
        pay["details"].append("Every partner's total, advance and balance is zero or more.")
    rules.append(pay)

    co = _rule("conditions", "Payment and prerequisites")
    for c in v.get("job_conditions") or []:
        if not c.get("resolved"):
            co["details"].append(f"Job condition (stays open until resolved): {c['text']}")
    for o in sorted(partner_owners(v), key=lambda x: owner_name(v, x)):
        p = P.get(o) or {}
        for key, label in [("payer", "payer"), ("advance_pct", "advance"), ("balance_terms", "balance terms"),
                           ("valid_until", "validity date")]:
            if p.get(key) is None:
                _bump(co, "unknown", f"{p.get('name')}: {label} unknown.")
        if p.get("conditions"):
            co["details"].append(f"{p.get('name')} condition (stays open until resolved): {p['conditions']}")
        if p.get("valid_until") and date.fromisoformat(p["valid_until"]) < today_pacific():
            _bump(co, "fail", f"{p.get('name')}: terms expired on {p['valid_until']}; recheck needed.")
    if not co["details"]:
        co["details"].append("Payment terms are stated for every partner in the plan.")
    co["open_count"] = len(open_conditions(v, v))
    rules.append(co)

    overall = max((r["status"] for r in rules), key=lambda s: RANK[s]) if rules else "unknown"
    if overall == "fail":
        note = ""
    elif overall == "unknown":
        note = "Some inputs are unknown."
    else:
        note = ""
    return {"overall": overall, "rules": rules, "weekly": weekly_load(v), "total_cents": total,
            "open_conditions": open_conditions(v, v),
            "ceiling_cents": ceiling, "headroom_cents": headroom, "note": note}


# ---------- diff ----------
def _site_view(v, sid):
    s = next(x for x in v["sites"] if x["site_id"] == sid)
    a = v["assignments"].get(sid) or {}
    return {"owner": a.get("owner"), "owner_name": owner_name(v, a.get("owner")) if a.get("owner") else None,
            "week": a.get("week"), "deadline_week": s.get("deadline_week"), "name": s.get("name"),
            "week_start": week_range(v.get("start_date"), a.get("week"))[0],
            "deadline_end": week_range(v.get("start_date"), s.get("deadline_week"))[1]}


def _day(iso):
    d = date.fromisoformat(iso)
    return f"{d:%b} {d.day}, {d.year}"


def _terms_summary(t):
    if not t:
        return None
    return {"sites": [f"{s.get('name') or s['site_id']} (week {s['week']}{', week of ' + _day(s['week_start']) if s.get('week_start') else ''})"
                      for s in t["sites"]],
            "price_total_cents": t["price_total_cents"], "advance_cents": t["advance_cents"],
            "balance_cents": t["balance_cents"], "payer": t["payer"], "conditions": t["conditions"],
            "valid_until": t["valid_until"]}


TERM_LABELS = {"scope": "scope", "exclusions": "exclusions", "price_per_site_cents": "price per site",
               "adjustment_cents": "price adjustment", "price_total_cents": "total price", "payer": "payer",
               "advance_pct": "advance %", "advance_cents": "advance amount", "balance_cents": "balance",
               "balance_terms": "balance terms", "conditions": "conditions", "valid_until": "validity date",
               "partner_name": "firm name"}


def term_reasons(tb, ta):
    """Plain reasons why exact terms differ, including fields not shown in the summary."""
    if not tb or not ta:
        return []
    out = []
    bs, as_ = {s["site_id"]: s for s in tb["sites"]}, {s["site_id"]: s for s in ta["sites"]}
    for sid in sorted(bs.keys() | as_.keys()):
        b, a = bs.get(sid), as_.get(sid)
        nm = (a or b).get("name") or sid
        if not b:
            out.append(f"{nm} added")
        elif not a:
            out.append(f"{nm} removed")
        elif b.get("week") != a.get("week"):
            out.append(f"{nm} moves from week {b.get('week')} to week {a.get('week')}")
        elif (b.get("week_start"), b.get("week_end")) != (a.get("week_start"), a.get("week_end")):
            out.append(f"{nm} dates change ({b.get('week_start')} → {a.get('week_start')})")
        elif b != a:
            out.append(f"{nm} site details change")
    for k, label in TERM_LABELS.items():
        if tb.get(k) != ta.get(k):
            out.append(f"{label} changes")
    return out


def diff(old, new):
    om = {s["site_id"] for s in old["sites"]}
    nm = {s["site_id"] for s in new["sites"]}
    sites = []
    for sid in sorted(om | nm):
        b = _site_view(old, sid) if sid in om else None
        a = _site_view(new, sid) if sid in nm else None
        changed = [k for k in ("owner_name", "week", "deadline_week") if (b or {}).get(k) != (a or {}).get(k)]
        if changed:
            sites.append({"site_id": sid, "before": b, "after": a, "changed": changed})
    partners = []
    po, pn = partner_owners(old), partner_owners(new)
    for pid in sorted(po | pn, key=lambda x: owner_name(new if x in pn else old, x)):
        tb = partner_terms(old, pid) if pid in po else None
        ta = partner_terms(new, pid) if pid in pn else None
        if tb is None:
            state = "added"
        elif ta is None:
            state = "removed"
        else:
            state = "unchanged" if terms_hash(tb) == terms_hash(ta) else "changed"
        sb, sa = _terms_summary(tb), _terms_summary(ta)
        changes = [k for k in (sa or sb or {}) if (sb or {}).get(k) != (sa or {}).get(k)]
        partners.append({"partner_id": pid, "name": owner_name(new if ta else old, pid), "state": state,
                         "before": sb, "after": sa, "changes": changes, "reasons": term_reasons(tb, ta)})
    return {"sites": sites, "partners": partners,
            "total_before_cents": plan_total(old)[0], "total_after_cents": plan_total(new)[0],
            "weekly_before": weekly_load(old), "weekly_after": weekly_load(new)}
