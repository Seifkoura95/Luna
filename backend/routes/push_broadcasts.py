"""
Push Broadcasts API — Targeted one-shot push notifications
Manages draft/scheduled/sent broadcasts with audience targeting,
Expo Push dispatch, and engagement analytics.
"""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import logging
import httpx

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/admin/push-broadcasts", tags=["Push Broadcasts"])
logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# Tier name mapping (Lovable uses lunar/eclipse/aurora, DB uses bronze/silver/gold)
TIER_MAP = {
    "lunar": "bronze", "bronze": "bronze",
    "eclipse": "silver", "silver": "silver",
    "aurora": "gold", "gold": "gold",
}

VALID_DEEP_LINKS = ["home", "rewards", "auctions", "events", "profile", "wallet", "milestones", "bottle-service", "table-booking", "rewards-shop"]
VALID_STATUSES = ["draft", "scheduled", "sent"]


# ── Models ────────────────────────────────────────────────────────────────────

class BroadcastCreate(BaseModel):
    title: str
    body: str
    deep_link: str = "home"
    audience: str = "all"
    audience_label: Optional[str] = None
    image_url: Optional[str] = None
    status: str = "draft"
    scheduled_for: Optional[str] = None

class BroadcastUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    deep_link: Optional[str] = None
    audience: Optional[str] = None
    audience_label: Optional[str] = None
    image_url: Optional[str] = None
    status: Optional[str] = None
    scheduled_for: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _require_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization")
    if not auth:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_data = get_current_user(auth)
    user = await db.users.find_one({"user_id": user_data["user_id"]})
    if not user or user.get("role") not in ["admin", "staff", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def _resolve_audience(audience: str) -> List[dict]:
    """Resolve audience string to list of users with push tokens.

    Supported patterns:
      - `all` — everyone with at least one token
      - `subscribers` — silver/gold tiers
      - `tier:<name>` — lunar|eclipse|aurora (mapped) or bronze|silver|gold
      - `venue:<venue_id>` — favourited OR visited that venue
      - `user:<email_or_user_id>` — single user (email match first, then user_id)
      - `users:<id1,id2,id3>` — comma-separated user_ids (max 50)
    """
    base_query = {"push_tokens": {"$exists": True, "$ne": []}}

    if audience == "all":
        query = base_query
    elif audience == "subscribers":
        query = {**base_query, "tier": {"$in": ["silver", "gold"]}}
    elif audience.startswith("tier:"):
        tier_name = audience.split(":", 1)[1].strip().lower()
        db_tier = TIER_MAP.get(tier_name, tier_name)
        query = {**base_query, "tier": db_tier}
    elif audience.startswith("venue:"):
        venue_id = audience.split(":", 1)[1].strip()
        query = {**base_query, "$or": [
            {"preferred_venues": venue_id},
            {"visited_venues": venue_id},
        ]}
    elif audience.startswith("user:"):
        ident = audience.split(":", 1)[1].strip()
        # Match by email OR user_id
        query = {**base_query, "$or": [{"email": ident}, {"user_id": ident}]}
    elif audience.startswith("users:"):
        raw_ids = audience.split(":", 1)[1]
        ids = [i.strip() for i in raw_ids.split(",") if i.strip()][:50]
        query = {**base_query, "user_id": {"$in": ids}}
    else:
        query = base_query

    users = await db.users.find(
        query, {"_id": 0, "user_id": 1, "push_tokens": 1, "push_token": 1, "name": 1, "email": 1}
    ).to_list(10000)

    return users


async def _send_expo_push(tokens: List[str], title: str, body: str, data: dict) -> int:
    """Send push notifications via Expo in batches of 100."""
    if not tokens:
        return 0

    sent = 0
    messages = []
    for token in tokens:
        if not token or not token.startswith("ExponentPushToken["):
            continue
        messages.append({
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data,
        })

    # Expo accepts up to 100 per batch
    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(0, len(messages), 100):
            batch = messages[i:i + 100]
            try:
                resp = await client.post(
                    EXPO_PUSH_URL,
                    json=batch,
                    headers={"Content-Type": "application/json"},
                )
                if resp.status_code == 200:
                    sent += len(batch)
                else:
                    logger.error(f"Expo push batch failed: {resp.status_code} {resp.text[:200]}")
            except Exception as e:
                logger.error(f"Expo push error: {e}")

    return sent


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.post("")
async def create_broadcast(request: Request, data: BroadcastCreate):
    """Create a push broadcast (draft, scheduled, or send immediately)."""
    await _require_admin(request)

    if len(data.title) > 50:
        raise HTTPException(status_code=400, detail="Title must be 50 chars or less")
    if len(data.body) > 150:
        raise HTTPException(status_code=400, detail="Body must be 150 chars or less")
    if data.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {VALID_STATUSES}")
    if data.status == "scheduled" and not data.scheduled_for:
        raise HTTPException(status_code=400, detail="scheduled_for is required when status is 'scheduled'")

    now = datetime.now(timezone.utc).isoformat()
    broadcast = {
        "id": str(uuid.uuid4()),
        "title": data.title,
        "body": data.body,
        "deep_link": data.deep_link,
        "audience": data.audience,
        "audience_label": data.audience_label or data.audience,
        "image_url": data.image_url,
        "status": data.status,
        "scheduled_for": data.scheduled_for,
        "sent_at": None,
        "audience_size": 0,
        "opened": 0,
        "clicked": 0,
        "created_at": now,
        "updated_at": now,
    }

    # If status is "sent", dispatch immediately
    if data.status == "sent":
        users = await _resolve_audience(data.audience)
        all_tokens = []
        for u in users:
            all_tokens.extend(u.get("push_tokens", []))
            if u.get("push_token") and u["push_token"] not in all_tokens:
                all_tokens.append(u["push_token"])

        broadcast["audience_size"] = len(users)
        broadcast["sent_at"] = now

        push_data = {"type": "broadcast", "broadcast_id": broadcast["id"], "deep_link": data.deep_link}
        sent_count = await _send_expo_push(all_tokens, data.title, data.body, push_data)
        logger.info(f"Broadcast {broadcast['id']}: sent to {sent_count}/{len(all_tokens)} tokens ({len(users)} users)")

        # Create per-user notification records for tracking
        if users:
            notif_records = []
            for u in users:
                notif_records.append({
                    "notification_id": str(uuid.uuid4()),
                    "broadcast_id": broadcast["id"],
                    "user_id": u["user_id"],
                    "title": data.title,
                    "body": data.body,
                    "deep_link": data.deep_link,
                    "opened": False,
                    "clicked": False,
                    "created_at": now,
                })
            await db.user_notifications.insert_many(notif_records)

    await db.push_broadcasts.insert_one(broadcast)

    return {k: v for k, v in broadcast.items() if k != "_id"}


@router.get("")
async def list_broadcasts(
    request: Request,
    status: Optional[str] = None,
    audience: Optional[str] = None,
    limit: int = 50,
):
    """List push broadcasts, newest first."""
    await _require_admin(request)

    query: dict = {}
    if status:
        query["status"] = status
    if audience:
        query["audience"] = audience

    broadcasts = await db.push_broadcasts.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    total = await db.push_broadcasts.count_documents(query)

    return {"broadcasts": broadcasts, "total": total}


# ── Audience preview + user search (for Lovable UI) ──────────────────────────
# NOTE: These static paths must come BEFORE `/{broadcast_id}` so FastAPI doesn't
# match "audience-preview" or "users-search" as a broadcast ID.

@router.get("/audience-preview")
async def audience_preview(request: Request, audience: str = "all"):
    """Preview how many users an audience string will reach — before sending.

    Returns `{user_count, with_push_token_count, sample_names}`.
    The `user_count` is total users that match the audience filter; the
    `with_push_token_count` is the subset actually reachable via push.
    """
    await _require_admin(request)

    # Same query logic as _resolve_audience but WITHOUT the mandatory push_token filter
    base_query: dict = {}
    if audience == "all":
        base_query = {}
    elif audience == "subscribers":
        base_query = {"tier": {"$in": ["silver", "gold"]}}
    elif audience.startswith("tier:"):
        tier_name = audience.split(":", 1)[1].strip().lower()
        base_query = {"tier": TIER_MAP.get(tier_name, tier_name)}
    elif audience.startswith("venue:"):
        vid = audience.split(":", 1)[1].strip()
        base_query = {"$or": [{"preferred_venues": vid}, {"visited_venues": vid}]}
    elif audience.startswith("user:"):
        ident = audience.split(":", 1)[1].strip()
        base_query = {"$or": [{"email": ident}, {"user_id": ident}]}
    elif audience.startswith("users:"):
        ids = [i.strip() for i in audience.split(":", 1)[1].split(",") if i.strip()][:50]
        base_query = {"user_id": {"$in": ids}}

    # Exclude sample seed users from preview count.
    # Use $and so we don't clobber a pre-existing `user_id` key (e.g. from the `users:` branch).
    sample_exclusion = {"user_id": {"$not": {"$regex": "^sample_user_"}}}
    if "user_id" in base_query or "$or" in base_query or not base_query:
        base_query = {"$and": [base_query, sample_exclusion]} if base_query else sample_exclusion
    else:
        base_query = {**base_query, **sample_exclusion}

    total = await db.users.count_documents(base_query)
    with_tokens = await db.users.count_documents(
        {**base_query, "push_tokens": {"$exists": True, "$ne": []}}
    )
    sample_docs = await db.users.find(
        {**base_query, "push_tokens": {"$exists": True, "$ne": []}},
        {"_id": 0, "name": 1, "email": 1},
    ).limit(5).to_list(5)

    return {
        "audience": audience,
        "user_count": total,
        "with_push_token_count": with_tokens,
        "sample_names": [(d.get("name") or d.get("email") or "anon") for d in sample_docs],
    }


@router.get("/users-search")
async def users_search(request: Request, q: str = "", limit: int = 20):
    """Typeahead search for the individual-user audience picker.

    Matches name / email / phone (case-insensitive). Only returns users who
    have at least one push token so ops don't pick unreachable users.
    """
    await _require_admin(request)
    q = (q or "").strip()
    if len(q) < 2:
        return {"users": []}

    limit = max(1, min(limit, 50))
    import re
    pattern = re.compile(re.escape(q), re.IGNORECASE)
    query = {
        "push_tokens": {"$exists": True, "$ne": []},
        "$or": [{"name": pattern}, {"email": pattern}, {"phone": pattern}],
    }
    docs = await db.users.find(
        query,
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "phone": 1, "picture": 1, "tier": 1},
    ).limit(limit).to_list(limit)
    return {"users": docs, "query": q}


