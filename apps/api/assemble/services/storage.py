import io
import os
from pathlib import Path

from pypdf import PdfReader

APP_NAME = "assemble"
STORAGE_DIR = Path(os.environ.get("STORAGE_DIR") or Path(__file__).parents[2] / "data" / "objects").resolve()


def _file(path):
    f = (STORAGE_DIR / path).resolve()
    if STORAGE_DIR not in f.parents:
        raise ValueError("storage path escapes the storage directory")
    return f


def put_object(path, data, content_type):
    f = _file(path)
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_bytes(data)
    return {"path": path, "size": len(data), "content_type": content_type}


def get_object(path):
    f = _file(path)
    ctype = {".pdf": "application/pdf", ".png": "image/png", ".jpeg": "image/jpeg", ".webp": "image/webp"}.get(f.suffix, "application/octet-stream")
    return f.read_bytes(), ctype


def pdf_text(data: bytes):
    """Returns (text with [Page N] markers, page start offsets, page count)."""
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception as e:  # noqa: BLE001
            raise ValueError("the PDF is password-protected") from e
    parts, starts, pos = [], [], 0
    for i, page in enumerate(reader.pages):
        chunk = f"[Page {i + 1}]\n{(page.extract_text() or '').strip()}\n\n"
        starts.append(pos)
        parts.append(chunk)
        pos += len(chunk)
    return "".join(parts), starts, len(reader.pages)
