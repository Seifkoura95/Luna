"""
Subscriptions Management API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from database import db
from config import SUBSCRIPTION_TIERS, ENTRY_CHARGING_VENUES
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])
logger = logging.getLogger(__name__)


class SubscribeRequest(BaseModel):
    tier_id: str
    payment_method_id: Optional[str] = None


async def award_points(user_id: str, amount_spent: float, source: str, source_id: str):
    """Award points to a user based on spending"""
    subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active"
    })
    
    tier_id = subscription.get("tier_id", "bronze") if subscription else "bronze"
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS["bronze"])
    multiplier = tier.get("points_multiplier", 1.0)
    
    base_points = int(amount_spent * 10)  # 10 points per $1 (= 25% cashback when redeemed at 10pts = $0.25)
    bonus_points = int(base_points * (multiplier - 1))
    total_points = base_points + bonus_points
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"points_balance": total_points}}
    )
    
    await db.points_transactions.insert_one({
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "type": "earn",
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "source": source,
        "source_id": source_id,
        "amount_spent": amount_spent,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier
    }


@router.get("/tiers")
async def get_subscription_tiers():
    """Get all available subscription tiers"""
    return {
        "tiers": list(SUBSCRIPTION_TIERS.values()),
        "entry_venues": ENTRY_CHARGING_VENUES
    }


@router.get("/my")
async def get_my_subscription(request: Request):
    """Get current user's subscription"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    subscription = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    
    if not subscription:
        return {
            "subscription": None,
            "tier": SUBSCRIPTION_TIERS["bronze"],
            "is_subscribed": False
        }
    
    tier_info = SUBSCRIPTION_TIERS.get(subscription.get("tier_id"), SUBSCRIPTION_TIERS["bronze"])
    
    return {
        "subscription": clean_mongo_doc(subscription),
        "tier": tier_info,
        "is_subscribed": True
    }


@router.post("/subscribe")
async def subscribe_to_tier(request: Request, sub_req: SubscribeRequest):
    """Subscribe to a tier.

    - Free (bronze) tier: activates instantly.
    - Paid tiers: creates a Stripe checkout session — the webhook activates
      the subscription only after payment.succeeded.
    - DEV_MODE bypass for `luna@test.com`.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)

    if sub_req.tier_id not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")

    tier = SUBSCRIPTION_TIERS[sub_req.tier_id]
    price = float(tier.get("price") or 0)

    is_dev_account = current_user.get("email") == "luna@test.com"
    is_free_tier = price <= 0

    if is_free_tier or is_dev_account:
        # Instant activation — cancel any active sub, insert new one
        await db.subscriptions.update_many(
            {"user_id": current_user["user_id"], "status": "active"},
            {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
        )

        subscription = {
            "id": str(uuid.uuid4())[:8],
            "user_id": current_user["user_id"],
            "tier_id": sub_req.tier_id,
            "tier_name": tier["name"],
            "price": price,
            "status": "active",
            "billing_period": tier["billing_period"],
            "current_period_start": datetime.now(timezone.utc),
            "current_period_end": datetime.now(timezone.utc) + timedelta(days=30),
            "free_entries_remaining": tier["benefits"]["free_entries_per_month"],
            "created_at": datetime.now(timezone.utc),
            "dev_mode": is_dev_account and not is_free_tier,
        }
        await db.subscriptions.insert_one(subscription)
        await db.users.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": {"subscription_tier": sub_req.tier_id}}
        )

        points_result = {"total_points": 0}
        if price > 0:
            points_result = await award_points(
                user_id=current_user["user_id"],
                amount_spent=price,
                source="subscription",
                source_id=subscription["id"],
            )

        return {
            "success": True,
            "message": f"Welcome to {tier['name']}!",
            "subscription": clean_mongo_doc(subscription),
            "tier": tier,
            "points_earned": points_result.get("total_points", 0),
            "dev_mode": is_dev_account and not is_free_tier,
        }

    # Paid tier, real user — require Stripe checkout
    from routes.payments import get_stripe_checkout
    from emergentintegrations.payments.stripe.checkout import CheckoutSessionRequest

    origin = request.headers.get("origin") or str(request.base_url).rstrip('/')
    success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payment-cancelled"

    metadata = {
        "user_id": current_user["user_id"],
        "package_type": "subscription",
        "tier_id": sub_req.tier_id,
    }

    stripe_checkout = get_stripe_checkout(request)
    checkout_request = CheckoutSessionRequest(
        amount=price,
        currency="aud",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(checkout_request)

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": current_user["user_id"],
        "amount": price,
        "currency": "aud",
        "package_id": f"subscription_{sub_req.tier_id}",
        "package_name": f"{tier['name']} subscription",
        "package_type": "subscription",
        "metadata": metadata,
        "payment_status": "pending",
        "status": "initiated",
        "created_at": datetime.now(timezone.utc),
    })

    return {
        "success": True,
        "requires_payment": True,
        "checkout_url": session.url,
        "session_id": session.session_id,
        "tier": tier,
        "message": f"Redirect to Stripe to complete {tier['name']} subscription.",
    }


@router.post("/cancel")
async def cancel_subscription(request: Request):
    """Cancel current subscription"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.subscriptions.update_one(
        {"user_id": current_user["user_id"], "status": "active"},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc),
            "cancel_at_period_end": True
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    return {"success": True, "message": "Subscription will be cancelled at end of billing period"}


@router.post("/use-entry")
async def use_free_entry(request: Request, venue_id: str):
    """Use a free entry from subscription"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    subscription = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    
    if not subscription:
        raise HTTPException(status_code=400, detail="No active subscription")
    
    remaining = subscription.get("free_entries_remaining", 0)
    if remaining == 0:
        raise HTTPException(status_code=400, detail="No free entries remaining this month")
    
    if venue_id not in ENTRY_CHARGING_VENUES:
        raise HTTPException(status_code=400, detail="This venue doesn't charge entry")
    
    if remaining > 0:
        await db.subscriptions.update_one(
            {"id": subscription["id"]},
            {"$inc": {"free_entries_remaining": -1}}
        )
    
    entry_log = {
        "id": str(uuid.uuid4())[:8],
        "user_id": current_user["user_id"],
        "subscription_id": subscription["id"],
        "venue_id": venue_id,
        "type": "free_entry",
        "used_at": datetime.now(timezone.utc)
    }
    await db.subscription_usage.insert_one(entry_log)
    
    new_remaining = remaining - 1 if remaining > 0 else -1
    
    return {
        "success": True,
        "message": "Free entry applied!",
        "entries_remaining": new_remaining,
        "unlimited": remaining == -1
    }
