"""Versioned rule packs (backend/rule_packs/*.json) built from the two appendices; selected per request and recorded."""
import json
import re
from pathlib import Path

DIR = Path(__file__).parent / "rule_packs"
MAX_CONTEXTUAL = 6


def _load():
    packs, files = [], {}
    for f in sorted(DIR.glob("*.json")):
        data = json.loads(f.read_text())
        files[f.name] = data["file_version"]
        for pk in data["packs"]:
            pk.setdefault("applies_when", {})
            pk["file"] = f.name
            packs.append(pk)
    return packs, files


PACKS, FILES = _load()
BY_ID = {p["id"]: p for p in PACKS}
RUN_LIMITS = BY_ID["runs"]["limits"]


def tag(p):
    return f"{p['id']}@{p['version']}"


def _hits(p, text):
    n = 0
    for k in p["applies_when"].get("keywords", []):
        pat = re.escape(k) if not k[0].isalnum() else rf"\b{re.escape(k)}\b"
        if re.search(pat, text):
            n += 1
    return n


def select(*texts):
    text = " ".join(t for t in texts if t).lower()
    always = [p for p in PACKS if p["applies_when"].get("always")]
    scored = sorted(((h, i, p) for i, p in enumerate(PACKS) if not p["applies_when"].get("always") and (h := _hits(p, text))),
                    key=lambda x: (-x[0], x[1]))
    return always + [p for _, _, p in scored[:MAX_CONTEXTUAL]]


def prompt_block(packs):
    lines = ["RULE PACKS (versioned guidance, never project facts):"]
    for p in packs:
        lines.append(f"[{tag(p)}] {p['title']}")
        lines += [f"- {g}" for g in p.get("guidance", [])]
    return "\n".join(lines)


def catalog():
    return {"files": FILES, "packs": [{k: p.get(k) for k in ("id", "version", "title", "source", "file")} for p in PACKS]}
