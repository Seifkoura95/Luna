"""
Daily Leaderboard Winner Job

Runs at midnight (Australia/Brisbane) every night.
Awards 50 points to whoever currently sits at rank #1 on the
all-time points leaderboard.

Behaviour:
- Idempotent per calendar day in Brisbane (won't double-award if re-triggered).
- Skips if no eligible user has > 0 points.
- Records a points_transactions entry (source=daily_leaderboard_winner).
- Records a leaderboard_winners entry (historical log).
- Sends an in-app notification + push notification.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from typing import Optional

from database import db

logger = logging.getLogger(__name__)

BRISBANE_TZ = ZoneInfo("Australia/Brisbane")
DAILY_PRIZE_POINTS = 50
PRIZE_SOURCE = "daily_leaderboard_winner"


def _brisbane_day_key(now_utc: Optional[datetime] = None) -> str:
    """Return the Brisbane calendar date for the moment we *awarded* (i.e. the day
    that just ended when midnight strikes). This is the Brisbane date of the
    moment 1 second before "now" — so if the scheduler fires at 00:00:00 Brisbane
    on April 24, we key it as "2026-04-23" (the night that just ended).
    """
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)
    brisbane_now = now_utc.astimezone(BRISBANE_TZ)
    # The day that just ended
    ended_day = brisbane_now - timedelta(seconds=1)
    return ended_day.strftime("%Y-%m-%d")


async def _get_current_leader() -> Optional[dict]:
    """Get the current #1 user by points_balance (excludes admins and sample seed users)."""
    pipeline = [
        {
            "$match": {
                "role": {"$ne": "admin"},
                "points_balance": {"$gt": 0},
                "user_id": {"$not": {"$regex": "^sample_user_"}},
            }
        },
        {"$sort": {"points_balance": -1}},
        {"$limit": 1},
        {
            "$project": {
                "_id": 0,
                "user_id": 1,
                "name": 1,
                "email": 1,
                "points_balance": 1,
                "push_tokens": 1,
            }
        },
    ]
    results = await db.users.aggregate(pipeline).to_list(1)
    return results[0] if results else None


async def award_daily_leaderboard_winner(force: bool = False) -> dict:
    """Award 50 points to the current #1 on the points leaderboard.

    Args:
        force: if True, bypass the idempotency guard (for admin testing).

    Returns:
        A dict describing what happened.
    """
    now_utc = datetime.now(timezone.utc)
    day_key = _brisbane_day_key(now_utc)

    # Idempotency guard — one winner per Brisbane calendar day
    if not force:
        existing = await db.leaderboard_winners.find_one({"day_key": day_key})
        if existing:
            logger.info(
                "Daily leaderboard winner already awarded for %s (user=%s)",
                day_key,
                existing.get("user_id"),
            )
            return {
                "success": False,
                "reason": "already_awarded",
                "day_key": day_key,
                "winner": {
                    "user_id": existing.get("user_id"),
                    "display_name": existing.get("display_name"),
                    "amount": existing.get("amount"),
                },
            }

    leader = await _get_current_leader()
    if not leader:
        logger.info("No eligible leaderboard winner for %s (no users with points)", day_key)
        await db.leaderboard_winners.insert_one(
            {
                "id": f"lbw_{uuid.uuid4().hex[:10]}",
                "day_key": day_key,
                "user_id": None,
                "display_name": None,
                "amount": 0,
                "skipped": True,
                "skipped_reason": "no_eligible_leader",
                "awarded_at": now_utc,
            }
        )
        return {"success": False, "reason": "no_leader", "day_key": day_key}

    user_id = leader["user_id"]
    name = leader.get("name") or "Champion"
    parts = name.split()
    display_name = f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else name

    # 1) Credit the points
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$inc": {
                "points_balance": DAILY_PRIZE_POINTS,
                "total_points_earned": DAILY_PRIZE_POINTS,
            }
        },
    )

    # 2) Ledger entry
    tx_id = f"tx_{uuid.uuid4().hex[:10]}"
    await db.points_transactions.insert_one(
        {
            "id": tx_id,
            "user_id": user_id,
            "amount": DAILY_PRIZE_POINTS,
            "type": "leaderboard_award",
            "source": PRIZE_SOURCE,
            "reason": f"Nightly Crown – #1 on {day_key}",
            "day_key": day_key,
            "created_at": now_utc.isoformat(),
        }
    )

    # 3) Winner history
    winner_doc = {
        "id": f"lbw_{uuid.uuid4().hex[:10]}",
        "day_key": day_key,
        "user_id": user_id,
        "display_name": display_name,
        "points_balance_at_win": leader.get("points_balance", 0),
        "amount": DAILY_PRIZE_POINTS,
        "transaction_id": tx_id,
        "awarded_at": now_utc,
    }
    await db.leaderboard_winners.insert_one(winner_doc)

    # 4) In-app notification
    try:
        await db.notifications.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "type": "leaderboard_winner",
                "title": "👑 You won the Nightly Crown!",
                "message": (
                    f"You finished #1 on the leaderboard. "
                    f"+{DAILY_PRIZE_POINTS} points have been added to your balance."
                ),
                "data": {
                    "amount": DAILY_PRIZE_POINTS,
                    "day_key": day_key,
                    "screen": "leaderboard",
                },
                "priority": "high",
                "read": False,
                "created_at": now_utc,
            }
        )
    except Exception as e:  # pragma: no cover
        logger.warning("Failed to create winner notification: %s", e)

    # 5) Push notification (best-effort)
    try:
        from routes.shared import send_push_notification_to_token  # lazy import
        for token in leader.get("push_tokens", []) or []:
            try:
                await send_push_notification_to_token(
                    token=token,
                    title="👑 Nightly Crown Winner!",
                    body=(
                        f"You topped the leaderboard at midnight. "
                        f"+{DAILY_PRIZE_POINTS} points added to your wallet."
                    ),
                    data={
                        "type": "leaderboard_winner",
                        "amount": DAILY_PRIZE_POINTS,
                        "day_key": day_key,
                        "screen": "leaderboard",
                    },
                )
            except Exception as e:  # pragma: no cover
                logger.warning("Winner push failed for token=%s: %s", token, e)
    except Exception as e:  # pragma: no cover
        logger.warning("Winner push notifications skipped: %s", e)

    # 6) Job run record
    try:
        await db.scheduled_job_runs.insert_one(
            {
                "job_name": "daily_leaderboard_winner",
                "day_key": day_key,
                "completed_at": now_utc,
                "status": "completed",
                "results": {
                    "user_id": user_id,
                    "amount": DAILY_PRIZE_POINTS,
                    "points_balance_at_win": leader.get("points_balance", 0),
                },
            }
        )
    except Exception:  # pragma: no cover
        pass

    logger.info(
        "Awarded Nightly Crown: day=%s user=%s (+%s pts)",
        day_key,
        user_id,
        DAILY_PRIZE_POINTS,
    )

    return {
        "success": True,
        "day_key": day_key,
        "winner": {
            "user_id": user_id,
            "display_name": display_name,
            "amount": DAILY_PRIZE_POINTS,
            "points_balance_at_win": leader.get("points_balance", 0),
        },
    }
