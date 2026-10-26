"""Two supplemental synthetic examples. Separate from the canonical twelve-site fixture; no real businesses."""
ORG = "Brightline Electrical (Synthetic)"


def _partner(pid, name, email=None, price=None, capacity=None, max_sites=None, terms=True):
    t = terms
    return {"partner_id": pid, "name": name, "email": email, "price_per_site_cents": price, "capacity": capacity,
            "max_sites": max_sites, "payer": f"{ORG} pays the partner" if t else None, "advance_pct": 0 if t else None,
            "balance_terms": "Payment due 30 days after each store's accepted completion" if t else None,
            "conditions": "Customer provides store access." if t else None,
            "exclusions": "Permits, hazardous-material work" if t else None,
            "scope": "Lighting replacement and labeling at assigned stores" if t else None,
            "valid_until": "2026-12-04" if t else None}


SIX_STORE = {
    "key": "six-store", "position": 1,
    "intake": {
        "job_name": "Six-store lighting refresh (Synthetic)", "customer_name": "Willow Retail Group (Synthetic)",
        "scope_summary": "Lighting replacement and labeling at six stores. One indivisible crew-week per store.",
        "start_date": "2026-12-07", "weeks": 3, "budget_ceiling_cents": 8400000, "own_capacity": [0, 0, 0],
        "own_cost_per_site_cents": None, "job_conditions": [],
        "sites": [{"site_id": sid, "name": f"{n} store (Synthetic)", "deadline_week": w, "scope": "Lighting replacement + labeling"}
                  for sid, n, w in [("MPL", "Maple", 1), ("BRK", "Brook", 1), ("PIN", "Pine", 2), ("HIL", "Hill", 2),
                                    ("LAK", "Lake", 3), ("GRV", "Grove", 3)]],
        "partners": [
            _partner("juniper", "Juniper Electrical (Synthetic)", "juniper@examples.assemble.test", 1200000, [1, 1, 1], 3),
            _partner("summit", "Summit Wiring (Synthetic)", "summit@examples.assemble.test", 1200000, [1, 1, 1], 3),
        ],
    },
    "sources": [
        ("brief", "Willow Retail Group brief (Synthetic)", "2026-11-02",
         "SYNTHETIC EXAMPLE. Willow Retail Group (fictional) asks for lighting replacement and labeling at six stores: "
         "Maple, Brook, Pine, Hill, Lake and Grove. Work starts the week of December 7, 2026 and runs three weeks "
         "(December 7, 14 and 21). Maple and Brook must finish in week 1, Pine and Hill by week 2, Lake and Grove by week 3. "
         "Each store takes one crew-week and cannot be split. Budget ceiling: $84,000."),
        ("quote", "Juniper Electrical quote (Synthetic)", "2026-11-09",
         "SYNTHETIC EXAMPLE. Juniper Electrical (fictional) quotes $12,000 per store, up to three stores. One crew-week "
         "available in each of the weeks of December 7, 14 and 21, declared for this opportunity only and not held. "
         "No advance; payment due 30 days after each store's accepted completion. Excludes permits and hazardous-material "
         "work. Customer access required. Quote valid until December 4, 2026."),
        ("quote", "Summit Wiring quote (Synthetic)", "2026-11-10",
         "SYNTHETIC EXAMPLE. Summit Wiring (fictional) quotes $12,000 per store, up to three stores. One crew-week "
         "available in each of the weeks of December 7, 14 and 21, declared for this opportunity only and not held. "
         "No advance; payment due 30 days after each store's accepted completion. Excludes permits and hazardous-material "
         "work. Customer access required. Quote valid until December 4, 2026."),
    ],
}

WAREHOUSE = {
    "key": "warehouse", "position": 2,
    "intake": {
        "job_name": "Warehouse lighting upgrade (Synthetic)", "customer_name": "Northbank Storage (Synthetic)",
        "scope_summary": "Lighting replacement at three warehouses. One indivisible crew-week per warehouse.",
        "start_date": "2027-01-11", "weeks": 2, "budget_ceiling_cents": 4500000, "own_capacity": [0, 0],
        "own_cost_per_site_cents": None, "job_conditions": [],
        "sites": [{"site_id": sid, "name": f"{n} warehouse (Synthetic)", "deadline_week": w, "scope": "Lighting replacement"}
                  for sid, n, w in [("EAS", "East", 1), ("CEN", "Central", 1), ("WST", "West", 2)]],
        "partners": [_partner("harbor", "Harbor Electrical (Synthetic)", capacity=[None, None], terms=False)],
    },
    "sources": [
        ("brief", "Northbank Storage brief (Synthetic)", "2026-12-01",
         "SYNTHETIC EXAMPLE. Northbank Storage (fictional) asks for lighting replacement at three warehouses. "
         "Work starts the week of January 11, 2027 and runs two weeks (January 11 and 18). East and Central warehouses "
         "are due in week 1; West warehouse in week 2. One crew-week per warehouse, not divisible. Budget ceiling: $45,000. "
         "A quote was requested from Harbor Electrical (fictional); no response has been received, so its price, "
         "capacity and contact are not known."),
    ],
}

EXAMPLES = {e["key"]: e for e in (SIX_STORE, WAREHOUSE)}
