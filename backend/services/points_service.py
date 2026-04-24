"""
Points Service — the authoritative way to award + refresh points in the app.

All in-app points events (mission completions, rewards, referrals, etc.) must
flow through this module. It:

  1. Looks up the user's SwiftPOS customer ID (via `cherryhub_member_key`).
  2. Pushes a negative-price transaction line to SwiftPOS → SwiftPOS awards
     points based on its own multiplier + PLU price.
  3. Calls CherryHub `GET /members/{key}/points` — which real-time-reads from
     SwiftPOS — to get the updated balance.
  4. Mirrors the new balance onto `users.points_balance` so the app UI has
     something to show instantly without re-hitting CherryHub on every render.
  5. Writes a `points_transactions` ledger row for in-app history.

If the user is NOT linked to CherryHub yet, the award is stored as `pending`
and retried later when they link (Phase 3 follow-up).

For backward compatibility, if `POINTS_LEGACY_DIRECT_MONGO=true` in env, the
service falls back to the old direct-Mongo counter so nothing breaks while
SwiftPOS credentials are still missing.
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from database import db
from services.swiftpos_service import swiftpos_service, SwiftPOSError
from services.swiftpos_plu_map import plu_for_mission, plu_for_reward, points_for_plu

logger = logging.getLogger(__name__)

# Feature flag — while SwiftPOS creds are missing, still award in Mongo so the
# app keeps working. Set to "false" when the SwiftPOS creds land + we've
# verified live dispatch.
POINTS_LEGACY_DIRECT_MONGO = os.environ.get("POINTS_LEGACY_DIRECT_MONGO", "true").lower() in {"1", "true", "yes"}


async def _lookup_user(user_id: str) -> Optional[dict]:
    return await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "user_id": 1, "cherryhub_member_key": 1, "swiftpos_customer_id": 1,
         "email": 1, "name": 1, "points_balance": 1},
    )


async def _refresh_balance_from_cherryhub(member_key: str) -> Optional[int]:
    """Call CherryHub GET /points — forces a real-time read from SwiftPOS."""
    try:
        from cherryhub_service import cherryhub_service, CHERRYHUB_MOCK_MODE
        if CHERRYHUB_MOCK_MODE:
            return None
        resp = await cherryhub_service.get_member_points_balance(member_key)
        # CherryHub returns {"PointsBalance": N} or similar
        balance = resp.get("PointsBalance") or resp.get("pointsBalance") or resp.get("Balance")
        return int(balance) if balance is not None else None
    except Exception as e:
        logger.warning("CherryHub balance refresh failed for %s: %s", member_key, e)
        return None


async def award_points(
    *,
    user_id: str,
    event_type: str,                       # "mission" | "reward" | "referral" | "birthday" | "nightly_crown" | "manual"
    event_key: Optional[str] = None,       # mission_id / reward_id — used to look up PLU
    points_override: Optional[int] = None, # if no PLU exists (e.g. referral, nightly crown), use this
    multiplier: int = 1,
    reason: Optional[str] = None,
    venue_id: Optional[str] = None,
) -> dict:
    """Award points for an in-app event.

    Returns: {"success": bool, "dispatched_to_swiftpos": bool, "points_awarded": int,
              "new_balance": int | None, "pending": bool, "transaction_id": str, "reason": str | None}
    """
    user = await _lookup_user(user_id)
    if not user:
        raise ValueError(f"User {user_id} not found")

    # Resolve PLU (for SwiftPOS) + how many points we expect
    plu_info: Optional[dict] = None
    if event_type == "mission" and event_key:
        plu_info = plu_for_mission(event_key)
    elif event_type == "reward" and event_key:
        plu_info = plu_for_reward(event_key)

    expected_points: int
    if plu_info:
        expected_points = points_for_plu(plu_info["unit_price"], multiplier)
    elif points_override is not None:
        expected_points = int(points_override)
    else:
        raise ValueError(f"No PLU for {event_type}/{event_key} and no points_override supplied")

    member_key = user.get("cherryhub_member_key")
    swiftpos_customer_id = user.get("swiftpos_customer_id") or member_key  # fallback
    now = datetime.now(timezone.utc)
    tx_id = f"pts_{uuid.uuid4().hex[:10]}"

    dispatched = False
    new_balance: Optional[int] = None
    pending = False
    dispatch_error: Optional[str] = None

    # 1. Try SwiftPOS dispatch (only if we have everything we need)
    if plu_info and swiftpos_customer_id and not swiftpos_service.is_mock and not POINTS_LEGACY_DIRECT_MONGO:
        try:
            sp_resp = await swiftpos_service.submit_transaction(
                swiftpos_customer_id=swiftpos_customer_id,
                line_items=[{
                    "plu": plu_info["plu"],
                    "quantity": multiplier,
                    "unit_price": -abs(plu_info["unit_price"]),  # ALWAYS negative
                    "description": f"Luna {event_type.title()}: {plu_info['name']}",
                }],
                external_reference=f"{user_id}-{event_type}-{event_key or ''}-{tx_id}",
                notes=reason,
            )
            dispatched = True
            logger.info("SwiftPOS dispatch OK: user=%s event=%s tx=%s", user_id, event_key, sp_resp.get("TransactionId"))

            # 2. Refresh balance from CherryHub (real-time SwiftPOS read)
            if member_key:
                new_balance = await _refresh_balance_from_cherryhub(member_key)
        except SwiftPOSError as e:
            dispatch_error = str(e)[:300]
            logger.error("SwiftPOS dispatch FAILED: user=%s event=%s err=%s", user_id, event_key, dispatch_error)
            pending = True
    elif plu_info and not swiftpos_customer_id:
        pending = True
        dispatch_error = "User not linked to CherryHub/SwiftPOS yet"

    # 3. Mongo ledger (always)
    await db.points_transactions.insert_one({
        "id": tx_id,
        "user_id": user_id,
        "type": "earn",
        "total_points": expected_points,
        "source": event_type,
        "event_key": event_key,
        "multiplier": multiplier,
        "reason": reason,
        "venue_id": venue_id,
        "plu": plu_info["plu"] if plu_info else None,
        "dispatched_to_swiftpos": dispatched,
        "pending_swiftpos_dispatch": pending,
        "dispatch_error": dispatch_error,
        "created_at": now,
    })

    # 4. Mirror balance onto user record
    #    If we got a fresh CherryHub balance, USE it (source of truth).
    #    Otherwise (mock / missing creds / CherryHub down) increment the local counter.
    if new_balance is not None:
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"points_balance": new_balance, "points_balance_refreshed_at": now}},
        )
    else:
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"points_balance": expected_points, "total_points_earned": expected_points}},
        )
        # Read back so caller has a number to show
        refreshed = await db.users.find_one({"user_id": user_id}, {"_id": 0, "points_balance": 1})
        new_balance = (refreshed or {}).get("points_balance")

    return {
        "success": True,
        "dispatched_to_swiftpos": dispatched,
        "pending_swiftpos_dispatch": pending,
        "points_awarded": expected_points,
        "new_balance": new_balance,
        "transaction_id": tx_id,
        "dispatch_error": dispatch_error,
        "plu": plu_info["plu"] if plu_info else None,
    }


async def refresh_balance_for_user(user_id: str) -> dict:
    """Force-refresh a user's points balance from CherryHub (which real-time reads SwiftPOS).

    Used by the mobile app's pull-to-refresh on the wallet screen.
    """
    user = await _lookup_user(user_id)
    if not user:
        raise ValueError(f"User {user_id} not found")

    member_key = user.get("cherryhub_member_key")
    if not member_key:
        return {
            "success": False,
            "reason": "not_linked",
            "message": "This account isn't linked to CherryHub yet — link it in Profile to see live points.",
            "local_balance": user.get("points_balance", 0),
        }

    balance = await _refresh_balance_from_cherryhub(member_key)
    if balance is None:
        return {
            "success": False,
            "reason": "upstream_error",
            "message": "Couldn't reach CherryHub. Showing your last known balance.",
            "local_balance": user.get("points_balance", 0),
        }

    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"points_balance": balance, "points_balance_refreshed_at": now}},
    )
    return {
        "success": True,
        "balance": balance,
        "refreshed_at": now.isoformat(),
        "source": "cherryhub_realtime",
    }
