from assemble.routes.extract import match_partner, site_key

IT = {"partners": [{"partner_id": "rc", "name": "Redwood Circuit Co. (Synthetic)"}, {"partner_id": "tb", "name": "The Bright Group"}]}


def test_match_partner_needs_the_full_name():
    assert match_partner("redwood circuit", IT) == ("rc", "Redwood Circuit Co. (Synthetic)")
    assert match_partner("Redwood Lighting", IT) == (None, "Redwood Lighting")
    assert match_partner("The Other Firm", IT)[0] is None


def test_long_site_names_keep_distinct_ids():
    a, b = site_key("Northgate Shopping Center East"), site_key("Northgate Shopping Center West")
    assert a != b and len(a) <= 20 and len(b) <= 20
