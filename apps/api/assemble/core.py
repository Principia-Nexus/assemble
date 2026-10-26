import os
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

import bcrypt  # noqa: E402
import jwt  # noqa: E402
from fastapi import HTTPException, Request  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

JWT_ALG = "HS256"
USER_PROJ = {"_id": 0, "password_hash": 0}
STALE_MSG = "This sheet changed in another tab or save. Reload to see the latest version before saving again."
# Project chosen by the client (X-Project-Id). Never authorization on its own: get_project re-checks firm ownership.
PROJECT_CTX = ContextVar("project_id", default=None)


def now():
    return datetime.now(timezone.utc)


def now_iso():
    return now().isoformat()


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def make_token(user_id: str, kind: str, minutes: int) -> str:
    payload = {"sub": user_id, "type": kind, "t": now().timestamp(), "exp": now() + timedelta(minutes=minutes)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


def decode_token(token: str, kind: str, with_iat=False):
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        return None
    if payload.get("type") != kind:
        return None
    return (payload.get("sub"), payload.get("t", 0)) if with_iat else payload.get("sub")


def token_live(u, iat):
    """Tokens issued before the user's last sign-out are revoked."""
    return bool(u) and iat > (u.get("tokens_valid_after") or -1)


def as_aware(dt):
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def user_from_request(request: Request):
    tok = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    bearer = auth[7:] if auth.startswith("Bearer ") else None
    for candidate in (tok, bearer):
        got = decode_token(candidate, "access", with_iat=True) if candidate else None
        if got:
            u = await db.users.find_one({"user_id": got[0]}, USER_PROJ)
            if token_live(u, got[1]):
                u.pop("tokens_valid_after", None)
                return u
            return None
    return None


async def current_user(request: Request) -> dict:
    u = await user_from_request(request)
    if not u:
        raise HTTPException(status_code=401, detail="Please sign in to continue.")
    return u


def public_user(u):
    keys = ("user_id", "email", "name", "picture", "firm_id", "firm_name", "sandbox_id", "demo_key", "auth_methods")
    return {k: u.get(k) for k in keys}


async def log_event(project_id, actor, kind, summary, partner_id=None, details=None):
    await db.events.insert_one({
        "event_id": new_id("evt"),
        "project_id": project_id,
        "at": now_iso(),
        "actor_name": actor.get("name") if actor else "System",
        "actor_kind": actor.get("_kind", "organizer") if actor else "system",
        "kind": kind,
        "summary": summary,
        "partner_id": partner_id,
        "details": details or [],
    })
    if project_id:
        await db.projects.update_one({"project_id": project_id}, {"$set": {"updated_at": now_iso()}})
