"""
Milestones & Milestone Reward Tickets
Points-based milestones that unlock one-use QR-code tickets.
Staff scans → ticket consumed → reward fulfilled.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import uuid
import hmac
import hashlib
import logging

from database import db
from utils.auth import get_current_user
from config import SUBSCRIPTION_TIERS

router = APIRouter(prefix="/milestones", tags=["Milestones"])
logger = logging.getLogger(__name__)

QR_SECRET = "luna_milestone_qr_2026"

# ── Milestone Definitions ─────────────────────────────────────────────────────

MILESTONES = [
    {
        "id": "newbie",
        "title": "Newbie",
        "points_required": 0,
        "icon": "person-add",
        "color": "#8B8B8B",
        "description": "Welcome to Luna Group! Your journey starts here.",
        "rewards": [],
    },
    {
        "id": "rising_star",
        "title": "Rising Star",
        "points_required": 500,
        "icon": "trending-up",
        "color": "#10B981",
        "description": "You're making moves! Enjoy 5 free drinks on us.",
        "rewards": [
            {"id": "rs_drink_1", "type": "free_drink", "label": "Free Drink 1/5", "description": "Redeem for any house drink"},
            {"id": "rs_drink_2", "type": "free_drink", "label": "Free Drink 2/5", "description": "Redeem for any house drink"},
            {"id": "rs_drink_3", "type": "free_drink", "label": "Free Drink 3/5", "description": "Redeem for any house drink"},
            {"id": "rs_drink_4", "type": "free_drink", "label": "Free Drink 4/5", "description": "Redeem for any house drink"},
            {"id": "rs_drink_5", "type": "free_drink", "label": "Free Drink 5/5", "description": "Redeem for any house drink"},
        ],
    },
    {
        "id": "vip_status",
        "title": "VIP Status",
        "points_required": 1000,
        "icon": "flash",
        "color": "#2563EB",
        "description": "You've hit VIP. 10 free drinks and 4 free entries!",
        "rewards": [
            *[{"id": f"vip_drink_{i}", "type": "free_drink", "label": f"Free Drink {i}/10", "description": "Redeem for any house drink"} for i in range(1, 11)],
            *[{"id": f"vip_entry_{i}", "type": "free_entry", "label": f"Free Entry {i}/4", "description": "Free entry to any Luna venue"} for i in range(1, 5)],
        ],
    },
    {
        "id": "luna_elite",
        "title": "Luna Elite",
        "points_required": 5000,
        "icon": "diamond",
        "color": "#D4A832",
        "description": "Elite status unlocked. Free VIP booth, 20 drinks, and 5 entries.",
        "rewards": [
            {"id": "elite_booth", "type": "free_vip_booth", "label": "Free VIP Booth", "description": "One free VIP booth reservation at any venue"},
            *[{"id": f"elite_drink_{i}", "type": "free_drink", "label": f"Free Drink {i}/20", "description": "Redeem for any house drink"} for i in range(1, 21)],
            *[{"id": f"elite_entry_{i}", "type": "free_entry", "label": f"Free Entry {i}/5", "description": "Free entry to any Luna venue"} for i in range(1, 6)],
        ],
    },
    {
        "id": "supernova",
        "title": "Supernova",
        "points_required": 10000,
        "icon": "star",
        "color": "#F59E0B",
        "description": "Supernova status! Free VIP booth, 30 drinks, 5 entries, 5 express entries, and a DJ shoutout.",
        "rewards": [
            {"id": "sn_booth", "type": "free_vip_booth", "label": "Free VIP Booth", "description": "One free VIP booth reservation at any venue"},
            *[{"id": f"sn_drink_{i}", "type": "free_drink", "label": f"Free Drink {i}/30", "description": "Redeem for any house drink"} for i in range(1, 31)],
            *[{"id": f"sn_entry_{i}", "type": "free_entry", "label": f"Free Entry {i}/5", "description": "Free entry to any Luna venue"} for i in range(1, 6)],
            *[{"id": f"sn_express_{i}", "type": "express_entry", "label": f"Express Entry {i}/5", "description": "Skip the line at any venue, any time"} for i in range(1, 6)],
            {"id": "sn_shoutout", "type": "dj_shoutout", "label": "DJ Shoutout", "description": "Get a personal DJ shoutout at any Luna nightclub"},
        ],
    },
    {
        "id": "legend",
        "title": "Legend",
        "points_required": 25000,
        "icon": "trophy",
        "color": "#F0C850",
        "description": "Ultimate Legend status. Gold VIP, unlimited entries, 1 booth with bottle, 50 drinks, 10 giftable entries.",
        "rewards": [
            {"id": "leg_gold_status", "type": "gold_upgrade", "label": "Ultimate Gold Status", "description": "Free Gold membership upgrade for 3 months"},
            {"id": "leg_booth_bottle", "type": "booth_with_bottle", "label": "VIP Booth + Bottle", "description": "One VIP booth with a premium bottle at any venue"},
            *[{"id": f"leg_drink_{i}", "type": "free_drink", "label": f"Free Drink {i}/50", "description": "Redeem for any house drink"} for i in range(1, 51)],
            *[{"id": f"leg_gift_entry_{i}", "type": "giftable_entry", "label": f"Giftable Entry {i}/10", "description": "Free entry ticket you can give to a friend"} for i in range(1, 11)],
        ],
    },
]


def _generate_ticket_qr(ticket_id: str, user_id: str) -> str:
    """Generate a secure one-time QR code for a milestone ticket"""
    data = f"LUNA-TICKET:{ticket_id}:{user_id}"
    sig = hmac.new(QR_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()[:10]
    return f"LUNA-TKT-{ticket_id[:8].upper()}-{sig.upper()}"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def get_milestones(request: Request):
    """Get all milestones with user progress and claimed/unclaimed ticket counts"""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "points_balance": 1})
    pts = user.get("points_balance", 0) if user else 0

    # Get user's claimed milestones
    claims = await db.milestone_claims.find(
        {"user_id": current["user_id"]}, {"_id": 0}
    ).to_list(100)
    claimed_ids = {c["milestone_id"] for c in claims}

    # Get active (unused) tickets count per milestone
    tickets = await db.milestone_tickets.find(
        {"user_id": current["user_id"], "status": "active"}, {"_id": 0, "milestone_id": 1}
    ).to_list(500)
    ticket_counts: dict = {}
    for t in tickets:
        mid = t["milestone_id"]
        ticket_counts[mid] = ticket_counts.get(mid, 0) + 1

    # Load custom milestones from DB if present; else fall back to hardcoded list
    custom = await db.milestones_custom.find({}, {"_id": 0}).sort("points_required", 1).to_list(100)
    source = custom if custom else MILESTONES

    result = []
    for m in source:
        unlocked = pts >= m["points_required"]
        claimed = m["id"] in claimed_ids
        active_tickets = ticket_counts.get(m["id"], 0)
        total_rewards = len(m.get("rewards", []))

        result.append({
            "id": m["id"],
            "title": m["title"],
            "points_required": m["points_required"],
            "icon": m.get("icon", "trophy"),
            "color": m.get("color", "#D4A832"),
            "description": m.get("description", ""),
            "total_rewards": total_rewards,
            "reward_summary": _reward_summary(m.get("rewards", [])),
            "unlocked": unlocked,
            "claimed": claimed,
            "active_tickets": active_tickets,
            "progress": min(1.0, pts / m["points_required"]) if m["points_required"] > 0 else 1.0,
        })

    return {"milestones": result, "points_balance": pts}


def _reward_summary(rewards: list) -> str:
    """Generate a short summary string like '5 Drinks + 4 Entries'"""
    counts: dict = {}
    type_labels = {
        "free_drink": "Drinks",
        "free_entry": "Entries",
        "express_entry": "Express Entries",
        "free_vip_booth": "VIP Booth",
        "dj_shoutout": "DJ Shoutout",
        "gold_upgrade": "Gold Status",
        "booth_with_bottle": "Booth + Bottle",
        "giftable_entry": "Giftable Entries",
    }
    for r in rewards:
        label = type_labels.get(r["type"], r["type"])
        counts[label] = counts.get(label, 0) + 1
    parts = []
    for label, count in counts.items():
        if count > 1 and label not in ("VIP Booth", "DJ Shoutout", "Gold Status", "Booth + Bottle"):
            parts.append(f"{count} {label}")
        else:
            parts.append(label)
    return " + ".join(parts)


@router.post("/claim/{milestone_id}")
async def claim_milestone(request: Request, milestone_id: str):
    """
    Claim a milestone. Generates one-use QR tickets for each reward.
    User must have enough points (lifetime earned, not deducted).
    """
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    milestone = next((m for m in MILESTONES if m["id"] == milestone_id), None)
    if not milestone:
        raise HTTPException(status_code=404, detail="Milestone not found")

    user = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0, "points_balance": 1})
    pts = user.get("points_balance", 0) if user else 0

    if pts < milestone["points_required"]:
        raise HTTPException(status_code=400, detail=f"Need {milestone['points_required']} points. You have {pts}.")

    # Check if already claimed
    existing = await db.milestone_claims.find_one({
        "user_id": current["user_id"],
        "milestone_id": milestone_id,
    })
    if existing:
        raise HTTPException(status_code=400, detail="Milestone already claimed")

    # Record the claim
    await db.milestone_claims.insert_one({
        "user_id": current["user_id"],
        "milestone_id": milestone_id,
        "claimed_at": datetime.now(timezone.utc).isoformat(),
    })

    # Generate tickets
    tickets = []
    for reward in milestone["rewards"]:
        ticket_id = f"tkt_{uuid.uuid4().hex[:10]}"
        qr_code = _generate_ticket_qr(ticket_id, current["user_id"])
        ticket = {
            "ticket_id": ticket_id,
            "user_id": current["user_id"],
            "milestone_id": milestone_id,
            "milestone_title": milestone["title"],
            "reward_id": reward["id"],
            "reward_type": reward["type"],
            "reward_label": reward["label"],
            "reward_description": reward["description"],
            "qr_code": qr_code,
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        tickets.append(ticket)

    if tickets:
        await db.milestone_tickets.insert_many(tickets)

    logger.info(f"Milestone {milestone_id} claimed by {current['user_id']}: {len(tickets)} tickets generated")

    return {
        "success": True,
        "milestone": milestone["title"],
        "tickets_generated": len(tickets),
        "message": f"Congratulations! You've unlocked {milestone['title']}. {len(tickets)} reward tickets added to your wallet.",
    }


@router.get("/tickets")
async def get_my_tickets(request: Request, milestone_id: Optional[str] = None):
    """Get user's active milestone reward tickets"""
    auth = request.headers.get("authorization")
    current = get_current_user(auth)

    query: dict = {"user_id": current["user_id"], "status": "active"}
    if milestone_id:
        query["milestone_id"] = milestone_id

    tickets = await db.milestone_tickets.find(
        query, {"_id": 0}
    ).sort("created_at", -1).to_list(500)

    return {"tickets": tickets, "total": len(tickets)}


