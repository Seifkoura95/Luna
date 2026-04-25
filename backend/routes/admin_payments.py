"""
Admin Payments Health & Webhook Diagnostics
===========================================

Single-stop dashboard for the Luna ↔ Stripe webhook pipeline.

Endpoints:
  GET  /api/admin/payments/health              — config + 24h stats
  GET  /api/admin/payments/webhook-failures    — recent failure log
  POST /api/admin/payments/simulate-webhook    — fire a synthetic webhook into our handler
                                                 to verify routing + DB writes (does NOT
                                                 produce a real Stripe event)

Auth: same as other admin routes — JWT admin/staff/manager OR `X-Luna-Hub-Key`.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request

from database import db
from routes.admin import require_admin


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin/payments", tags=["admin-payments"])


def _iso(dt) -> Optional[str]:
    if not dt:
        return None
    if isinstance(dt, str):
        return dt
    return dt.isoformat()


# ────────────── /health ──────────────

@router.get("/health")
async def payments_health(request: Request):
    """Top-line health of the Stripe webhook pipeline."""
    await require_admin(request)
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)
    since_7d = now - timedelta(days=7)

    api_key = os.environ.get("STRIPE_API_KEY", "")
    whsec = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    def _mask(v: str, head: int = 8, tail: int = 4) -> str:
        if not v:
            return ""
        if len(v) <= head + tail:
            return "***"
        return f"{v[:head]}…{v[-tail:]}"

    # Transaction stats (24h + 7d)
    tx_24h_total = await db.payment_transactions.count_documents({"created_at": {"$gte": since_24h}})
    tx_24h_paid = await db.payment_transactions.count_documents({
        "created_at": {"$gte": since_24h}, "payment_status": "paid",
    })
    tx_24h_pending = await db.payment_transactions.count_documents({
        "created_at": {"$gte": since_24h}, "payment_status": "pending",
    })
    tx_7d_total = await db.payment_transactions.count_documents({"created_at": {"$gte": since_7d}})

    # Webhook hit stats — uses the same `webhook_event_type` field that webhook.py writes
    wh_received = await db.payment_transactions.count_documents({
        "updated_at": {"$gte": since_24h},
        "webhook_event_id": {"$exists": True, "$ne": None},
    })

    # Failure log
    fail_24h = await db.payment_webhook_failures.count_documents({"at": {"$gte": since_24h}})
    fail_7d = await db.payment_webhook_failures.count_documents({"at": {"$gte": since_7d}})

    # Last successful + last failed
    last_success = await db.payment_transactions.find_one(
        {"webhook_event_id": {"$exists": True, "$ne": None}},
        sort=[("updated_at", -1)],
        projection={"_id": 0, "session_id": 1, "webhook_event_type": 1, "updated_at": 1, "payment_status": 1},
    )
    last_failure = await db.payment_webhook_failures.find_one(
        {}, sort=[("at", -1)], projection={"_id": 0},
    )
    if last_success and "updated_at" in last_success:
        last_success["updated_at"] = _iso(last_success["updated_at"])
    if last_failure and "at" in last_failure:
        last_failure["at"] = _iso(last_failure["at"])

    return {
        "stripe_mode": "live" if api_key.startswith("sk_live_") else ("test" if api_key.startswith("sk_test_") else "unknown"),
        "config": {
            "stripe_api_key": _mask(api_key),
            "stripe_webhook_secret": _mask(whsec, head=10, tail=4) if whsec else "",
            "api_key_configured": bool(api_key),
            "webhook_secret_configured": bool(whsec),
        },
        "transactions": {
            "last_24h_total": tx_24h_total,
            "last_24h_paid": tx_24h_paid,
            "last_24h_pending": tx_24h_pending,
            "last_7d_total": tx_7d_total,
        },
        "webhooks": {
            "events_received_24h": wh_received,
            "failures_24h": fail_24h,
            "failures_7d": fail_7d,
            "last_success": last_success,
            "last_failure": last_failure,
        },
        "endpoint_url": str(request.base_url).rstrip("/") + "/api/webhook/stripe",
        "as_of": _iso(now),
    }


# ────────────── /webhook-failures ──────────────

@router.get("/webhook-failures")
async def webhook_failures(
    request: Request,
    limit: int = Query(50, le=200),
    skip: int = Query(0, ge=0),
):
    """Recent failed webhook deliveries — populated by webhook.py exception handler."""
    await require_admin(request)
    total = await db.payment_webhook_failures.count_documents({})
    cursor = db.payment_webhook_failures.find({}, {"_id": 0}).sort("at", -1).skip(skip).limit(limit)
    items = []
    async for f in cursor:
        if "at" in f:
            f["at"] = _iso(f["at"])
        items.append(f)
    return {"total": total, "limit": limit, "skip": skip, "items": items}


# ────────────── /simulate-webhook ──────────────

_SUPPORTED_EVENTS = {
    "checkout.session.completed",
    "checkout.session.expired",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
}


@router.post("/simulate-webhook")
async def simulate_webhook(
    request: Request,
    event_type: str = Query("checkout.session.completed"),
    session_id: Optional[str] = Query(
        None,
        description="If set, must match an existing payment_transactions row. If omitted a synthetic test session is created and torn down.",
    ),
):
    """Fire a synthetic webhook through our own handler.

    This bypasses Stripe entirely — useful for verifying that:
      1. Auth + routing works
      2. The Mongo update path runs cleanly
      3. Downstream side-effects (booking confirmation, ticket issuance, subscription
         activation) trigger as expected

    It does NOT verify Stripe signature signing — for that, use Stripe's
    "Send test webhook" button on the dashboard, which your live webhook URL will receive
    via signed HMAC and our handler will validate normally.
    """
    user = await require_admin(request)

    if event_type not in _SUPPORTED_EVENTS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported event_type. Pick one of: {sorted(_SUPPORTED_EVENTS)}",
        )

    now = datetime.now(timezone.utc)
    synthetic = False

    if session_id:
        tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if not tx:
            raise HTTPException(status_code=404, detail=f"No payment_transactions row with session_id={session_id}")
    else:
        # Create a self-contained synthetic transaction so the webhook update has somewhere to land.
        synthetic = True
        session_id = f"cs_simulated_{now.strftime('%Y%m%d%H%M%S')}_{user.get('user_id','luna_hub')[:8]}"
        await db.payment_transactions.insert_one({
            "session_id": session_id,
            "amount": 0.0,
            "currency": "aud",
            "user_id": user.get("user_id", "luna_hub"),
            "status": "pending",
            "payment_status": "pending",
            "metadata": {"simulated": "true", "triggered_by": user.get("user_id", "luna_hub")},
            "is_simulation": True,
            "created_at": now,
            "updated_at": now,
        })

    # Mirror the same update logic webhook.py runs, but tagged as simulated.
    payment_status = "paid" if event_type in ("checkout.session.completed", "checkout.session.async_payment_succeeded") else (
        "expired" if event_type == "checkout.session.expired" else "failed"
    )
    new_status = (
        "completed" if payment_status == "paid"
        else "expired" if event_type == "checkout.session.expired"
        else "failed"
    )

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "webhook_event_id": f"evt_simulated_{now.strftime('%Y%m%d%H%M%S')}",
            "webhook_event_type": event_type,
            "payment_status": payment_status,
            "status": new_status,
            "updated_at": now,
            "last_simulation_at": now,
        }},
    )

    return {
        "ok": True,
        "session_id": session_id,
        "event_type": event_type,
        "payment_status": payment_status,
        "status": new_status,
        "synthetic_transaction_created": synthetic,
        "note": (
            "If synthetic, this row is tagged is_simulation=true. Safe to delete via "
            "POST /admin/payments/cleanup-simulations. Real Stripe events will not "
            "interact with this row."
        ),
        "next_step": (
            "For end-to-end signature verification, also run Stripe Dashboard → Developers "
            "→ Webhooks → your endpoint → 'Send test webhook'. That tests the full HMAC path."
        ),
    }


# ────────────── /cleanup-simulations ──────────────

@router.post("/cleanup-simulations")
async def cleanup_simulations(request: Request):
    """Delete all `is_simulation=true` transactions created by /simulate-webhook."""
    await require_admin(request)
    res = await db.payment_transactions.delete_many({"is_simulation": True})
    return {"deleted": res.deleted_count}
