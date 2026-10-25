# Assemble PDF upload (pypdf extraction, scanned refusal, object storage download, sample PDF) - API tests. 1-2 real LLM reads.
import os
import sys
import uuid
import pytest
import requests

sys.path.insert(0, "/app/backend")
from pdf_sample import make_pdf  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
PW = "synthetic-demo"
VISITOR = "pdf-" + uuid.uuid4().hex[:16]
T = 200
UP = f"{BASE_URL}/api/project/sources/upload"


def login(key, visitor=VISITOR):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": f"{key}@demo.assemble.test", "password": PW, "visitor_id": visitor})
    assert r.status_code == 200, r.text
    return s


def upload(s, data, name="q.pdf", kind="quote", label="TEST pdf", sdate=""):
    return s.post(UP, files={"file": (name, data, "application/pdf")},
                  data={"kind": kind, "label": label, "source_date": sdate}, timeout=T)


def n_sources(s):
    return len(s.get(f"{BASE_URL}/api/project/readings").json()["sources"])


@pytest.fixture(scope="module")
def ctx():
    org = login("organizer")
    sh = org.get(f"{BASE_URL}/api/project").json()["sheet"]
    return {"org": org, "start": sh["intake"]["start_date"]}


class TestSamplePdf:
    def test_sample_pdf_demo(self, ctx):
        r = ctx["org"].get(f"{BASE_URL}/api/project/sample-pdf")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content.startswith(b"%PDF")
        ctx["sample"] = r.content

    def test_sample_pdf_registered_404(self):
        s = requests.Session()
        email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        r = s.post(f"{BASE_URL}/api/auth/register", json={"name": "TEST U", "email": email, "password": "Passw0rd!x", "firm_name": "TEST Firm"})
        assert r.status_code in (200, 201), r.text
        r = s.get(f"{BASE_URL}/api/project/sample-pdf")
        assert r.status_code == 404, r.text


class TestRejections:
    # Blank (truly empty) PDF -> OCR runs but finds nothing -> 422, nothing stored (1 LLM call)
    def test_blank_pdf_422(self, ctx):
        before = n_sources(ctx["org"])
        r = upload(ctx["org"], make_pdf([[]]), "blank.pdf")
        assert r.status_code == 422, r.text
        assert "No readable text could be recognized" in r.text
        assert n_sources(ctx["org"]) == before

    # Scanned PDF over 8 pages -> 422 before any LLM call
    def test_scanned_blank_9_pages_422(self, ctx):
        before = n_sources(ctx["org"])
        r = upload(ctx["org"], make_pdf([[] for _ in range(9)]), "scan9.pdf")
        assert r.status_code == 422, r.text
        assert "No readable text" in r.text
        assert n_sources(ctx["org"]) == before

    def test_not_pdf_422(self, ctx):
        before = n_sources(ctx["org"])
        r = upload(ctx["org"], b"hello this is not a pdf", "fake.pdf")
        assert r.status_code == 422 and "is not a PDF" in r.text
        assert n_sources(ctx["org"]) == before

    def test_too_large_422(self, ctx):
        r = upload(ctx["org"], b"%PDF-1.4\n" + b"0" * (10 * 1024 * 1024 + 10), "big.pdf")
        assert r.status_code == 422 and "10 MB" in r.text

    def test_bad_kind_422(self, ctx):
        r = upload(ctx["org"], make_pdf([["Some typed text for testing purposes here."]]), kind="pdf")
        assert r.status_code == 422 and "kind" in r.text

    def test_missing_label(self, ctx):
        # label falls back to filename in implementation; record behaviour
        r = upload(ctx["org"], b"not pdf", "x.pdf", label="   ")
        assert r.status_code == 422 and "label" in r.text.lower(), r.text

    def test_corrupt_pdf_422(self, ctx):
        r = upload(ctx["org"], b"%PDF-1.4\ngarbage garbage", "corrupt.pdf")
        assert r.status_code == 422, r.text