@router.post("/tickets/{ticket_id}/use")
async def use_ticket(request: Request, ticket_id: str, venue_id: str = ""):
    """
    Staff uses (validates) a milestone reward ticket.
    The ticket is permanently deleted after use.
    """
    auth = request.headers.get("authorization")
    staff = get_current_user(auth)

    # Verify staff role
    staff_user = await db.users.find_one({"user_id": staff["user_id"]})
    if not staff_user or staff_user.get("role") not in ["admin", "staff", "manager"]:
        raise HTTPException(status_code=403, detail="Staff access required")

    ticket = await db.milestone_tickets.find_one({"ticket_id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found or already used")
    if ticket.get("status") != "active":
        raise HTTPException(status_code=400, detail="Ticket already used")

    # Log usage before deleting
    await db.milestone_ticket_usage.insert_one({
        "ticket_id": ticket_id,
        "user_id": ticket["user_id"],
        "milestone_id": ticket["milestone_id"],
        "reward_type": ticket["reward_type"],
        "reward_label": ticket["reward_label"],
        "venue_id": venue_id,
        "validated_by": staff["user_id"],
        "validated_by_name": staff_user.get("name", staff_user.get("email", "")),
        "used_at": datetime.now(timezone.utc).isoformat(),
    })

    # Delete the ticket permanently
    await db.milestone_tickets.delete_one({"ticket_id": ticket_id})

    logger.info(f"Ticket {ticket_id} used at {venue_id} by staff {staff['user_id']}")

    return {
        "success": True,
        "reward_type": ticket["reward_type"],
        "reward_label": ticket["reward_label"],
        "member_user_id": ticket["user_id"],
        "message": f"Ticket used: {ticket['reward_label']} ({ticket['milestone_title']})",
    }


@router.post("/tickets/validate-qr")
async def validate_ticket_qr(request: Request, qr_code: str, venue_id: str = ""):
    """
    Staff scans a milestone ticket QR code.
    Validates and deletes the ticket in one step.
    """
    auth = request.headers.get("authorization")
    staff = get_current_user(auth)

    staff_user = await db.users.find_one({"user_id": staff["user_id"]})
    if not staff_user or staff_user.get("role") not in ["admin", "staff", "manager"]:
        raise HTTPException(status_code=403, detail="Staff access required")

    ticket = await db.milestone_tickets.find_one({"qr_code": qr_code, "status": "active"})
    if not ticket:
        raise HTTPException(status_code=404, detail="Invalid or already-used ticket QR code")

    # Get member name
    member = await db.users.find_one({"user_id": ticket["user_id"]}, {"_id": 0, "name": 1, "email": 1})

    # Log usage
    await db.milestone_ticket_usage.insert_one({
        "ticket_id": ticket["ticket_id"],
        "user_id": ticket["user_id"],
        "milestone_id": ticket["milestone_id"],
        "reward_type": ticket["reward_type"],
        "reward_label": ticket["reward_label"],
        "venue_id": venue_id,
        "validated_by": staff["user_id"],
        "validated_by_name": staff_user.get("name", staff_user.get("email", "")),
        "used_at": datetime.now(timezone.utc).isoformat(),
    })

    # Delete permanently
    await db.milestone_tickets.delete_one({"ticket_id": ticket["ticket_id"]})

    return {
        "success": True,
        "valid": True,
        "reward_type": ticket["reward_type"],
        "reward_label": ticket["reward_label"],
        "milestone": ticket["milestone_title"],
        "member_name": member.get("name", member.get("email", "")) if member else "Unknown",
        "message": f"Valid! {ticket['reward_label']} for {member.get('name', 'member') if member else 'member'}",
    }
