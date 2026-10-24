"""Builds minimal text PDFs for testing (no extra dependencies)."""
import sys


def make_pdf(pages):
    objs = ["<< /Type /Catalog /Pages 2 0 R >>", None, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for lines in pages:
        ops = "BT /F1 11 Tf 50 750 Td 14 TL " + " ".join(
            "(" + ln.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)") + ") '" for ln in lines) + " ET"
        objs.append(f"<< /Length {len(ops)} >>\nstream\n{ops}\nendstream")
        content_no = len(objs)
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {content_no} 0 R "
                    "/Resources << /Font << /F1 3 0 R >> >> >>")
        kids.append(f"{len(objs)} 0 R")
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} >>"
    out, offsets = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{o}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += "".join(f"{x:010d} 00000 n \n" for x in offsets).encode()
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    return out


if __name__ == "__main__":  # writes a test PDF and a text-less "scanned" PDF
    open(sys.argv[1], "wb").write(make_pdf([["Sample text line for testing."]]))
    open(sys.argv[2], "wb").write(make_pdf([[]]))


def redwood_quote_pdf(start, valid_until, quote_date):
    return make_pdf([
        ["Redwood Circuit Co. (Synthetic) - Quotation", f"Date: {quote_date}", "Customer job: 12-branch lighting retrofit (Synthetic)",
         "End customer: Harborview Credit Union (Synthetic)",
         "Quote addressed to the organizer, Brightline Electrical (Synthetic), which hires us as a partner."],
        ["We run a 2-man crew per branch. Price: $12,800 per branch, up to 10 branches.",
         "Availability: 1 branch in week 1, 2 branches in week 2, 4 branches in week 3.",
         f"Work weeks counted from the job start on {start}.",
         "Terms: 10% advance, balance net 30 after each branch sign-off. Paid by Brightline Electrical.",
         f"Excludes permits and ceiling repairs. Quote valid until {valid_until}."],
    ])