@router.get("/{broadcast_id}")
async def get_broadcast(request: Request, broadcast_id: str):
    """Get a single broadcast by ID."""
    await _require_admin(request)

    bc = await db.push_broadcasts.find_one({"id": broadcast_id}, {"_id": 0})
    if not bc:
        raise HTTPException(status_code=404, detail="Broadcast not found")
    return bc


@router.put("/{broadcast_id}")
async def update_broadcast(request: Request, broadcast_id: str, data: BroadcastUpdate):
    """Update a broadcast. Only allowed for draft/scheduled status."""
    await _require_admin(request)

    bc = await db.push_broadcasts.find_one({"id": broadcast_id})
    if not bc:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    if bc.get("status") == "sent":
        raise HTTPException(status_code=409, detail="Cannot edit a sent broadcast")

    update = {k: v for k, v in data.dict().items() if v is not None}
    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.push_broadcasts.update_one({"id": broadcast_id}, {"$set": update})

    updated = await db.push_broadcasts.find_one({"id": broadcast_id}, {"_id": 0})
    return {"success": True, "broadcast": updated}


@router.delete("/{broadcast_id}")
async def delete_broadcast(request: Request, broadcast_id: str):
    """Delete a broadcast (any status)."""
    await _require_admin(request)

    result = await db.push_broadcasts.delete_one({"id": broadcast_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    # Clean up per-user notifications
    await db.user_notifications.delete_many({"broadcast_id": broadcast_id})

    return Response(status_code=204)


@router.post("/{broadcast_id}/send")
async def send_broadcast(request: Request, broadcast_id: str):
    """Send a draft or scheduled broadcast immediately."""
    await _require_admin(request)

    bc = await db.push_broadcasts.find_one({"id": broadcast_id})
    if not bc:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    if bc.get("status") == "sent":
        raise HTTPException(status_code=409, detail="Broadcast already sent")

    now = datetime.now(timezone.utc).isoformat()

    users = await _resolve_audience(bc["audience"])
    all_tokens = []
    for u in users:
        all_tokens.extend(u.get("push_tokens", []))
        if u.get("push_token") and u["push_token"] not in all_tokens:
            all_tokens.append(u["push_token"])

    push_data = {"type": "broadcast", "broadcast_id": broadcast_id, "deep_link": bc.get("deep_link", "home")}
    sent_count = await _send_expo_push(all_tokens, bc["title"], bc["body"], push_data)
    logger.info(f"Broadcast {broadcast_id}: sent to {sent_count}/{len(all_tokens)} tokens ({len(users)} users)")

    await db.push_broadcasts.update_one(
        {"id": broadcast_id},
        {"$set": {
            "status": "sent",
            "sent_at": now,
            "audience_size": len(users),
            "updated_at": now,
        }},
    )

    # Create per-user notification records
    if users:
        notif_records = []
        for u in users:
            notif_records.append({
                "notification_id": str(uuid.uuid4()),
                "broadcast_id": broadcast_id,
                "user_id": u["user_id"],
                "title": bc["title"],
                "body": bc["body"],
                "deep_link": bc.get("deep_link", "home"),
                "opened": False,
                "clicked": False,
                "created_at": now,
            })
        await db.user_notifications.insert_many(notif_records)

    updated = await db.push_broadcasts.find_one({"id": broadcast_id}, {"_id": 0})
    return updated


# ── Send-test endpoint (admin-only preview to own device) ───────────────────

@router.post("/{broadcast_id}/test")
async def send_test_broadcast(request: Request, broadcast_id: str):
    """Send this broadcast to the calling admin's own device(s) only.

    Does NOT mark the broadcast as sent. Perfect for previewing copy + deep-link
    behaviour before dispatching to the full audience.
    """
    admin_user = await _require_admin(request)

    bc = await db.push_broadcasts.find_one({"id": broadcast_id})
    if not bc:
        raise HTTPException(status_code=404, detail="Broadcast not found")

    tokens = list(admin_user.get("push_tokens") or [])
    if admin_user.get("push_token") and admin_user["push_token"] not in tokens:
        tokens.append(admin_user["push_token"])

    if not tokens:
        raise HTTPException(
            status_code=400,
            detail="Your admin account has no push token registered — install the mobile app + log in to test.",
        )

    sent = await _send_expo_push(
        tokens,
        f"[TEST] {bc['title']}",
        bc["body"],
        {"type": "broadcast_test", "broadcast_id": broadcast_id, "deep_link": bc.get("deep_link", "home")},
    )
    return {"success": True, "tokens_used": len(tokens), "tokens_accepted_by_expo": sent}


# ── Engagement Tracking (called by mobile app) ───────────────────────────────

engagement_router = APIRouter(prefix="/notifications", tags=["Notification Tracking"])


@engagement_router.post("/{notification_id}/track-open")
async def track_open(request: Request, notification_id: str):
    """Mobile app calls this when a push notification is opened."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    notif = await db.user_notifications.find_one({
        "notification_id": notification_id,
        "user_id": current["user_id"],
    })

    if not notif:
        # Try matching by broadcast_id as fallback
        notif = await db.user_notifications.find_one({
            "broadcast_id": notification_id,
            "user_id": current["user_id"],
        })

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notif.get("opened"):
        await db.user_notifications.update_one(
            {"notification_id": notif["notification_id"]},
            {"$set": {"opened": True, "opened_at": datetime.now(timezone.utc).isoformat()}},
        )
        # Increment broadcast-level counter
        if notif.get("broadcast_id"):
            await db.push_broadcasts.update_one(
                {"id": notif["broadcast_id"]},
                {"$inc": {"opened": 1}},
            )

    return {"success": True}


@engagement_router.post("/{notification_id}/track-click")
async def track_click(request: Request, notification_id: str):
    """Mobile app calls this when the deep link from a push is followed."""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    notif = await db.user_notifications.find_one({
        "notification_id": notification_id,
        "user_id": current["user_id"],
    })

    if not notif:
        notif = await db.user_notifications.find_one({
            "broadcast_id": notification_id,
            "user_id": current["user_id"],
        })

    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    if not notif.get("clicked"):
        await db.user_notifications.update_one(
            {"notification_id": notif["notification_id"]},
            {"$set": {"clicked": True, "clicked_at": datetime.now(timezone.utc).isoformat()}},
        )
        if notif.get("broadcast_id"):
            await db.push_broadcasts.update_one(
                {"id": notif["broadcast_id"]},
                {"$inc": {"clicked": 1}},
            )

    return {"success": True}
