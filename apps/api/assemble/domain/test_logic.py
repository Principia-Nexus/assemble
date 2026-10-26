from assemble.domain import logic as L


def test_validate_intake_rejects_out_of_range_values():
    assert any("Number of weeks" in x for x in L.validate_intake({"weeks": "13"})[1])
    assert any("week 2" in x for x in L.validate_intake({"weeks": "2", "own_capacity": ["1", "60"]})[1])


def test_stored_intake_passes_the_form_validator_unchanged():
    it, e = L.validate_intake({"weeks": "1", "budget_ceiling": "1200.50", "sites": [{"site_id": "S01"}],
                               "partners": [{"partner_id": "p1", "name": "A", "price_per_site": "100"}]})
    assert not e and L.validate_intake(L.intake_form(it)) == (it, [])


def test_generator_keeps_a_site_inside_its_access_window():
    it = {"weeks": 3, "start_date": "2027-01-04", "own_capacity": [0, 0, 0],
          "partners": [{"partner_id": "a", "price_per_site_cents": 100, "capacity": [1, 1, 1], "max_sites": None}],
          "sites": [{"site_id": "S01", "deadline_week": 3, "access_end": "2027-01-08"}]}
    assert L.generate(it, {"a"}, False)[0]["S01"] == {"owner": "a", "week": 1}


def test_generator_moves_a_site_to_make_room_for_one_that_has_no_other_week():
    # Greedy would give B week 2 and leave A open; A can only go in week 2, so B must take week 1.
    it = {"weeks": 2, "start_date": "2027-01-04", "own_capacity": [0, 0],
          "partners": [{"partner_id": "a", "price_per_site_cents": 100, "capacity": [1, 1], "max_sites": None}],
          "sites": [{"site_id": "B", "deadline_week": 2}, {"site_id": "A", "deadline_week": 2, "access_start": "2027-01-11"}]}
    assert L.generate(it, {"a"}, False)[0] == {"B": {"owner": "a", "week": 1}, "A": {"owner": "a", "week": 2}}


def test_generator_respects_firm_site_limits_and_reports_what_cannot_fit():
    it = {"weeks": 1, "start_date": "2027-01-04", "own_capacity": [0],
          "partners": [{"partner_id": "a", "price_per_site_cents": 100, "capacity": [5], "max_sites": 1}],
          "sites": [{"site_id": "S01", "deadline_week": 1}, {"site_id": "S02", "deadline_week": 1}]}
    plan, notes = L.generate(it, {"a"}, False)
    assert [x["owner"] for x in plan.values()].count("a") == 1 and any("left open" in n for n in notes)
