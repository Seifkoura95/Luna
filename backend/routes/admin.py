"""
Admin Routes - Administrative endpoints for seeding and management
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import logging
import uuid

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ====== PYDANTIC MODELS ======

class MissionCreate(BaseModel):
    title: str
    description: str
    points: int
    icon: str = "trophy"
    type: str = "daily"  # daily, weekly, special
    venue_id: Optional[str] = None
    target_value: int = 1
    is_active: bool = True

class MissionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    points: Optional[int] = None
    icon: Optional[str] = None
    type: Optional[str] = None
    venue_id: Optional[str] = None
    target_value: Optional[int] = None
    is_active: Optional[bool] = None

class RewardCreate(BaseModel):
    name: str
    description: str
    points_cost: int
    icon: str = "gift"
    category: str = "general"
    venue_restriction: Optional[str] = None
    quantity_available: int = -1  # -1 = unlimited
    is_active: bool = True

class RewardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    points_cost: Optional[int] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    venue_restriction: Optional[str] = None
    quantity_available: Optional[int] = None
    is_active: Optional[bool] = None

class AuctionCreate(BaseModel):
    title: str
    description: str
    venue_id: str
    venue_name: str
    auction_type: str = "booth"
    starting_bid: float
    min_increment: float = 10
    max_bid_limit: float = 5000
    deposit_required: float = 0
    deposit_rules: str = ""
    image_url: str
    features: List[str] = []
    start_time: str  # ISO format
    end_time: str    # ISO format

class AuctionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    venue_id: Optional[str] = None
    venue_name: Optional[str] = None
    auction_type: Optional[str] = None
    starting_bid: Optional[float] = None
    min_increment: Optional[float] = None
    max_bid_limit: Optional[float] = None
    deposit_required: Optional[float] = None
    deposit_rules: Optional[str] = None
    image_url: Optional[str] = None
    features: Optional[List[str]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    status: Optional[str] = None


async def require_admin(request: Request):
    """Helper to verify admin access"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_data = get_current_user(auth_header)
    user = await db.users.find_one({"user_id": user_data.get("user_id")})
    if not user or user.get("role") not in ["admin", "staff", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


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
    mission_count = await db.missions.count_documents({})
    
    return {
        "users": user_count,
        "events": event_count,
        "auctions": auction_count,
        "rewards": reward_count,
        "missions": mission_count
    }


# ====== MISSIONS CRUD ======

@router.get("/missions")
async def list_missions(request: Request):
    """List all missions (admin view)"""
    await require_admin(request)
    missions = await db.missions.find({}, {"_id": 0}).to_list(100)
    return {"missions": missions, "total": len(missions)}

@router.post("/missions")
async def create_mission(request: Request, mission: MissionCreate):
    """Create a new mission"""
    await require_admin(request)
    
    mission_data = {
        "id": f"mission_{uuid.uuid4().hex[:8]}",
        "title": mission.title,
        "name": mission.title,  # Alias for frontend compatibility
        "description": mission.description,
        "points": mission.points,
        "icon": mission.icon,
        "type": mission.type,
        "venue_id": mission.venue_id,
        "target_value": mission.target_value,
        "is_active": mission.is_active,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.missions.insert_one(mission_data)
    logger.info(f"Created mission: {mission_data['id']}")
    
    return {"success": True, "mission": {k: v for k, v in mission_data.items() if k != "_id"}}

@router.put("/missions/{mission_id}")
async def update_mission(request: Request, mission_id: str, mission: MissionUpdate):
    """Update an existing mission"""
    await require_admin(request)
    
    update_data = {k: v for k, v in mission.dict().items() if v is not None}
    if "title" in update_data:
        update_data["name"] = update_data["title"]  # Keep name in sync
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.missions.update_one({"id": mission_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    updated = await db.missions.find_one({"id": mission_id}, {"_id": 0})
    return {"success": True, "mission": updated}

@router.delete("/missions/{mission_id}")
async def delete_mission(request: Request, mission_id: str):
    """Delete a mission"""
    await require_admin(request)
    
    result = await db.missions.delete_one({"id": mission_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Mission not found")
    
    return {"success": True, "message": f"Mission {mission_id} deleted"}


# ====== REWARDS CRUD ======

@router.get("/rewards")
async def list_rewards_admin(request: Request):
    """List all rewards (admin view)"""
    await require_admin(request)
    rewards = await db.rewards.find({}, {"_id": 0}).to_list(100)
    return {"rewards": rewards, "total": len(rewards)}

@router.post("/rewards")
async def create_reward(request: Request, reward: RewardCreate):
    """Create a new reward"""
    await require_admin(request)
    
    reward_data = {
        "id": f"reward_{uuid.uuid4().hex[:8]}",
        "name": reward.name,
        "description": reward.description,
        "points_cost": reward.points_cost,
        "icon": reward.icon,
        "category": reward.category,
        "venue_restriction": reward.venue_restriction,
        "quantity_available": reward.quantity_available,
        "is_active": reward.is_active,
        "redemption_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.rewards.insert_one(reward_data)
    logger.info(f"Created reward: {reward_data['id']}")
    
    return {"success": True, "reward": {k: v for k, v in reward_data.items() if k != "_id"}}

@router.put("/rewards/{reward_id}")
async def update_reward(request: Request, reward_id: str, reward: RewardUpdate):
    """Update an existing reward"""
    await require_admin(request)
    
    update_data = {k: v for k, v in reward.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.rewards.update_one({"id": reward_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    updated = await db.rewards.find_one({"id": reward_id}, {"_id": 0})
    return {"success": True, "reward": updated}

@router.delete("/rewards/{reward_id}")
async def delete_reward(request: Request, reward_id: str):
    """Delete a reward"""
    await require_admin(request)
    
    result = await db.rewards.delete_one({"id": reward_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    return {"success": True, "message": f"Reward {reward_id} deleted"}


# ====== AUCTIONS CRUD ======

@router.get("/auctions")
async def list_auctions_admin(request: Request):
    """List all auctions (admin view)"""
    await require_admin(request)
    auctions = await db.auctions.find({}, {"_id": 0}).to_list(100)
    return {"auctions": auctions, "total": len(auctions)}

@router.post("/auctions")
async def create_auction(request: Request, auction: AuctionCreate):
    """Create a new auction"""
    await require_admin(request)
    
    auction_data = {
        "id": f"auction_{uuid.uuid4().hex[:8]}",
        "title": auction.title,
        "description": auction.description,
        "venue_id": auction.venue_id,
        "venue_name": auction.venue_name,
        "auction_type": auction.auction_type,
        "starting_bid": auction.starting_bid,
        "current_bid": auction.starting_bid,
        "min_increment": auction.min_increment,
        "max_bid_limit": auction.max_bid_limit,
        "deposit_required": auction.deposit_required,
        "deposit_rules": auction.deposit_rules,
        "image_url": auction.image_url,
        "features": auction.features,
        "start_time": auction.start_time,
        "end_time": auction.end_time,
        "status": "active",
        "winner_id": None,
        "winner_name": None,
        "bid_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auctions.insert_one(auction_data)
    logger.info(f"Created auction: {auction_data['id']}")
    
    return {"success": True, "auction": {k: v for k, v in auction_data.items() if k != "_id"}}

@router.put("/auctions/{auction_id}")
async def update_auction(request: Request, auction_id: str, auction: AuctionUpdate):
    """Update an existing auction"""
    await require_admin(request)
    
    update_data = {k: v for k, v in auction.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.auctions.update_one({"id": auction_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    updated = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    return {"success": True, "auction": updated}

@router.delete("/auctions/{auction_id}")
async def delete_auction(request: Request, auction_id: str):
    """Delete an auction"""
    await require_admin(request)
    
    result = await db.auctions.delete_one({"id": auction_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Also delete related bids
    await db.bids.delete_many({"auction_id": auction_id})
    
    return {"success": True, "message": f"Auction {auction_id} deleted"}
