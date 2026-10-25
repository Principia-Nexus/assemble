import os
from datetime import datetime, timedelta, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from core import db, current_user, now_iso

router = APIRouter(prefix="/api")
stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]
LOOKUP_KEY = "assemble_pilot_90d"
AMOUNT, CURRENCY, DAYS = 9900, "usd", 90


async def pilot_state(user):
    if user.get("sandbox_id"):
        return {"required": False, "active": True, "demo": True, "until": None}
    if not user.get("firm_id"):
        return {"required": False, "active": False, "demo": False, "until": None}
    f = await db.firms.find_one({"firm_id": user["firm_id"]}, {"_id": 0, "pilot_until": 1})
    until = (f or {}).get("pilot_until")
    active = bool(until) and until > now_iso()
    return {"required": True, "active": active, "demo": False, "until": until}


async def require_pilot(user):
    s = await pilot_state(user)
    if s["required"] and not s["active"]:
        raise HTTPException(402, "Pilot access is not active for your business. Activate it to plan real jobs, or try the demo.")


async def fulfil(session):
    """Idempotent: activate only for the expected paid product, once per session."""
    tx = await db.payment_transactions.find_one({"session_id": session["id"]})
    if not tx or tx.get("payment_status") == "paid":
        return
    if session.get("payment_status") != "paid" or session.get("amount_total") != AMOUNT or session.get("currency") != CURRENCY \
            or (session.get("metadata") or {}).get("firm_id") != tx["firm_id"]:
        return
    res = await db.payment_transactions.update_one(
        {"session_id": session["id"], "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "completed", "payment_status": "paid", "stripe_payment_intent_id": session.get("payment_intent"),
                  "updated_at": now_iso()}})
    if res.modified_count:
        start = datetime.now(timezone.utc)
        await db.firms.update_one({"firm_id": tx["firm_id"]}, {"$set": {
            "pilot_until": (start + timedelta(days=DAYS)).isoformat(), "pilot_started": start.isoformat(),
            "pilot_session_id": session["id"], "pilot_mode": os.environ["STRIPE_MODE"]}})


@router.get("/billing/access")
async def access(user=Depends(current_user)):
    return await pilot_state(user)


class CheckoutIn(BaseModel):
    origin_url: str


@router.post("/billing/checkout")
async def checkout(body: CheckoutIn, user=Depends(current_user)):
    s = await pilot_state(user)
    if not s["required"]:
        raise HTTPException(400, "This account doesn't need pilot access.")
    if s["active"]:
        raise HTTPException(409, "Pilot access is already active for your business.")
    pending = await db.payment_transactions.find_one({"firm_id": user["firm_id"], "payment_status": "pending"}, sort=[("created_at", -1)])
    if pending:
        sess = stripe.checkout.Session.retrieve(pending["session_id"])
        if sess.status == "complete":
            await fulfil(sess.to_dict())
            raise HTTPException(409, "Your earlier payment is being confirmed. Refresh the status instead of paying again.")
        if sess.status == "open":
            return {"checkout_url": sess.url, "session_id": sess.id}
    price = stripe.Price.list(lookup_keys=[LOOKUP_KEY], active=True, limit=1).data
    if not price:
        raise HTTPException(503, "Checkout is unavailable right now. Try again shortly; the demo is still open.")
    origin = body.origin_url.rstrip("/")
    sess = stripe.checkout.Session.create(
        line_items=[{"price": price[0].id, "quantity": 1}], mode="payment",
        success_url=f"{origin}/payment/success?session_id={{CHECKOUT_SESSION_ID}}", cancel_url=f"{origin}/payment/cancel",
        customer_email=user.get("email"), metadata={"firm_id": user["firm_id"], "user_id": user["user_id"], "lookup_key": LOOKUP_KEY},
        managed_payments={"enabled": True})
    await db.payment_transactions.insert_one({
        "session_id": sess.id, "firm_id": user["firm_id"], "user_id": user["user_id"], "lookup_key": LOOKUP_KEY,
        "amount": AMOUNT / 100, "currency": CURRENCY, "status": "initiated", "payment_status": "pending",
        "created_at": now_iso(), "updated_at": now_iso()})
    return {"checkout_url": sess.url, "session_id": sess.id}


@router.get("/billing/status/{session_id}")
async def status(session_id: str, user=Depends(current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id, "firm_id": user.get("firm_id")}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Payment not found for your business.")
    if tx["payment_status"] != "paid":
        try:
            sess = stripe.checkout.Session.retrieve(session_id)
            await fulfil(sess.to_dict())
            if sess.status == "expired":
                await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {"status": "expired", "payment_status": "expired"}})
        except stripe.error.StripeError:
            pass
        tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    return {"session_id": session_id, "status": tx["status"], "payment_status": tx["payment_status"], "access": await pilot_state(user)}


@router.post("/stripe/webhook")
async def webhook(request: Request):
    try:
        event = stripe.Webhook.construct_event(await request.body(), request.headers.get("stripe-signature", ""), WEBHOOK_SECRET)
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded"):
        await fulfil(obj)
    elif t in ("checkout.session.async_payment_failed", "checkout.session.expired"):
        await db.payment_transactions.update_one({"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
                                                 {"$set": {"status": t.rsplit(".", 1)[-1], "payment_status": "failed" if "failed" in t else "expired"}})
    return {"status": "ok"}
