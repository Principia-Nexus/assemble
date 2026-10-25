"""Typed work items (groups, tasks, milestones, AI tasks, conditions) and explicit relationships.
Every write — manual or assistant — goes through apply_ops: validated, rev-guarded, recorded with its inverse for undo."""
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db, now_iso, new_id, current_user, log_event
import logic as L
from project_routes import get_project, claim_rev, org, bad

router = APIRouter(prefix="/api/project")

KINDS = ("group", "task", "milestone", "ai_task", "condition")
EDGE_KINDS = ("prerequisite", "uses_input", "produces_output", "relates_to")
FIELDS = ("title", "parent_id", "firm_id", "site_ids", "notes", "start_date", "due_date", "date_kind", "status",
          "criteria", "result", "position", "origin", "source_ref")
STATUS = {"task": ("open", "done"), "milestone": ("open", "reached"), "condition": ("open", "resolved"),
          "ai_task": ("queued", "working", "needs_input", "draft_ready", "failed", "stopped"), "group": ("open",)}
DATE_KINDS = ("target", "stated", "provisional")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
MAX_OPS = 60


class OpsIn(BaseModel):
    rev: int
    ops: List[Dict[str, Any]]
    summary: Optional[str] = None


class UndoIn(BaseModel):
    rev: int
    batch_id: str


def public(doc):
    return {k: v for k, v in doc.items() if k not in ("_id", "deleted")}


async def load_items(project_id):
    items = await db.items.find({"project_id": project_id, "deleted": {"$ne": True}}, {"_id": 0}).sort(
        [("position", 1), ("created_at", 1)]).to_list(2000)
    edges = await db.item_edges.find({"project_id": project_id, "deleted": {"$ne": True}}, {"_id": 0}).to_list(4000)
    return items, edges


def has_cycle(edges):
    graph = {}
    for e in edges:
        if e["kind"] == "prerequisite":
            graph.setdefault(e["from_id"], []).append(e["to_id"])
    seen, stack = set(), set()

    def visit(n):
        if n in stack:
            return True
        if n in seen:
            return False
        seen.add(n)
        stack.add(n)
        hit = any(visit(m) for m in graph.get(n, []))
        stack.discard(n)
        return hit
    return any(visit(n) for n in list(graph))


def clean_fields(raw, kind, intake, errors, label):
    out = {}
    for k in FIELDS:
        if k not in raw:
            continue
        v = raw[k]
        if k == "title":
            v = str(v or "").strip()
            if not v or len(v) > 300:
                errors.append(f"{label}: give it a title (up to 300 characters).")
        elif k in ("notes", "criteria", "result", "source_ref"):
            v = (str(v).strip()[:4000] or None) if v is not None else None
        elif k in ("start_date", "due_date"):
            v = v or None
            if v and not DATE_RE.match(str(v)):
                errors.append(f"{label}: dates use YYYY-MM-DD.")
        elif k == "date_kind":
            v = v or None
            if v and v not in DATE_KINDS:
                errors.append(f"{label}: date kind must be target, stated or provisional.")
        elif k == "status":
            if v not in STATUS[kind]:
                errors.append(f"{label}: status must be one of {', '.join(STATUS[kind])}.")
        elif k == "firm_id":
            v = v or None
            firms = {p["partner_id"] for p in intake.get("partners") or []} | {L.OWN}
            if v and v not in firms:
                errors.append(f"{label}: unknown firm {v}.")
        elif k == "site_ids":
            v = [str(x) for x in (v or [])]
            sites = {s["site_id"] for s in intake.get("sites") or []}
            missing = [x for x in v if x not in sites]
            if missing:
                errors.append(f"{label}: unknown site {', '.join(missing)}.")
        elif k == "position":
            try:
                v = float(v)
            except (TypeError, ValueError):
                errors.append(f"{label}: position must be a number.")
        elif k == "origin":
            v = v if v in ("organizer", "assistant", "source") else "organizer"
        out[k] = v
    if out.get("start_date") and out.get("due_date") and out["start_date"] > out["due_date"]:
        errors.append(f"{label}: start date is after the due date.")
    return out


