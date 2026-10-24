import io
import os

import requests
from pypdf import PdfReader

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "assemble"
_storage_key = None


def init_storage(force=False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": os.environ["EMERGENT_LLM_KEY"]}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _request(method, path, **kw):
    for attempt in (0, 1):
        key = init_storage(force=attempt == 1)
        headers = {"X-Storage-Key": key, **kw.pop("headers", {})}
        resp = requests.request(method, f"{STORAGE_URL}/objects/{path}", headers=headers, **kw)
        if resp.status_code != 404 or attempt == 1:
            resp.raise_for_status()
            return resp
    return resp


def put_object(path, data, content_type):
    return _request("PUT", path, headers={"Content-Type": content_type}, data=data, timeout=120).json()


def get_object(path):
    resp = _request("GET", path, timeout=60)
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


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
