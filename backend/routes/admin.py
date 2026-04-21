"""
Admin Routes - Administrative endpoints for seeding and management
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import logging
import uuid

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/admin", tags=["admin"])
logger = logging.getLogger(__name__)


# ====== PYDANTIC MODELS ======

class MissionCreate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None  # Lovable sends 'name'
    description: str = ""
    points: Optional[int] = None
    points_reward: Optional[int] = None  # Lovable sends 'points_reward'
    icon: str = "trophy"
    color: Optional[str] = None
    type: str = "daily"  # daily, weekly, special
    venue_id: Optional[str] = None
    target_value: Optional[int] = None
    requirement_value: Optional[int] = None  # Lovable sends 'requirement_value'
    is_active: bool = True
    status: Optional[str] = None

class MissionUpdate(BaseModel):
    title: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    points: Optional[int] = None
    points_reward: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    type: Optional[str] = None
    venue_id: Optional[str] = None
    target_value: Optional[int] = None
    requirement_value: Optional[int] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None

class RewardCreate(BaseModel):
    name: str
    description: str = ""
    points_cost: Optional[int] = None
    points: Optional[int] = None  # Lovable may send 'points'
    icon: str = "gift"
    category: str = "general"
    venue_restriction: Optional[str] = None
    venue_id: Optional[str] = None
    quantity_available: int = -1  # -1 = unlimited
    is_active: bool = True
    status: Optional[str] = None
    image_url: Optional[str] = None

class RewardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    points_cost: Optional[int] = None
    points: Optional[int] = None
    icon: Optional[str] = None
    category: Optional[str] = None
    venue_restriction: Optional[str] = None
    venue_id: Optional[str] = None
    quantity_available: Optional[int] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None
    image_url: Optional[str] = None

class BoostCreate(BaseModel):
    name: str
    title: Optional[str] = None
    description: str = ""
    type: str = "points_multiplier"  # points_multiplier, bonus_points, free_item
    multiplier: Optional[float] = None
    bonus_amount: Optional[int] = None
    venue_id: Optional[str] = None
    venue_ids: Optional[List[str]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_hours: Optional[int] = None
    icon: str = "flash"
    color: Optional[str] = None
    is_active: bool = True
    conditions: Optional[str] = None

class BoostUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    multiplier: Optional[float] = None
    bonus_amount: Optional[int] = None
    venue_id: Optional[str] = None
    venue_ids: Optional[List[str]] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration_hours: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    conditions: Optional[str] = None
    status: Optional[str] = None

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
    """Verify admin access.
    Accepts EITHER:
      (a) a JWT Bearer token whose user has role in {admin, staff, manager}, OR
      (b) a static `X-Luna-Hub-Key` header equal to env LUNA_HUB_API_KEY
         — used by the external Lovable admin portal for server-to-server CRUD.
    """
    import os
    # Option B — Lovable Hub API key header (server-to-server)
    hub_key = request.headers.get("X-Luna-Hub-Key") or request.headers.get("x-luna-hub-key")
    expected = os.environ.get("LUNA_HUB_API_KEY", "")
    if hub_key and expected and hub_key == expected:
        return {"user_id": "luna_hub", "role": "admin", "via": "hub_key"}

    # Option A — user JWT
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
    
    title = mission.title or mission.name or "Untitled Mission"
    points = mission.points if mission.points is not None else (mission.points_reward or 0)
    target = mission.target_value if mission.target_value is not None else (mission.requirement_value or 1)
    
    mission_data = {
        "id": f"mission_{uuid.uuid4().hex[:8]}",
        "title": title,
        "name": title,
        "description": mission.description,
        "points": points,
        "points_reward": points,
        "icon": mission.icon,
        "color": mission.color or "#2563EB",
        "type": mission.type,
        "venue_id": mission.venue_id,
        "target_value": target,
        "requirement_value": target,
        "target": target,
        "is_active": mission.is_active,
        "status": mission.status or ("active" if mission.is_active else "inactive"),
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
    
    points_cost = reward.points_cost if reward.points_cost is not None else (reward.points or 0)
    
    reward_data = {
        "id": f"reward_{uuid.uuid4().hex[:8]}",
        "name": reward.name,
        "description": reward.description,
        "points_cost": points_cost,
        "points": points_cost,
        "icon": reward.icon,
        "category": reward.category,
        "venue_restriction": reward.venue_restriction or reward.venue_id,
        "quantity_available": reward.quantity_available,
        "is_active": reward.is_active,
        "status": reward.status or ("active" if reward.is_active else "inactive"),
        "image_url": reward.image_url,
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


# ====== BOOSTS CRUD ======

@router.get("/boosts")
async def list_boosts(request: Request):
    """List all boosts (admin view)"""
    await require_admin(request)
    boosts = await db.boosts.find({}, {"_id": 0}).to_list(100)
    return {"boosts": boosts, "total": len(boosts)}

@router.post("/boosts")
async def create_boost(request: Request, boost: BoostCreate):
    """Create a new boost"""
    await require_admin(request)
    
    title = boost.name or boost.title or "Untitled Boost"
    
    boost_data = {
        "id": f"boost_{uuid.uuid4().hex[:8]}",
        "name": title,
        "title": title,
        "description": boost.description,
        "type": boost.type,
        "multiplier": boost.multiplier,
        "bonus_amount": boost.bonus_amount,
        "venue_id": boost.venue_id,
        "venue_ids": boost.venue_ids or ([boost.venue_id] if boost.venue_id else []),
        "start_time": boost.start_time,
        "end_time": boost.end_time,
        "duration_hours": boost.duration_hours,
        "icon": boost.icon,
        "color": boost.color or "#8B5CF6",
        "is_active": boost.is_active,
        "conditions": boost.conditions,
        "status": "active" if boost.is_active else "inactive",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.boosts.insert_one(boost_data)
    logger.info(f"Created boost: {boost_data['id']}")
    
    return {"success": True, "boost": {k: v for k, v in boost_data.items() if k != "_id"}}

@router.put("/boosts/{boost_id}")
async def update_boost(request: Request, boost_id: str, boost: BoostUpdate):
    """Update an existing boost"""
    await require_admin(request)
    
    update_data = {k: v for k, v in boost.dict().items() if v is not None}
    if "name" in update_data and "title" not in update_data:
        update_data["title"] = update_data["name"]
    if "title" in update_data and "name" not in update_data:
        update_data["name"] = update_data["title"]
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.boosts.update_one({"id": boost_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Boost not found")
    
    updated = await db.boosts.find_one({"id": boost_id}, {"_id": 0})
    return {"success": True, "boost": updated}

@router.delete("/boosts/{boost_id}")
async def delete_boost(request: Request, boost_id: str):
    """Delete a boost"""
    await require_admin(request)
    
    result = await db.boosts.delete_one({"id": boost_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Boost not found")
    
    return {"success": True, "message": f"Boost {boost_id} deleted"}


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


# ====== GEOFENCE NOTIFICATION MANAGEMENT ======

class GeofenceCreate(BaseModel):
    name: str
    venue_id: str
    latitude: float
    longitude: float
    radius: int = 1000
    cluster: str
    notification_title: str
    notification_body: str
    is_active: bool = True


class GeofenceUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[int] = None
    cluster: Optional[str] = None
    notification_title: Optional[str] = None
    notification_body: Optional[str] = None
    is_active: Optional[bool] = None


class VenueMessageCreate(BaseModel):
    venue_id: str
    time_slot: str  # pre_open, prime, late_night, weekend
    title: str
    body: str


class VenueMessageUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    time_slot: Optional[str] = None
    is_active: Optional[bool] = None


class ClusterMessageCreate(BaseModel):
    cluster: str
    time_slot: str  # pre_open, prime, late_night, weekend
    title: str
    body: str


# ── Geofences CRUD ────────────────────────────────────────────────────────────

@router.get("/geofences")
async def list_geofences(request: Request):
    """List all geofences"""
    await require_admin(request)
    geofences = await db.geofences.find({}, {"_id": 0}).to_list(100)
    return {"geofences": geofences, "total": len(geofences)}


@router.post("/geofences")
async def create_geofence(request: Request, body: GeofenceCreate):
    """Create a new geofence zone"""
    await require_admin(request)
    geofence = {
        "id": f"GEO_{body.venue_id.upper()}_{uuid.uuid4().hex[:4]}",
        **body.dict(),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    await db.geofences.insert_one(geofence)
    return {"success": True, "geofence": {k: v for k, v in geofence.items() if k != "_id"}}


@router.put("/geofences/{geofence_id}")
async def update_geofence(request: Request, geofence_id: str, body: GeofenceUpdate):
    """Update a geofence"""
    await require_admin(request)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc)
    result = await db.geofences.update_one({"id": geofence_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Geofence not found")
    return {"success": True, "message": f"Geofence {geofence_id} updated"}


@router.delete("/geofences/{geofence_id}")
async def delete_geofence(request: Request, geofence_id: str):
    """Delete a geofence"""
    await require_admin(request)
    result = await db.geofences.delete_one({"id": geofence_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Geofence not found")
    return {"success": True, "message": f"Geofence {geofence_id} deleted"}


# ── Venue Push Messages CRUD ─────────────────────────────────────────────────

@router.get("/push-messages")
async def list_push_messages(request: Request, venue_id: Optional[str] = None):
    """List all custom venue push messages (from DB). Falls back to code defaults if empty."""
    await require_admin(request)
    query = {}
    if venue_id:
        query["venue_id"] = venue_id
    messages = await db.venue_push_messages.find(query, {"_id": 0}).to_list(500)
    return {"messages": messages, "total": len(messages)}


@router.post("/push-messages")
async def create_push_message(request: Request, body: VenueMessageCreate):
    """Add a new push notification message for a venue"""
    await require_admin(request)
    msg = {
        "id": f"msg_{uuid.uuid4().hex[:8]}",
        **body.dict(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await db.venue_push_messages.insert_one(msg)
    return {"success": True, "message": {k: v for k, v in msg.items() if k != "_id"}}


@router.put("/push-messages/{message_id}")
async def update_push_message(request: Request, message_id: str, body: VenueMessageUpdate):
    """Update a push notification message"""
    await require_admin(request)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    result = await db.venue_push_messages.update_one({"id": message_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"success": True, "message": f"Message {message_id} updated"}


@router.delete("/push-messages/{message_id}")
async def delete_push_message(request: Request, message_id: str):
    """Delete a push notification message"""
    await require_admin(request)
    result = await db.venue_push_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"success": True, "message": f"Message {message_id} deleted"}


# ── Cluster Push Messages CRUD ───────────────────────────────────────────────

@router.get("/cluster-messages")
async def list_cluster_messages(request: Request, cluster: Optional[str] = None):
    """List all custom cluster push messages"""
    await require_admin(request)
    query = {}
    if cluster:
        query["cluster"] = cluster
    messages = await db.cluster_push_messages.find(query, {"_id": 0}).to_list(200)
    return {"messages": messages, "total": len(messages)}


@router.post("/cluster-messages")
async def create_cluster_message(request: Request, body: ClusterMessageCreate):
    """Add a new cluster push notification message"""
    await require_admin(request)
    msg = {
        "id": f"cmsg_{uuid.uuid4().hex[:8]}",
        **body.dict(),
        "is_active": True,
        "created_at": datetime.now(timezone.utc),
    }
    await db.cluster_push_messages.insert_one(msg)
    return {"success": True, "message": {k: v for k, v in msg.items() if k != "_id"}}


@router.put("/cluster-messages/{message_id}")
async def update_cluster_message(request: Request, message_id: str, body: VenueMessageUpdate):
    """Update a cluster push notification message"""
    await require_admin(request)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    result = await db.cluster_push_messages.update_one({"id": message_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"success": True, "message": f"Message {message_id} updated"}


@router.delete("/cluster-messages/{message_id}")
async def delete_cluster_message(request: Request, message_id: str):
    """Delete a cluster push notification message"""
    await require_admin(request)
    result = await db.cluster_push_messages.delete_one({"id": message_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"success": True, "message": f"Message {message_id} deleted"}


# ── Geofence Analytics ────────────────────────────────────────────────────────

@router.get("/geofence-analytics")
async def get_geofence_analytics(request: Request):
    """Get geofence trigger analytics"""
    await require_admin(request)
    
    pipeline = [
        {"$group": {
            "_id": "$cluster",
            "total_triggers": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"},
            "last_trigger": {"$max": "$triggered_at"},
        }},
        {"$project": {
            "_id": 0,
            "cluster": "$_id",
            "total_triggers": 1,
            "unique_users": {"$size": "$unique_users"},
            "last_trigger": 1,
        }},
        {"$sort": {"total_triggers": -1}},
    ]
    
    stats = await db.geofence_triggers.aggregate(pipeline).to_list(50)
    total = await db.geofence_triggers.count_documents({})
    
    for s in stats:
        if s.get("last_trigger") and hasattr(s["last_trigger"], "isoformat"):
            s["last_trigger"] = s["last_trigger"].isoformat()
    
    return {"stats": stats, "total_triggers": total}



# ====== APP CONFIG (Home page status pill + dynamic text) ======
# Collection: db.app_config  — stores a single doc per `key`.
# Lovable Hub writes; the mobile app reads via the public endpoint.

class StatusPillUpdate(BaseModel):
    open_text: Optional[str] = None       # shown when venue open (default: "LIVE NOW")
    closed_text: Optional[str] = None     # shown when closed (default: "Opens Tonight at 8PM")
    opening_soon_text: Optional[str] = None  # shown between 5-8 PM (default: "Opening Soon")
    force_mode: Optional[str] = None      # optional override: "open" | "closed" | "opening_soon" | None (auto)
    custom_message: Optional[str] = None  # if set, replaces the auto message entirely


class AppConfigUpdate(BaseModel):
    status_pill: Optional[StatusPillUpdate] = None
    hero_announcement: Optional[str] = None   # optional top banner text
    maintenance_mode: Optional[bool] = None
    maintenance_message: Optional[str] = None


DEFAULT_APP_CONFIG = {
    "status_pill": {
        "open_text": "LIVE NOW",
        "closed_text": "Your Premium Nightlife Hub",
        "opening_soon_text": "Your Premium Nightlife Hub",
        "force_mode": None,
        "custom_message": None,
    },
    "hero_announcement": None,
    "maintenance_mode": False,
    "maintenance_message": None,
}


async def _load_app_config() -> dict:
    doc = await db.app_config.find_one({"key": "main"}, {"_id": 0})
    if not doc:
        return DEFAULT_APP_CONFIG.copy()
    # Merge with defaults so missing keys stay populated
    merged = DEFAULT_APP_CONFIG.copy()
    pill = DEFAULT_APP_CONFIG["status_pill"].copy()
    pill.update(doc.get("status_pill") or {})
    merged["status_pill"] = pill
    for k in ("hero_announcement", "maintenance_mode", "maintenance_message"):
        if k in doc:
            merged[k] = doc[k]
    return merged


@router.get("/config")
async def get_app_config_admin(request: Request):
    """Admin view of the app config."""
    await require_admin(request)
    cfg = await _load_app_config()
    return {"config": cfg}


@router.put("/config")
async def update_app_config(request: Request, body: AppConfigUpdate):
    """Partial-update the app config (status pill, announcement, maintenance).
    Use `exclude_unset` so Lovable can explicitly clear a field by passing `null`."""
    await require_admin(request)
    current = await _load_app_config()
    payload = body.model_dump(exclude_unset=True)
    if "status_pill" in payload:
        sp_payload = payload["status_pill"] or {}
        sp = current["status_pill"].copy()
        # Only overwrite fields the caller explicitly included
        for k, v in sp_payload.items():
            sp[k] = v  # v may legitimately be None → clears the field
        current["status_pill"] = sp
    for k in ("hero_announcement", "maintenance_mode", "maintenance_message"):
        if k in payload:
            current[k] = payload[k]
    current["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.app_config.update_one(
        {"key": "main"},
        {"$set": {"key": "main", **current}},
        upsert=True,
    )
    return {"success": True, "config": current}


# ====== MILESTONES CRUD ======
# Backed by db.milestones_custom. If the collection is empty, the mobile app
# falls back to the hardcoded MILESTONES list in routes/milestones.py.

class MilestoneRewardItem(BaseModel):
    id: str
    type: str
    label: str
    description: str = ""


class MilestoneCreate(BaseModel):
    id: str  # e.g. "newbie" / "rising_star" — stable identifier
    title: str
    points_required: int
    icon: str = "trophy"
    color: str = "#D4A832"
    description: str = ""
    rewards: List[MilestoneRewardItem] = []


class MilestoneUpdate(BaseModel):
    title: Optional[str] = None
    points_required: Optional[int] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    rewards: Optional[List[MilestoneRewardItem]] = None


def _default_milestones() -> list:
    from routes.milestones import MILESTONES
    return [m.copy() for m in MILESTONES]


@router.get("/milestones")
async def list_milestones_admin(request: Request):
    """List milestones. Reads from db.milestones_custom, falls back to code defaults."""
    await require_admin(request)
    custom = await db.milestones_custom.find({}, {"_id": 0}).sort("points_required", 1).to_list(100)
    if custom:
        return {"milestones": custom, "total": len(custom), "source": "custom"}
    return {"milestones": _default_milestones(), "total": len(_default_milestones()), "source": "default"}


@router.post("/milestones")
async def create_milestone(request: Request, milestone: MilestoneCreate):
    """Create/override a milestone. If it's the first write, seeds the collection with defaults first."""
    await require_admin(request)

    # Seed defaults on first write so custom edits layer cleanly
    existing_count = await db.milestones_custom.count_documents({})
    if existing_count == 0:
        seeds = _default_milestones()
        for s in seeds:
            s["created_at"] = datetime.now(timezone.utc).isoformat()
        if seeds:
            await db.milestones_custom.insert_many(seeds)

    data = milestone.dict()
    data["rewards"] = [r if isinstance(r, dict) else r.dict() for r in data.get("rewards", [])]
    data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Upsert by id
    await db.milestones_custom.update_one(
        {"id": data["id"]},
        {"$set": data, "$setOnInsert": {"created_at": data["updated_at"]}},
        upsert=True,
    )
    saved = await db.milestones_custom.find_one({"id": data["id"]}, {"_id": 0})
    return {"success": True, "milestone": saved}