class TestTypedPdf:
    def test_upload_redwood_pdf(self, ctx):
        data = ctx.get("sample") or ctx["org"].get(f"{BASE_URL}/api/project/sample-pdf").content
        r = upload(ctx["org"], data, "redwood-quote-synthetic.pdf", label="TEST Redwood quote PDF")
        assert r.status_code == 200, r.text
        body = r.json()
        src = [s for s in body["sources"] if s["label"] == "TEST Redwood quote PDF"][-1]
        assert src["status"] == "read", src.get("error")
        assert src["page_count"] == 2 and isinstance(src["file_id"], str)
        ctx["src"] = src
        facts = [f for r_ in body["readings"] for f in r_["facts"] if f["source_id"] == src["source_id"]]
        ctx["facts"] = facts
        for f in facts:
            print(f["field"], f.get("partner_name"), f.get("week"), f["value"], f["status"], f.get("location"), f["issues"])
        assert facts

    def test_locations_have_page_and_line(self, ctx):
        located = [f for f in ctx["facts"] if f.get("location")]
        assert located and all("page" in f["location"] and "line" in f["location"] for f in located)
        price = next(f for f in ctx["facts"] if f["field"] == "price_per_site")
        assert price["location"]["page"] == 2 and price["location"]["line"] == 1

    def test_values(self, ctx):
        fx = ctx["facts"]
        g = lambda fld: [f for f in fx if f["field"] == fld and f["status"] != "invalid"]  # noqa: E731
        assert any(f["parsed"] == 1280000 or str(f["value"]) == "12800" for f in g("price_per_site"))
        caps = {f["week"]: f["parsed"] for f in g("capacity") if "redwood" in (f["target"] or "")}
        assert caps == {1: 1, 2: 2, 3: 4}, caps
        assert any(f["parsed"] == 10 for f in g("max_sites"))
        assert any(f["parsed"] == 10 for f in g("advance_pct"))
        # no capacity derived from 2-man crew
        assert not any(f["field"] == "capacity" and "2-man" in f["excerpt"] and f["status"] != "invalid" and f["parsed"] == 2
                       and "week 2" not in f["excerpt"] for f in fx)

    def test_customer_not_brightline(self, ctx):
        cust = [f for f in ctx["facts"] if f["field"] == "customer_name"]
        print("customer facts:", [(f["value"], f["status"]) for f in cust])
        assert all("brightline" not in f["value"].lower() for f in cust)

    def test_download_organizer(self, ctx):
        r = ctx["org"].get(f"{BASE_URL}/api/project/sources/{ctx['src']['source_id']}/file")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf") and r.content.startswith(b"%PDF")

    def test_download_partner_403(self, ctx):
        r = login("redwood").get(f"{BASE_URL}/api/project/sources/{ctx['src']['source_id']}/file")
        assert r.status_code == 403, (r.status_code, r.text)

    def test_download_other_visitor_404(self, ctx):
        other = login("organizer", "pdf-other-" + uuid.uuid4().hex[:8])
        r = other.get(f"{BASE_URL}/api/project/sources/{ctx['src']['source_id']}/file")
        assert r.status_code == 404

    def test_download_text_source_404(self, ctx):
        assert ctx["org"].get(f"{BASE_URL}/api/project/sources/nope/file").status_code == 404

    def test_apply_pdf_readings(self, ctx):
        org = ctx["org"]
        rd = org.get(f"{BASE_URL}/api/project/readings").json()
        ids = [r["reading"]["fact_id"] for r in rd["readings"] if r["reading"] and r["reading"]["status"] in ("proposed", "corrected")
               and r["reading"]["source_id"] == ctx["src"]["source_id"] and r["field"] in ("capacity", "price_per_site")]
        assert ids
        rev = org.get(f"{BASE_URL}/api/project").json()["sheet"]["project"]["rev"]
        r = org.post(f"{BASE_URL}/api/project/readings/apply", json={"rev": rev, "fact_ids": ids}, timeout=T)
        assert r.status_code == 200, r.text
        it = org.get(f"{BASE_URL}/api/project").json()["sheet"]["intake"]
        red = next(p for p in it["partners"] if "redwood" in p["name"].lower())
        assert red["price_per_site_cents"] == 1280000
        assert red["capacity"][:3] == [1, 2, 4]
        print("recalc:", r.json().get("recalc"))


# Scanned (image-only) PDF -> OCR via Claude vision -> read as usual, source flagged ocr=true (1 OCR + 1 read LLM call)
class TestScannedPdf:
    def test_scanned_sample_has_no_text_layer(self, ctx):
        import pymupdf
        r = ctx["org"].get(f"{BASE_URL}/api/project/sample-pdf", params={"scanned": "true"})
        assert r.status_code == 200 and r.content.startswith(b"%PDF")
        doc = pymupdf.open(stream=r.content, filetype="pdf")
        assert doc.page_count == 2
        assert all(not p.get_text().strip() for p in doc)
        assert all(p.get_images() for p in doc)
        ctx["scan"] = r.content

    def test_upload_scanned_ocr(self, ctx):
        r = upload(ctx["org"], ctx["scan"], "redwood-quote-scanned.pdf", label="TEST Redwood scanned")
        assert r.status_code == 200, r.text
        body = r.json()
        src = [s for s in body["sources"] if s["label"] == "TEST Redwood scanned"][-1]
        print("source:", {k: v for k, v in src.items() if k != "text"})
        assert src["status"] == "read", src.get("error")
        assert src.get("ocr") is True
        assert src["page_count"] == 2 and isinstance(src["file_id"], str)
        facts = [f for r_ in body["readings"] for f in r_["facts"] if f["source_id"] == src["source_id"]]
        for f in facts:
            print(f["field"], f.get("partner_name"), f.get("week"), f["value"], f["status"], f.get("location"), f["issues"])
        g = lambda fld: [f for f in facts if f["field"] == fld and f["status"] != "invalid"]  # noqa: E731
        assert any(f["parsed"] == 1280000 or str(f["value"]) == "12800" for f in g("price_per_site"))
        caps = {f["week"]: f["parsed"] for f in g("capacity") if "redwood" in (f["target"] or "")}
        assert caps == {1: 1, 2: 2, 3: 4}, caps
        assert any(f["parsed"] == 10 for f in g("max_sites"))
        assert any(f["parsed"] == 10 for f in g("advance_pct"))
        assert any("harborview" in str(f["value"]).lower() for f in facts if f["field"] == "customer_name")
        located = [f for f in facts if f.get("location")]
        assert located and all("page" in f["location"] and "line" in f["location"] for f in located)
        price = next(f for f in g("price_per_site"))
        assert price["location"]["page"] == 2, price["location"]