async def apply_ops(p, user, rev, ops, summary, origin="organizer", inverse_of=None):
    """Validates the whole batch against current records, then writes it. Returns the batch record."""
    if not ops:
        bad("Nothing to change.")
    if len(ops) > MAX_OPS:
        bad(f"Too many changes at once (max {MAX_OPS}).")
    pid, intake = p["project_id"], p["intake"]
    items, edges = await load_items(pid)
    by_id = {i["item_id"]: dict(i) for i in items}
    edge_list = [dict(e) for e in edges]
    refs, errors, writes, inverse = {}, [], [], []
    now = now_iso()

    def resolve(x):
        return refs.get(x, x) if isinstance(x, str) else x

    for n, op in enumerate(ops, 1):
        kind_op, label = op.get("op"), f"Change {n}"
        if kind_op == "create":
            kind = op.get("kind")
            if kind not in KINDS:
                errors.append(f"{label}: unsupported item type {kind}.")
                continue
            f = clean_fields({**op.get("fields", {}), "origin": op.get("fields", {}).get("origin", origin)}, kind, intake, errors, label)
            if "title" not in f:
                errors.append(f"{label}: give it a title.")
            f.setdefault("status", STATUS[kind][0] if kind != "ai_task" else "draft_ready")
            if "parent_id" in f:
                f["parent_id"] = resolve(f["parent_id"])
            iid = op.get("item_id") if inverse_of and op.get("item_id") else new_id("itm")
            if op.get("ref"):
                refs[op["ref"]] = iid
            doc = {"item_id": iid, "project_id": pid, "kind": kind, "title": "", "parent_id": None, "firm_id": None,
                   "site_ids": [], "notes": None, "start_date": None, "due_date": None, "date_kind": None, "criteria": None,
                   "result": None, "source_ref": None, "position": float(len(by_id) + n), "origin": origin,
                   "created_at": now, "created_by": user["name"], **f, "updated_at": now}
            by_id[iid] = doc
            writes.append(("upsert", doc))
            inverse.append({"op": "delete", "item_id": iid})
        elif kind_op in ("update", "delete", "restore"):
            iid = resolve(op.get("item_id"))
            cur = by_id.get(iid)
            if kind_op == "restore":
                doc = op.get("doc") or {}
                if not inverse_of or not doc.get("item_id") or doc.get("project_id") != pid or doc.get("kind") not in KINDS:
                    errors.append(f"{label}: cannot restore that item.")
                    continue
                by_id[doc["item_id"]] = {**doc, "deleted": False}
                writes.append(("upsert", by_id[doc["item_id"]]))
                inverse.append({"op": "delete", "item_id": doc["item_id"]})
                continue
            if not cur:
                errors.append(f"{label}: that item no longer exists.")
                continue
            if kind_op == "update":
                f = clean_fields(op.get("fields", {}), cur["kind"], intake, errors, label)
                if "parent_id" in f:
                    f["parent_id"] = resolve(f["parent_id"])
                prev = {k: cur.get(k) for k in f}
                if prev == f:
                    continue
                cur.update(f, updated_at=now)
                writes.append(("upsert", cur))
                inverse.append({"op": "update", "item_id": iid, "fields": prev})
            else:
                snapshot = dict(cur)
                for child in [c for c in by_id.values() if c.get("parent_id") == iid]:
                    child["parent_id"] = cur.get("parent_id")
                    writes.append(("upsert", child))
                    inverse.append({"op": "update", "item_id": child["item_id"], "fields": {"parent_id": iid}})
                for e in [e for e in edge_list if iid in (e["from_id"], e["to_id"])]:
                    edge_list.remove(e)
                    writes.append(("edge_del", e))
                    inverse.append({"op": "link", "edge": e})
                del by_id[iid]
                writes.append(("delete", snapshot))
                inverse.append({"op": "restore", "doc": snapshot})
        elif kind_op == "link":
            e = (op.get("edge") if inverse_of else None) or op
            a, b, k = resolve(e.get("from_id")), resolve(e.get("to_id")), e.get("kind")
            if k not in EDGE_KINDS or a not in by_id or b not in by_id or a == b:
                errors.append(f"{label}: a relationship needs two different existing items and a supported kind.")
                continue
            if any(x["from_id"] == a and x["to_id"] == b and x["kind"] == k for x in edge_list):
                continue
            edge = {"edge_id": e.get("edge_id") if inverse_of and e.get("edge_id") else new_id("edg"), "project_id": pid,
                    "from_id": a, "to_id": b, "kind": k, "proposed": bool(e.get("proposed", origin == "assistant")),
                    "created_at": now}
            edge_list.append(edge)
            writes.append(("edge_add", edge))
            inverse.append({"op": "unlink", "edge_id": edge["edge_id"]})
        elif kind_op == "unlink":
            e = next((x for x in edge_list if x["edge_id"] == op.get("edge_id")), None)
            if not e:
                errors.append(f"{label}: that relationship no longer exists.")
                continue
            edge_list.remove(e)
            writes.append(("edge_del", e))
            inverse.append({"op": "link", "edge": e})
        else:
            errors.append(f"{label}: unsupported change.")
    for i in by_id.values():
        par = i.get("parent_id")
        if par and (par not in by_id or by_id[par]["kind"] != "group"):
            errors.append(f"“{i['title']}”: it can only sit inside an existing group.")
        seen, cur = set(), par
        while cur and cur in by_id:
            if cur in seen or cur == i["item_id"]:
                errors.append(f"“{i['title']}”: groups cannot contain themselves.")
                break
            seen.add(cur)
            cur = by_id[cur].get("parent_id")
    if has_cycle(edge_list):
        errors.append("Those prerequisites would form a loop. Scheduling dependencies must run one way.")
    if errors:
        bad(list(dict.fromkeys(errors))[:12])
    if not writes:
        bad("That matches what is saved already, so nothing changed.")
    await claim_rev(p, rev, {"updated_at": now})
    for w, d in writes:
        if w == "upsert":
            await db.items.replace_one({"item_id": d["item_id"], "project_id": pid}, {**public(d), "project_id": pid, "deleted": False}, upsert=True)
        elif w == "delete":
            await db.items.update_one({"item_id": d["item_id"], "project_id": pid}, {"$set": {"deleted": True, "updated_at": now}})
        elif w == "edge_add":
            await db.item_edges.replace_one({"edge_id": d["edge_id"], "project_id": pid}, {**public(d), "project_id": pid, "deleted": False}, upsert=True)
        else:
            await db.item_edges.update_one({"edge_id": d["edge_id"], "project_id": pid}, {"$set": {"deleted": True}})
    touched = sorted({d.get("item_id") or d.get("from_id") for _, d in writes if d.get("item_id") or d.get("from_id")})
    batch = {"batch_id": new_id("bat"), "project_id": pid, "actor": user["name"], "origin": origin,
             "summary": (summary or f"{len(writes)} change{'s' if len(writes) != 1 else ''}")[:300],
             "inverse": list(reversed(inverse)), "touched": touched, "undo_of": inverse_of, "created_at": now}
    await db.item_batches.insert_one(dict(batch))
    await log_event(pid, org(user), "items", f"{'Undo: ' if inverse_of else ''}{batch['summary']}")
    return {k: v for k, v in batch.items() if k != "inverse"}


