import os
import re
import uuid
from datetime import timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from core import (db, now, now_iso, new_id, hash_password, verify_password, make_token, decode_token,
                  current_user, public_user, USER_PROJ)
from demo import DEMO_ACCOUNTS, DEMO_EMAILS, ensure_demo_user

router = APIRouter(prefix="/api/auth")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
VISITOR_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")
ACCESS_MIN = 60


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str
    firm_name: str


class LoginIn(BaseModel):
    email: str
    password: str
    visitor_id: Optional[str] = None


class SessionIn(BaseModel):
    session_id: str


def cookie(resp, key, value, max_age):
    resp.set_cookie(key=key, value=value, httponly=True, secure=True, samesite="none", max_age=max_age, path="/")


def set_jwt_cookies(resp: Response, user_id: str):
    cookie(resp, "access_token", make_token(user_id, "access", ACCESS_MIN), ACCESS_MIN * 60)
    cookie(resp, "refresh_token", make_token(user_id, "refresh", 60 * 24 * 7), 604800)
    resp.delete_cookie("session_token", path="/", secure=True, samesite="none")


async def create_firm(name):
    firm_id = new_id("firm")
    await db.firms.insert_one({"firm_id": firm_id, "name": name, "sandbox_id": None, "synthetic": False,
                               "created_at": now_iso()})
    return firm_id


@router.get("/demo-accounts")
async def demo_accounts():
    return {"password": os.environ["DEMO_PASSWORD"],
            "accounts": [{k: a[k] for k in ("key", "email", "name", "role", "firm")} for a in DEMO_ACCOUNTS]}


@router.post("/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(422, "Enter a valid email address.")
    if email in DEMO_EMAILS or email.endswith("@demo.assemble.test"):
        raise HTTPException(422, "Demo addresses are reserved. Use the demo accounts listed on this page.")
    if len(body.password) < 8:
        raise HTTPException(422, "Password must be at least 8 characters.")
    if not body.name.strip() or not body.firm_name.strip():
        raise HTTPException(422, "Your name and firm name are required.")
    if await db.users.find_one({"email": email, "sandbox_id": None}):
        raise HTTPException(400, "An account with this email already exists. Sign in instead.")
    firm_id = await create_firm(body.firm_name.strip())
    user = {"user_id": new_id("user"), "email": email, "name": body.name.strip(), "picture": None,
            "password_hash": hash_password(body.password), "sandbox_id": None, "demo_key": None,
            "auth_methods": ["password"], "email_verified": False, "firm_id": firm_id,
            "firm_name": body.firm_name.strip(), "partner_access": [], "created_at": now_iso()}
    await db.users.insert_one(user)
    set_jwt_cookies(response, user["user_id"])
    return public_user(user)


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response):
    email = body.email.strip().lower()
    if email in DEMO_EMAILS:
        if not body.visitor_id or not VISITOR_RE.match(body.visitor_id):
            raise HTTPException(400, "Demo sign-in needs a browser visitor id. Reload the page and try again.")
        if body.password != os.environ["DEMO_PASSWORD"]:
            raise HTTPException(401, "Email or password is incorrect.")
        user = await ensure_demo_user(body.visitor_id, DEMO_EMAILS[email])
    else:
        ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0]
        ident = f"{ip}:{email}"
        att = await db.login_attempts.find_one({"identifier": ident})
        if att and att.get("count", 0) >= 5 and att.get("locked_until") and att["locked_until"] > now().isoformat():
            raise HTTPException(429, "Too many failed attempts. Try again in 15 minutes.")
        user = await db.users.find_one({"email": email, "sandbox_id": None})
        if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
            count = (att or {}).get("count", 0) + 1
            upd = {"count": count}
            if count >= 5:
                upd["locked_until"] = (now() + timedelta(minutes=15)).isoformat()
            await db.login_attempts.update_one({"identifier": ident}, {"$set": upd}, upsert=True)
            raise HTTPException(401, "Email or password is incorrect.")
        await db.login_attempts.delete_many({"identifier": ident})
    set_jwt_cookies(response, user["user_id"])
    return public_user(user)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    uid = decode_token(request.cookies.get("refresh_token") or "", "refresh")
    if not uid or not await db.users.find_one({"user_id": uid}, {"_id": 1}):
        raise HTTPException(401, "Session expired. Please sign in again.")
    cookie(response, "access_token", make_token(uid, "access", ACCESS_MIN), ACCESS_MIN * 60)
    return {"ok": True}


@router.get("/me")
async def me(user=Depends(current_user)):
    return public_user(user)


@router.post("/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_many({"session_token": st})
    for k in ("access_token", "refresh_token", "session_token"):
        response.delete_cookie(k, path="/", secure=True, samesite="none")
    return {"ok": True}


@router.post("/session")
async def google_session(body: SessionIn, response: Response):
    async with httpx.AsyncClient(timeout=20) as c:
        r = await c.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                        headers={"X-Session-ID": body.session_id})
    if r.status_code != 200:
        raise HTTPException(401, "Google sign-in could not be completed. Please try again.")
    data = r.json()
    email = data["email"].lower()
    user = await db.users.find_one({"email": email, "sandbox_id": None}, USER_PROJ)
    if user:
        upd = {"name": user.get("name") or data.get("name"), "picture": data.get("picture"), "email_verified": True}
        if not user.get("firm_id"):
            upd["firm_id"] = await create_firm(f"{data.get('name') or email}'s firm")
            upd["firm_name"] = f"{data.get('name') or email}'s firm"
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd, "$addToSet": {"auth_methods": "google"}})
    else:
        firm_name = f"{data.get('name') or email}'s firm"
        user = {"user_id": f"user_{uuid.uuid4().hex[:12]}", "email": email, "name": data.get("name") or email,
                "picture": data.get("picture"), "sandbox_id": None, "demo_key": None, "auth_methods": ["google"],
                "email_verified": True, "firm_id": await create_firm(firm_name), "firm_name": firm_name,
                "partner_access": [], "created_at": now_iso()}
        await db.users.insert_one(user)
    await db.user_sessions.insert_one({"user_id": user["user_id"], "session_token": data["session_token"],
                                       "expires_at": (now() + timedelta(days=7)).isoformat(), "created_at": now_iso()})
    cookie(response, "session_token", data["session_token"], 604800)
    for k in ("access_token", "refresh_token"):
        response.delete_cookie(k, path="/", secure=True, samesite="none")
    return public_user(await db.users.find_one({"user_id": user["user_id"]}, USER_PROJ))
