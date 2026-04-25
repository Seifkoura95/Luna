"""
Stripe Webhook Handler for Luna Group VIP App

On any handler exception, the failure is persisted to `payment_webhook_failures`
collection. If 2+ failures land in the last 5 minutes, an alert email is sent
to all active admins (rate-limited to one alert per 30 minutes).
"""
from fastapi import APIRouter, Request, HTTPException
import os
import logging
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
load_dotenv()

from emergentintegrations.payments.stripe.checkout import StripeCheckout
from database import db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Webhooks"])


_WEBHOOK_FAILURE_WINDOW_MIN = 5
_WEBHOOK_FAILURE_THRESHOLD = 2
_ALERT_COOLDOWN_MIN = 30
_ALERT_KEY = "webhook_failure_alert"


async def _record_failure(reason: str, signature: str | None, body_excerpt: str) -> int:
    """Persist a webhook failure and return the count in the last N minutes."""
    now = datetime.now(timezone.utc)
    await db.payment_webhook_failures.insert_one({
        "at": now,
        "reason": reason[:500],
        "signature_prefix": (signature or "")[:30],
        "body_excerpt": body_excerpt[:500],
    })
    since = now - timedelta(minutes=_WEBHOOK_FAILURE_WINDOW_MIN)
    return await db.payment_webhook_failures.count_documents({"at": {"$gte": since}})


async def _maybe_send_alert(failure_count: int, latest_reason: str) -> None:
    """Send an email alert when failure threshold is hit, with a cooldown."""
    if failure_count < _WEBHOOK_FAILURE_THRESHOLD:
        return

    now = datetime.now(timezone.utc)
    cooldown_until = now - timedelta(minutes=_ALERT_COOLDOWN_MIN)

    # Atomic upsert so concurrent webhooks don't double-fire alerts
    state = await db.alert_state.find_one_and_update(
        {"key": _ALERT_KEY},
        {"$setOnInsert": {"key": _ALERT_KEY, "last_alert_at": datetime(1970, 1, 1, tzinfo=timezone.utc)}},
        upsert=True,
        return_document=True,
    )
    last_at = state.get("last_alert_at") if state else None
    # Mongo strips tzinfo on read — make naive vs aware comparison safe.
    if last_at and last_at.tzinfo is None:
        last_at = last_at.replace(tzinfo=timezone.utc)
    if last_at and last_at > cooldown_until:
        logger.info("[stripe-webhook] alert suppressed (cooldown). count=%d", failure_count)
        return

    await db.alert_state.update_one({"key": _ALERT_KEY}, {"$set": {"last_alert_at": now}})

    # Pull active admins
    admins = await db.users.find(
        {"role": {"$in": ["admin", "super_admin"]}, "email": {"$exists": True, "$ne": None}},
        {"_id": 0, "email": 1, "name": 1},
    ).to_list(20)
    if not admins:
        logger.warning("[stripe-webhook] %d failures but no admin emails to alert", failure_count)
        return

    subject = f"⚠️ Luna Stripe webhook failing — {failure_count} errors in {_WEBHOOK_FAILURE_WINDOW_MIN} min"
    html = f"""
    <p>Luna's Stripe webhook handler at <code>/api/webhook/stripe</code> has logged
    <strong>{failure_count} failures</strong> in the last {_WEBHOOK_FAILURE_WINDOW_MIN} minutes.</p>
    <p><strong>Latest reason:</strong> <code>{latest_reason[:300]}</code></p>
    <p>Customers may be paying without their bookings, tickets, or subscriptions activating.</p>
    <p>Triage:</p>
    <ol>
      <li>Hit <code>GET /api/admin/payments/health</code> to see the live state.</li>
      <li>Open <a href="https://dashboard.stripe.com/webhooks">Stripe Dashboard → Webhooks</a> and check recent delivery attempts.</li>
      <li>Check Railway logs: <code>tail -f /var/log/supervisor/backend.err.log | grep -i webhook</code>.</li>
    </ol>
    <p>This alert will not re-fire for {_ALERT_COOLDOWN_MIN} minutes (cooldown).</p>
    """
    try:
        from utils.email_service import _send  # type: ignore
        for admin in admins:
            try:
                await _send(admin["email"], subject, html)
            except Exception as e:
                logger.error("[stripe-webhook] alert email to %s failed: %s", admin.get("email"), e)
    except Exception as e:
        logger.error("[stripe-webhook] could not import email_service: %s", e)


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    body = b""
    signature = request.headers.get("Stripe-Signature")
    try:
        api_key = os.environ.get("STRIPE_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="Stripe not configured")

        host_url = str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}/api/webhook/stripe"

        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

        body = await request.body()

        webhook_response = await stripe_checkout.handle_webhook(body, signature)

        logger.info(
            "Webhook received: %s for session %s",
            webhook_response.event_type, webhook_response.session_id,
        )

        if webhook_response.session_id:
            update_data = {
                "webhook_event_id": webhook_response.event_id,
                "webhook_event_type": webhook_response.event_type,
                "payment_status": webhook_response.payment_status,
                "updated_at": datetime.now(timezone.utc),
            }
            if webhook_response.payment_status == "paid":
                update_data["status"] = "completed"
            elif webhook_response.event_type == "checkout.session.expired":
                update_data["status"] = "expired"

            await db.payment_transactions.update_one(
                {"session_id": webhook_response.session_id},
                {"$set": update_data},
            )

        return {"status": "ok"}

    except Exception as e:
        reason = f"{type(e).__name__}: {e}"
        logger.error("Webhook error: %s", reason)
        try:
            count = await _record_failure(
                reason=reason,
                signature=signature,
                body_excerpt=body.decode("utf-8", errors="replace") if body else "",
            )
            await _maybe_send_alert(count, reason)
        except Exception as track_exc:
            logger.error("Failure tracking itself failed: %s", track_exc)
        # Return 200 to prevent Stripe from retrying — we already persisted the failure for triage
        return {"status": "error", "message": str(e)}
