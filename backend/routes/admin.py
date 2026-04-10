"""
Admin Routes - Administrative endpoints for seeding and management
"""
from fastapi import APIRouter, Request, HTTPException
import logging

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


@router.post("/seed")
async def seed_data():
    """Seed sample data for development"""
    from seed_data import get_seed_data
    
    seed = get_seed_data()
    
    # Seed events - delete old and insert new
    await db.events.delete_many({})
    if seed.get("events"):
        events_to_insert = []
        for e in seed["events"]:
            event = e.copy()
            events_to_insert.append(event)
        await db.events.insert_many(events_to_insert)
        logger.info(f"Seeded {len(events_to_insert)} events")
    
    # Seed rewards
    if seed.get("rewards"):
        await db.rewards.delete_many({})
        await db.rewards.insert_many(seed["rewards"])
        logger.info(f"Seeded {len(seed['rewards'])} rewards")
    
    # Seed auctions
    if seed.get("auctions"):
        await db.auctions.delete_many({})
        await db.auctions.insert_many(seed["auctions"])
        logger.info(f"Seeded {len(seed['auctions'])} auctions")
    
    return {
        "message": "Data seeding triggered",
        "success": True,
        "seeded": {
            "events": len(seed.get("events", [])),
            "rewards": len(seed.get("rewards", [])),
            "auctions": len(seed.get("auctions", []))
        }
    }


@router.get("/stats")
async def get_admin_stats(request: Request):
    """Get admin dashboard statistics"""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    
    # Get user record to check role
    user = await db.users.find_one({"user_id": user_data.get("user_id")})
    if not user or user.get("role") not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get counts
    user_count = await db.users.count_documents({})
    event_count = await db.events.count_documents({})
    auction_count = await db.auctions.count_documents({})
    reward_count = await db.rewards.count_documents({})
    
    return {
        "users": user_count,
        "events": event_count,
        "auctions": auction_count,
        "rewards": reward_count
    }