@router.put("/milestones/{milestone_id}")
async def update_milestone(request: Request, milestone_id: str, milestone: MilestoneUpdate):
    """Update an existing milestone. Seeds collection on first edit."""
    await require_admin(request)

    existing_count = await db.milestones_custom.count_documents({})
    if existing_count == 0:
        seeds = _default_milestones()
        for s in seeds:
            s["created_at"] = datetime.now(timezone.utc).isoformat()
        if seeds:
            await db.milestones_custom.insert_many(seeds)

    updates = {k: v for k, v in milestone.dict().items() if v is not None}
    if "rewards" in updates:
        updates["rewards"] = [r if isinstance(r, dict) else r.dict() for r in updates["rewards"]]
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.milestones_custom.update_one({"id": milestone_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Milestone not found")
    saved = await db.milestones_custom.find_one({"id": milestone_id}, {"_id": 0})
    return {"success": True, "milestone": saved}


@router.delete("/milestones/{milestone_id}")
async def delete_milestone(request: Request, milestone_id: str):
    """Delete a milestone from the custom overrides."""
    await require_admin(request)
    result = await db.milestones_custom.delete_one({"id": milestone_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Milestone not found")
    return {"success": True, "message": f"Milestone {milestone_id} deleted"}


# ====== BOTTLE IMAGE OVERRIDES ======
# Collection: db.bottle_overrides  — { bottle_id, image_url, updated_at }
# The bottle menu endpoint (routes/bookings.py) merges these overrides when serving menus.

class BottleImageOverride(BaseModel):
    image_url: str


@router.get("/bottles")
async def list_bottles_admin(request: Request, venue_id: Optional[str] = None):
    """List all bottles with their current (potentially overridden) image URLs."""
    await require_admin(request)
    from routes.bookings import BOTTLE_MENUS
    overrides = await db.bottle_overrides.find({}, {"_id": 0}).to_list(500)
    override_map = {o["bottle_id"]: o["image_url"] for o in overrides}

    result = []
    for vid, items in BOTTLE_MENUS.items():
        if venue_id and vid != venue_id:
            continue
        for item in items:
            bottle = item.copy()
            bottle["venue_id"] = vid
            bottle["default_image_url"] = bottle.get("image_url")
            if bottle["id"] in override_map:
                bottle["image_url"] = override_map[bottle["id"]]
                bottle["overridden"] = True
            else:
                bottle["overridden"] = False
            result.append(bottle)
    return {"bottles": result, "total": len(result)}


@router.put("/bottles/{bottle_id}/image")
async def override_bottle_image(request: Request, bottle_id: str, body: BottleImageOverride):
    """Override the image URL for a specific bottle. Lovable portal uploads a URL and passes it here."""
    await require_admin(request)
    from routes.bookings import BOTTLE_MENUS
    all_ids = {item["id"] for items in BOTTLE_MENUS.values() for item in items}
    if bottle_id not in all_ids:
        raise HTTPException(status_code=404, detail="Bottle not found")

    await db.bottle_overrides.update_one(
        {"bottle_id": bottle_id},
        {"$set": {
            "bottle_id": bottle_id,
            "image_url": body.image_url,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"success": True, "bottle_id": bottle_id, "image_url": body.image_url}


@router.delete("/bottles/{bottle_id}/image")
async def clear_bottle_image_override(request: Request, bottle_id: str):
    """Remove the override and revert to the default AI-generated image."""
    await require_admin(request)
    result = await db.bottle_overrides.delete_one({"bottle_id": bottle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No override found for this bottle")
    return {"success": True, "message": f"Override cleared for bottle {bottle_id}"}


# ====== VENUE OVERRIDES ======
# Collection: db.venue_overrides — partial field overrides keyed by venue_id.
# Adds a lightweight way for Lovable to edit venue copy/hours/images without a full re-deploy.

class VenueOverrideUpdate(BaseModel):
    name: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    long_description: Optional[str] = None
    address: Optional[str] = None
    image_url: Optional[str] = None
    hero_image: Optional[str] = None
    logo_url: Optional[str] = None
    operating_hours: Optional[dict] = None
    contact: Optional[dict] = None
    social: Optional[dict] = None
    accent_color: Optional[str] = None
    status: Optional[str] = None
    is_hidden: Optional[bool] = None
    sevenrooms_url: Optional[str] = None  # VIP table booking link
    bottle_menu_url: Optional[str] = None  # Override bottle service menu link


@router.get("/venues")
async def list_venues_admin(request: Request):
    """List all venues with any overrides merged in."""
    await require_admin(request)
    from luna_venues_config import LUNA_VENUES
    overrides = await db.venue_overrides.find({}, {"_id": 0}).to_list(100)
    override_map = {o["venue_id"]: o for o in overrides}

    result = []
    for vid, venue in LUNA_VENUES.items():
        merged = venue.copy()
        if vid in override_map:
            ov = override_map[vid].copy()
            ov.pop("venue_id", None)
            ov.pop("updated_at", None)
            ov.pop("created_at", None)
            merged.update({k: v for k, v in ov.items() if v is not None})
            merged["overridden"] = True
        else:
            merged["overridden"] = False
        result.append(merged)
    return {"venues": result, "total": len(result)}


@router.get("/venues/{venue_id}")
async def get_venue_admin(request: Request, venue_id: str):
    """Get a single venue with overrides merged."""
    await require_admin(request)
    from luna_venues_config import LUNA_VENUES
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    venue = LUNA_VENUES[venue_id].copy()
    override = await db.venue_overrides.find_one({"venue_id": venue_id}, {"_id": 0})
    if override:
        ov = override.copy()
        ov.pop("venue_id", None)
        ov.pop("updated_at", None)
        ov.pop("created_at", None)
        venue.update({k: v for k, v in ov.items() if v is not None})
        venue["overridden"] = True
    else:
        venue["overridden"] = False
    return {"venue": venue}


@router.put("/venues/{venue_id}")
async def update_venue_override(request: Request, venue_id: str, body: VenueOverrideUpdate):
    """Update venue overrides. Partial update — only fields you send are changed."""
    await require_admin(request)
    from luna_venues_config import LUNA_VENUES
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")

    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["venue_id"] = venue_id
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.venue_overrides.update_one(
        {"venue_id": venue_id},
        {"$set": updates, "$setOnInsert": {"created_at": updates["updated_at"]}},
        upsert=True,
    )
    saved = await db.venue_overrides.find_one({"venue_id": venue_id}, {"_id": 0})
    return {"success": True, "venue_override": saved}


@router.delete("/venues/{venue_id}")
async def clear_venue_override(request: Request, venue_id: str):
    """Remove all overrides for a venue, reverting it to baseline config."""
    await require_admin(request)
    result = await db.venue_overrides.delete_one({"venue_id": venue_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No override found for this venue")
    return {"success": True, "message": f"Override cleared for venue {venue_id}"}


# ====== PUBLIC CONFIG ENDPOINT (no auth required) ======
# Mounted as a separate router so it's not under /admin and doesn't require an auth header.

public_router = APIRouter(prefix="/config", tags=["public-config"])


@public_router.get("/public")
async def get_public_config():
    """Public config consumed by the mobile app on every launch/foreground.
    Exposes only safe, display-level data (never secrets)."""
    cfg = await _load_app_config()
    # Only expose the safe subset
    return {
        "status_pill": cfg.get("status_pill", DEFAULT_APP_CONFIG["status_pill"]),
        "hero_announcement": cfg.get("hero_announcement"),
        "maintenance_mode": cfg.get("maintenance_mode", False),
        "maintenance_message": cfg.get("maintenance_message"),
    }


@public_router.get("/announcements")
async def get_public_announcements(in_ticker: Optional[bool] = None):
    """Public read of active announcements. Used by the home-screen ticker + What's New cards."""
    q = {"active": True}
    if in_ticker is not None:
        q["show_in_ticker"] = in_ticker
    items = await db.announcements.find(q, {"_id": 0}).sort(
        [("sort_order", 1), ("created_at", -1)]
    ).to_list(200)

    # If empty, return sensible defaults so the UI isn't blank on first launch
    if not items:
        defaults = [
            {"id": "seed_1", "category": "APP UPDATE", "title": "Eclipse 2nd Birthday — Founders App Launch This Saturday",
             "date": "22 Feb", "active": True, "show_in_ticker": True, "color": "#FFD700", "sort_order": 0},
            {"id": "seed_2", "category": "ARTIST ANNOUNCED", "title": "Venjent (UK) returning May 15",
             "date": "Mar", "active": True, "show_in_ticker": True, "color": "#E31837", "sort_order": 1},
            {"id": "seed_3", "category": "NEWS", "title": "Luna Rewards now live — earn points on every visit",
             "date": "Feb", "active": True, "show_in_ticker": True, "color": "#60A5FA", "sort_order": 2},
            {"id": "seed_4", "category": "ARTIST ANNOUNCED", "title": "Denzel Curry coming soon",
             "date": "TBA", "active": True, "show_in_ticker": True, "color": "#E31837", "sort_order": 3},
        ]
        if in_ticker:
            return {"announcements": [d for d in defaults if d["show_in_ticker"]], "total": 4, "source": "default"}
        return {"announcements": defaults, "total": 4, "source": "default"}
    return {"announcements": items, "total": len(items), "source": "custom"}



# ====== USERS CRUD (Admin user management from Lovable Hub) ======
# Supports: search, role change (admin/manager/staff/artist/user), direct point grant,
# entry-ticket gifting (24h expiry with optional future-dated scheduling).

ALLOWED_ROLES = {"user", "artist", "staff", "manager", "admin"}


class AdminUserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None     # user|artist|staff|manager|admin
    tier: Optional[str] = None     # bronze|silver|gold
    assigned_venue_id: Optional[str] = None  # for staff/manager
    phone: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class GrantPointsRequest(BaseModel):
    amount: int
    reason: str = "Admin grant"
    note: Optional[str] = None


class GiftEntryRequest(BaseModel):
    venue_id: str
    note: Optional[str] = None
    scheduled_for: Optional[str] = None
    # Optional ISO date (YYYY-MM-DD). If set, ticket is valid from that day 00:00 Brisbane
    # time → next day 00:00 Brisbane time. If not set, valid from now → now + 24h.


def _strip_user(u: dict) -> dict:
    out = {k: v for k, v in u.items() if k != "_id"}
    out.pop("password", None)
    out.pop("password_hash", None)
    for dk in ("created_at", "updated_at", "date_of_birth", "last_login"):
        v = out.get(dk)
        if hasattr(v, "isoformat"):
            out[dk] = v.isoformat()
    return out


@router.get("/users")
async def list_users_admin(
    request: Request,
    q: Optional[str] = None,
    role: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
):
    """List users with optional search (matches email or name, case-insensitive) and role filter."""
    await require_admin(request)
    query: dict = {}
    if role:
        query["role"] = role
    if q:
        import re
        regex = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"email": regex}, {"name": regex}]
    total = await db.users.count_documents(query)
    users = await db.users.find(query).sort("created_at", -1).skip(skip).limit(min(limit, 200)).to_list(200)
    return {"users": [_strip_user(u) for u in users], "total": total, "skip": skip, "limit": limit}


@router.get("/users/{user_id}")
async def get_user_admin(request: Request, user_id: str):
    """Get a single user by user_id."""
    await require_admin(request)
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": _strip_user(user)}


@router.put("/users/{user_id}")
async def update_user_admin(request: Request, user_id: str, body: AdminUserUpdate):
    """Update a user's profile fields and role."""
    await require_admin(request)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if "role" in updates:
        if updates["role"] not in ALLOWED_ROLES:
            raise HTTPException(status_code=400, detail=f"role must be one of {sorted(ALLOWED_ROLES)}")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.users.update_one({"user_id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    user = await db.users.find_one({"user_id": user_id})
    return {"success": True, "user": _strip_user(user)}


@router.post("/users/{user_id}/grant-points")
async def grant_points(request: Request, user_id: str, body: GrantPointsRequest):
    """Gift arbitrary points to a user (any role — bypasses the earn-guard).
    Primarily used for allocating points to artists."""
    admin = await require_admin(request)
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.amount == 0:
        raise HTTPException(status_code=400, detail="amount cannot be zero")

    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {
            "points_balance": body.amount,
            # Only count POSITIVE grants toward lifetime earnings; corrections (negative) shouldn't inflate it.
            **({"total_points_earned": body.amount} if body.amount > 0 else {}),
        }}
    )
    tx = {
        "id": f"tx_{uuid.uuid4().hex[:10]}",
        "user_id": user_id,
        "amount": body.amount,
        "type": "admin_grant" if body.amount > 0 else "admin_deduct",
        "source": "admin_grant",
        "reason": body.reason,
        "note": body.note,
        "granted_by": admin.get("user_id", "luna_hub"),
        "granted_via": admin.get("via", "jwt"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.points_transactions.insert_one(tx)
    user_updated = await db.users.find_one({"user_id": user_id}, {"_id": 0, "points_balance": 1, "name": 1})
    return {
        "success": True,
        "new_balance": user_updated.get("points_balance", 0),
        "transaction": {k: v for k, v in tx.items() if k != "_id"},
    }


@router.post("/users/{user_id}/gift-entry")
async def gift_entry_ticket(request: Request, user_id: str, body: GiftEntryRequest):
    """Gift a free-entry QR ticket to a user, valid for 24h.

    - If `scheduled_for` is omitted → valid from now to now + 24h.
    - If `scheduled_for` is an ISO date (YYYY-MM-DD) → valid from that date 00:00 AEST
      to the next day 00:00 AEST (so a full 24-hour window midnight→midnight in Brisbane).
    """
    admin = await require_admin(request)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "name": 1, "email": 1})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    from luna_venues_config import LUNA_VENUES
    if body.venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    venue = LUNA_VENUES[body.venue_id]

    from routes.entry_tickets import _generate_qr

    # Compute validity window
    now = datetime.now(timezone.utc)
    if body.scheduled_for:
        try:
            # Brisbane is UTC+10 year-round (no DST). Midnight Brisbane = 14:00 UTC previous day.
            scheduled_date = datetime.strptime(body.scheduled_for, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="scheduled_for must be YYYY-MM-DD")
        # Reject dates in the past (using Brisbane-local today as cutoff)
        today_brisbane = (datetime.now(timezone.utc) + timedelta(hours=10)).date()
        if scheduled_date.date() < today_brisbane:
            raise HTTPException(status_code=400, detail="scheduled_for cannot be in the past")
        # Midnight (start of day) in Brisbane = YYYY-MM-DD 00:00 AEST = (YYYY-MM-DD - 1) 14:00 UTC
        brisbane_midnight_utc = datetime(
            scheduled_date.year, scheduled_date.month, scheduled_date.day,
            14, 0, 0, tzinfo=timezone.utc
        ) - timedelta(days=1)
        valid_from = brisbane_midnight_utc
        valid_until = brisbane_midnight_utc + timedelta(hours=24)
    else:
        valid_from = now
        valid_until = now + timedelta(hours=24)

    ticket_id = f"ent_{uuid.uuid4().hex[:10]}"
    ticket = {
        "id": ticket_id,
        "user_id": user_id,
        "user_name": user.get("name"),
        "venue_id": body.venue_id,
        "venue_name": venue["name"],
        "qr_code": _generate_qr(ticket_id, user_id),
        "status": "active",
        "valid_from": valid_from.isoformat(),
        "valid_until": valid_until.isoformat(),
        "note": body.note,
        "gifted_by": admin.get("user_id", "luna_hub"),
        "gifted_via": admin.get("via", "jwt"),
        "created_at": now.isoformat(),
    }
    await db.entry_tickets.insert_one(ticket)
    return {"success": True, "ticket": {k: v for k, v in ticket.items() if k != "_id"}}


@router.get("/entry-tickets")
async def list_entry_tickets_admin(
    request: Request,
    user_id: Optional[str] = None,
    venue_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
):
    """List entry tickets (admin view). Filter by user_id / venue_id / status."""
    await require_admin(request)
    query: dict = {}
    if user_id:
        query["user_id"] = user_id
    if venue_id:
        query["venue_id"] = venue_id
    if status:
        query["status"] = status
    tickets = await db.entry_tickets.find(query, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500)).to_list(500)
    return {"tickets": tickets, "total": len(tickets)}


@router.delete("/entry-tickets/{ticket_id}")
async def revoke_entry_ticket(request: Request, ticket_id: str):
    """Revoke an unused entry ticket."""
    await require_admin(request)
    ticket = await db.entry_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.get("status") == "used":
        raise HTTPException(status_code=400, detail="Cannot revoke a used ticket")
    await db.entry_tickets.update_one(
        {"id": ticket_id},
        {"$set": {"status": "revoked", "revoked_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"success": True, "message": f"Ticket {ticket_id} revoked"}


@router.get("/users/{user_id}/points-transactions")
async def get_user_points_history_admin(request: Request, user_id: str, limit: int = 100):
    """View a user's recent points transactions (admin)."""
    await require_admin(request)
    txs = await db.points_transactions.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(min(limit, 500)).to_list(500)
    return {"transactions": txs, "total": len(txs)}


# ====== ANNOUNCEMENTS CRUD (for the home-screen ticker + What's New cards) ======

ANNOUNCEMENT_CATEGORIES = {"APP UPDATE", "ARTIST ANNOUNCED", "NEW VENUE", "EVENT", "NEWS", "PROMO"}


class AnnouncementCreate(BaseModel):
    category: str
    title: str
    body: Optional[str] = None
    date: Optional[str] = None  # ISO date display string
    color: Optional[str] = None  # pill color
    link_url: Optional[str] = None
    active: bool = True
    show_in_ticker: bool = False  # if True, included in the marquee strip
    sort_order: int = 0


class AnnouncementUpdate(BaseModel):
    category: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    date: Optional[str] = None
    color: Optional[str] = None
    link_url: Optional[str] = None
    active: Optional[bool] = None
    show_in_ticker: Optional[bool] = None
    sort_order: Optional[int] = None


@router.get("/announcements")
async def list_announcements_admin(request: Request, active: Optional[bool] = None):
    await require_admin(request)
    q: dict = {}
    if active is not None:
        q["active"] = active
    items = await db.announcements.find(q, {"_id": 0}).sort([("sort_order", 1), ("created_at", -1)]).to_list(500)
    return {"announcements": items, "total": len(items)}


@router.post("/announcements")
async def create_announcement(request: Request, body: AnnouncementCreate):
    admin = await require_admin(request)
    data = body.dict()
    if data["category"] not in ANNOUNCEMENT_CATEGORIES:
        # Allow custom categories but log
        pass
    now_iso = datetime.now(timezone.utc).isoformat()
    data["id"] = f"ann_{uuid.uuid4().hex[:10]}"
    data["created_at"] = now_iso
    data["updated_at"] = now_iso
    data["created_by"] = admin.get("user_id", "luna_hub")
    await db.announcements.insert_one(data)
    return {"success": True, "announcement": {k: v for k, v in data.items() if k != "_id"}}


@router.put("/announcements/{announcement_id}")
async def update_announcement(request: Request, announcement_id: str, body: AnnouncementUpdate):
    await require_admin(request)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.announcements.update_one({"id": announcement_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    saved = await db.announcements.find_one({"id": announcement_id}, {"_id": 0})
    return {"success": True, "announcement": saved}


@router.delete("/announcements/{announcement_id}")
async def delete_announcement(request: Request, announcement_id: str):
    await require_admin(request)
    result = await db.announcements.delete_one({"id": announcement_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return {"success": True, "message": f"Announcement {announcement_id} deleted"}
