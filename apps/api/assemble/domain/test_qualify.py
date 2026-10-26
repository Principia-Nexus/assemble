from datetime import date

from assemble.domain import qualify as Q

REQ = [{"req_id": "r1", "code": "C-10", "label": "Electrical", "sites": "all", "status": "required"}]


def test_evidence_for_another_class_is_evidence_needed_not_does_not_fit():
    ev = [{"partner_id": "a", "license_class": "C-7"}]
    assert Q._site_result("a", "S01", REQ, ev, date(2026, 1, 1))["status"] == "evidence_needed"


def test_a_lapsed_record_does_not_fit():
    ev = [{"partner_id": "a", "license_class": "C-10", "observed_status": "suspended", "observed_on": "2026-01-01"}]
    assert Q._site_result("a", "S01", REQ, ev, date(2026, 1, 2))["status"] == "does_not_fit"
