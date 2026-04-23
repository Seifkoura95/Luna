"""
Venue Admin — User Analytics
============================
CRUD + analytics for users (list, detail with 360° profile, edit, add points).

All routes are mounted at `/api/venue-admin` (prefix), same as before, so
URL compatibility with mobile + Lovable is preserved.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs

router = APIRouter(prefix="/venue-admin", tags=["Venue Admin — Users"])
logger = logging.getLogger(__name__)


async def _require_venue_role(request: Request, manager_only: bool = False) -> dict:
    current_user = get_current_user(request.headers.get("authorization"))
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    allowed = ["venue_manager", "admin"] if manager_only else ["venue_staff", "venue_manager", "admin"]
    if not user or user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Not authorized")
    return user


@router.get("/users")
async def get_all_users(
    request: Request,
    search: Optional[str] = None,
    tier: Optional[str] = None,
    sort_by: str = "total_spend",
    limit: int = 50,
    offset: int = 0,
):
    """Get all users with full analytics for venue dashboard."""
    await _require_venue_role(request)

    query: dict = {"role": {"$nin": ["venue_staff", "venue_manager", "admin"]}}

    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
        ]
    if tier:
        query["subscription_tier"] = tier

    sort_field_map = {
        "visits": "total_visits",
        "points": "points_balance",
        "created": "created_at",
        "name": "name",
    }
    sort_field = sort_field_map.get(sort_by, "total_spend")

    total = await db.users.count_documents(query)
    users = await db.users.find(
        query, {"hashed_password": 0, "email_verification_token": 0}
    ).sort(sort_field, -1).skip(offset).limit(limit).to_list(limit)

    return {"total": total, "users": clean_mongo_docs(users)}


@router.get("/users/{user_id}")
async def get_user_full_profile(request: Request, user_id: str):
    """Get comprehensive user profile with all analytics."""
    await _require_venue_role(request)

    user = await db.users.find_one(
        {"user_id": user_id},
        {"hashed_password": 0, "email_verification_token": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    spending = await db.spending.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    total_spend = sum(s.get("amount", 0) for s in spending)

    spending_by_category: dict = {}
    for s in spending:
        cat = s.get("category", "other")
        spending_by_category[cat] = spending_by_category.get(cat, 0) + s.get("amount", 0)

    spending_by_venue: dict = {}
    for s in spending:
        v = s.get("venue_id", "unknown")
        spending_by_venue[v] = spending_by_venue.get(v, 0) + s.get("amount", 0)

    redemptions = await db.redemptions.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    points_transactions = await db.points_transactions.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    points_earned = sum(t.get("total_points", 0) for t in points_transactions if t.get("type") == "earn")
    points_spent = sum(abs(t.get("total_points", 0)) for t in points_transactions if t.get("type") == "redeem")

    bookings = await db.bookings.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    guestlist = await db.guestlist.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    bids = await db.bids.find({"user_id": user_id}).sort("timestamp", -1).to_list(50)
    auctions_won = await db.auctions.count_documents({"winner_id": user_id, "status": "ended"})
    tickets = await db.tickets.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    subscription = await db.subscriptions.find_one({"user_id": user_id, "status": "active"})

    venue_visits: dict = {}
    for b in bookings:
        v = b.get("venue_id", "unknown")
        venue_visits[v] = venue_visits.get(v, 0) + 1
    for g in guestlist:
        v = g.get("venue_id", "unknown")
        venue_visits[v] = venue_visits.get(v, 0) + 1
    favorite_venue = max(venue_visits, key=venue_visits.get) if venue_visits else None

    profile = clean_mongo_doc(user)
    profile.update({
        "analytics": {
            "total_spend": total_spend,
            "spending_by_category": spending_by_category,
            "spending_by_venue": spending_by_venue,
            "total_visits": len(bookings) + len(guestlist),
            "favorite_venue": favorite_venue,
            "venue_visit_count": venue_visits,
            "points_earned": points_earned,
            "points_spent": points_spent,
            "total_redemptions": len(redemptions),
            "total_bids": len(bids),
            "auctions_won": auctions_won,
            "tickets_purchased": len(tickets),
        },
        "history": {
            "recent_spending": clean_mongo_docs(spending[:10]),
            "recent_redemptions": clean_mongo_docs(redemptions[:10]),
            "recent_bookings": clean_mongo_docs(bookings[:10]),
            "recent_bids": clean_mongo_docs(bids[:10]),
            "recent_points": clean_mongo_docs(points_transactions[:10]),
        },
        "subscription": clean_mongo_doc(subscription) if subscription else None,
    })
    return profile


@router.put("/users/{user_id}")
async def update_user_profile(request: Request, user_id: str):
    """Update user profile (manager/admin only)."""
    await _require_venue_role(request, manager_only=True)

    body = await request.json()
    allowed_fields = [
        "name", "phone", "date_of_birth", "age", "gender", "address",
        "city", "subscription_tier", "points_balance", "notes",
    ]
    update_data: dict = {"updated_at": datetime.now(timezone.utc)}
    for field in allowed_fields:
        if field in body:
            update_data[field] = body[field]

    if "date_of_birth" in body and body["date_of_birth"]:
        try:
            dob = datetime.strptime(body["date_of_birth"], "%Y-%m-%d")
            today = datetime.now()
            update_data["age"] = today.year - dob.year - (
                (today.month, today.day) < (dob.month, dob.day)
            )
        except Exception:
            pass

    await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    return {"success": True, "message": "User profile updated"}


@router.post("/users/{user_id}/add-points")
async def add_points_to_user(request: Request, user_id: str, points: int, reason: str = "Manual adjustment"):
    """Manually add (or deduct) points for a user (manager/admin only)."""
    admin = await _require_venue_role(request, manager_only=True)

    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.users.update_one({"user_id": user_id}, {"$inc": {"points_balance": points}})
    await db.points_transactions.insert_one({
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "type": "earn" if points > 0 else "deduct",
        "total_points": points,
        "source": "manual_adjustment",
        "description": reason,
        "adjusted_by": admin["user_id"],
        "created_at": datetime.now(timezone.utc),
    })

    updated = await db.users.find_one({"user_id": user_id})
    return {
        "success": True,
        "message": f"Added {points} points to {user.get('name')}",
        "new_balance": updated.get("points_balance", 0),
    }