@router.get("/items")
async def get_items(user=Depends(current_user)):
    p = await get_project(user)
    items, edges = await load_items(p["project_id"])
    return {"items": items, "edges": edges, "rev": p["rev"]}


@router.post("/items/ops")
async def post_ops(body: OpsIn, user=Depends(current_user)):
    p = await get_project(user)
    batch = await apply_ops(p, user, body.rev, body.ops, body.summary)
    items, edges = await load_items(p["project_id"])
    return {"batch": batch, "items": items, "edges": edges, "rev": body.rev + 1}


@router.post("/items/undo")
async def undo(body: UndoIn, user=Depends(current_user)):
    p = await get_project(user)
    b = await db.item_batches.find_one({"batch_id": body.batch_id, "project_id": p["project_id"]}, {"_id": 0})
    if not b:
        raise HTTPException(404, "That change was not found in this project.")
    if await db.item_batches.find_one({"undo_of": body.batch_id, "project_id": p["project_id"]}):
        bad("That change was already undone.")
    batch = await apply_ops(p, user, body.rev, b["inverse"], f"Undo {b['summary']}", b["origin"], inverse_of=body.batch_id)
    items, edges = await load_items(p["project_id"])
    return {"batch": batch, "items": items, "edges": edges, "rev": body.rev + 1}
