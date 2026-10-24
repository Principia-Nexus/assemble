import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

import bcrypt  # noqa: E402
import jwt  # noqa: E402
from fastapi import HTTPException, Request  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

JWT_ALG = "HS256"
USER_PROJ = {"_id": 0, "password_hash": 0}
STALE_MSG = "This sheet changed in another tab or save. Reload to see the latest version before saving again."


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
    payload = {"sub": user_id, "type": kind, "exp": now() + timedelta(minutes=minutes)}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALG)


def decode_token(token: str, kind: str):
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.InvalidTokenError:
        return None
    return payload.get("sub") if payload.get("type") == kind else None


def as_aware(dt):
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


async def user_from_request(request: Request):
    tok = request.cookies.get("access_token")
    auth = request.headers.get("Authorization", "")
    bearer = auth[7:] if auth.startswith("Bearer ") else None
    for candidate in (tok, bearer):
        uid = decode_token(candidate, "access") if candidate else None
        if uid:
            return await db.users.find_one({"user_id": uid}, USER_PROJ)
    st = request.cookies.get("session_token") or bearer
    if st:
        s = await db.user_sessions.find_one({"session_token": st}, {"_id": 0})
        if s and as_aware(s["expires_at"]) > now():
            return await db.users.find_one({"user_id": s["user_id"]}, USER_PROJ)
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
