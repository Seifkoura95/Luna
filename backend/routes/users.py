"""
Users Routes - User statistics and management
"""
from fastapi import APIRouter, Request, HTTPException
import logging

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])
logger = logging.getLogger(__name__)


@router.get("/stats")
async def get_user_stats(request: Request):
    """Get current user's statistics"""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get checkin count
    checkin_count = await db.checkins.count_documents({"user_id": user_id})
    
    # Get auction wins
    auction_wins = await db.auction_bids.count_documents({
        "user_id": user_id,
        "status": "won"
    })
    
    # Get missions completed
    missions = user.get("missions_completed", [])
    missions_count = len(missions) if isinstance(missions, list) else 0
    
    # Get current streak
    streak = user.get("current_streak", 0)
    
    return {
        "visits": checkin_count,
        "auctions_won": auction_wins,
        "missions_completed": missions_count,
        "current_streak": streak,
        "points": user.get("points", 0),
        "tier": user.get("tier", "bronze"),
        "member_since": user.get("created_at")
    }
