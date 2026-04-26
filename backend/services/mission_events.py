"""
Mission event emitter — server-side trigger system for missions.

Replaces the old client-driven /api/missions/progress flow (which was vulnerable
to client-side cheating). Modules across the backend call `emit_mission_event(...)`
when a real, server-verified action happens (purchase, RSVP, bid, etc.). Any
active mission whose `event_type` (and optional filters) match the event will
have its progress incremented atomically.

SUPPORTED EVENT TYPES
─────────────────────
  venue_visit        — user visits a venue (auto-fired by quick-award + geofence
                       check-in). Filter:   { venue_id?: str }
  purchase_amount    — dollars spent. Increment = whole-dollar amount, target =
                       cumulative dollars.   Filter: { venue_id?, category? }
  purchase_count     — number of purchases. Filter: { venue_id?, category? }
  social_share       — story shared to social. Filter: { platform? }
  referral_signup    — referred friend completes signup. No filters.
  event_rsvp         — user RSVPs to an event. Filter: { venue_id? }
  auction_bid        — user places a bid. Filter: { venue_id? }
  consecutive_days   — login/visit streak (separately tracked).

USAGE
─────
    from services.mission_events import emit_mission_event
    await emit_mission_event(
        user_id="...",
        event_type="venue_visit",
        venue_id="eclipse",
        increment=1,                # default 1
    )
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Optional
import logging

from database import db

logger = logging.getLogger(__name__)

# Whitelist of supported event types. Lovable can only register missions with
# one of these — anything else raises 400 at create time.
SUPPORTED_EVENT_TYPES = {
    "venue_visit",
    "purchase_amount",
    "purchase_count",
    "social_share",
    "referral_signup",
    "event_rsvp",
    "auction_bid",
    "consecutive_days",
}


def _matches_filter(mission: dict, payload: dict) -> bool:
    """
    A mission only progresses if every key in its `event_filter` matches the
    payload. Missing keys in the filter are treated as "any value".
    """
    flt = mission.get("event_filter") or {}
    if not flt:
        return True
    for k, v in flt.items():
        if v is None or v == "":
            continue
        if payload.get(k) != v:
            return False
    return True


async def emit_mission_event(
    user_id: str,
    event_type: str,
    *,
    increment: int = 1,
    **payload: Any,
) -> list[dict]:
    """
    Increment progress on every active mission matching this event.

    Returns the list of missions that were COMPLETED (newly crossed their
    target) by this event, so callers can surface a "mission complete!" toast
    or push notification. Already-completed missions are not re-fired.

    The function is best-effort: any DB error is logged and swallowed so that
    the calling code path (e.g. quick-award, RSVP) never fails because of a
    side-channel mission update.
    """
    if event_type not in SUPPORTED_EVENT_TYPES:
        logger.warning(f"emit_mission_event called with unsupported type: {event_type}")
        return []

    try:
        missions = await db.missions.find(
            {"is_active": True, "event_type": event_type},
            {"_id": 0},
        ).to_list(200)
    except Exception as e:
        logger.exception(f"emit_mission_event: failed to load missions ({e})")
        return []

    if not missions:
        return []

    completed: list[dict] = []

    for mission in missions:
        if not _matches_filter(mission, payload):
            continue

        target = int(
            mission.get("requirement_value")
            or mission.get("target_value")
            or mission.get("target")
            or 1
        )

        # Pull current progress for this user / mission
        progress_doc = await db.mission_progress.find_one({
            "user_id": user_id,
            "mission_id": mission["id"],
        })
        if progress_doc and progress_doc.get("completed"):
            continue  # already done — don't double-fire

        prev = int(progress_doc.get("progress", 0)) if progress_doc else 0
        new_progress = prev + max(1, int(increment))
        is_complete = new_progress >= target

        update = {
            "user_id": user_id,
            "mission_id": mission["id"],
            "progress": new_progress,
            "completed": is_complete,
            "claimed": progress_doc.get("claimed", False) if progress_doc else False,
            "updated_at": datetime.now(timezone.utc),
            "last_event": {
                "event_type": event_type,
                "payload": payload,
                "at": datetime.now(timezone.utc),
            },
        }
        if is_complete and not (progress_doc and progress_doc.get("completed")):
            update["completed_at"] = datetime.now(timezone.utc)

        try:
            await db.mission_progress.update_one(
                {"user_id": user_id, "mission_id": mission["id"]},
                {"$set": update},
                upsert=True,
            )
        except Exception as e:
            logger.exception(f"emit_mission_event: failed to update progress ({e})")
            continue

        if is_complete and not (progress_doc and progress_doc.get("completed")):
            completed.append(mission)
            logger.info(
                f"Mission completed: user={user_id} mission={mission['id']} "
                f"event={event_type} payload={payload}"
            )

    return completed
