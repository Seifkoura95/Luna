from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import hmac
import hashlib
import secrets
import bcrypt
import jwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# QR Code secret for HMAC
QR_SECRET = os.environ.get('QR_SECRET', 'eclipse-vip-secret-2024')

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'eclipse-jwt-secret-key-2024-super-secure')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = 7

# Create the main app
app = FastAPI(title="Eclipse VIP API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== Models ====================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    tier: str = "bronze"
    points_balance: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CheckIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    venue_room: str = "eclipse"
    check_in_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    points_awarded: int = 100
    boost_id: Optional[str] = None

class Reward(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    points_cost: int
    category: str  # drinks, bottles, vip, merch
    image_url: Optional[str] = None
    is_active: bool = True

class Redemption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    reward_id: str
    reward_name: str
    points_spent: int
    validation_code: str = Field(default_factory=lambda: secrets.token_hex(4).upper())
    status: str = "pending"  # pending, validated, expired
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))

class Mission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    mission_type: str  # check_in_streak, early_bird, spending
    requirement_value: int
    points_reward: int
    is_active: bool = True

class MissionProgress(BaseModel):
    user_id: str
    mission_id: str
    current_value: int = 0
    completed: bool = False
    completed_at: Optional[datetime] = None

class Boost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    multiplier: float = 2.0
    start_time: datetime
    end_time: datetime
    venue_room: str = "eclipse"
    is_active: bool = True

class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    event_date: datetime
    venue_room: str = "eclipse"
    poster_url: Optional[str] = None
    ticket_url: Optional[str] = None
    is_active: bool = True

class PointsTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: int
    transaction_type: str  # earned, spent, bonus
    source: str  # check_in, mission, redemption, boost
    description: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== Auction Models ====================

class Auction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    auction_type: str  # booth_upgrade, fast_lane, bottle_service, vip_experience
    reserve_price: float
    current_bid: float = 0
    bid_increment: float = 5.0
    winner_id: Optional[str] = None
    winner_name: Optional[str] = None
    start_time: datetime
    end_time: datetime
    venue_room: str = "eclipse"
    status: str = "upcoming"  # upcoming, active, ended, claimed
    image_url: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuctionBid(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    auction_id: str
    user_id: str
    user_name: str
    bid_amount: float
    bid_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_winning: bool = False

class AuctionClaim(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    auction_id: str
    user_id: str
    claim_code: str = Field(default_factory=lambda: secrets.token_hex(4).upper())
    status: str = "pending"  # pending, claimed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== Photo Models ====================

class VenuePhoto(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    photo_url: str
    thumbnail_url: Optional[str] = None
    event_id: Optional[str] = None
    event_name: Optional[str] = None
    taken_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    photographer_id: Optional[str] = None
    venue_room: str = "eclipse"
    is_active: bool = True

class PhotoTag(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    photo_id: str
    user_id: str
    status: str = "pending"  # pending, approved, declined, purchased
    purchase_price: float = 5.0
    ai_enhanced: bool = False
    ai_enhance_price: float = 2.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    approved_at: Optional[datetime] = None
    purchased_at: Optional[datetime] = None

class PhotoPurchase(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    photo_ids: List[str]
    total_amount: float
    is_bundle: bool = False
    bundle_discount: float = 0
    payment_status: str = "completed"  # pending, completed, failed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== Auth Helpers ====================

async def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie or Authorization header"""
    # Try cookie first
    session_token = request.cookies.get("session_token")
    if session_token:
        return session_token
    
    # Try Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    
    return None

async def get_current_user(request: Request) -> User:
    """Get current authenticated user"""
    session_token = await get_session_token(request)
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one(
        {"session_token": session_token},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry with timezone awareness
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one(
        {"user_id": session["user_id"]},
        {"_id": 0}
    )
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return User(**user_doc)

async def get_optional_user(request: Request) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

# ==================== Auth Endpoints ====================

class SessionExchangeRequest(BaseModel):
    session_id: str

class SessionDataResponse(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    session_token: str

@api_router.post("/auth/session", response_model=SessionDataResponse)
async def exchange_session(request: SessionExchangeRequest, response: Response):
    """Exchange Emergent session_id for session data and create local session"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session ID")
            
            user_data = resp.json()
    except httpx.RequestError as e:
        logger.error(f"Auth request failed: {e}")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")
    
    # Check if user exists
    existing_user = await db.users.find_one(
        {"email": user_data["email"]},
        {"_id": 0}
    )
    
    if existing_user:
        user_id = existing_user["user_id"]
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": user_data["email"],
            "name": user_data["name"],
            "picture": user_data.get("picture"),
            "tier": "bronze",
            "points_balance": 0,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
        
        # Award welcome bonus
        await db.points_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "amount": 100,
            "transaction_type": "bonus",
            "source": "welcome",
            "description": "Welcome bonus",
            "created_at": datetime.now(timezone.utc)
        })
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"points_balance": 100}}
        )
    
    # Create session
    session_token = user_data.get("session_token", secrets.token_hex(32))
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    return SessionDataResponse(
        user_id=user_id,
        email=user_data["email"],
        name=user_data["name"],
        picture=user_data.get("picture"),
        session_token=session_token
    )

@api_router.get("/auth/me")
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return current_user

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = await get_session_token(request)
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== QR Code & Check-In ====================

def generate_qr_signature(user_id: str, timestamp: int) -> str:
    """Generate HMAC signature for QR code"""
    message = f"{user_id}:{timestamp}"
    return hmac.new(
        QR_SECRET.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()[:16]

def verify_qr_signature(user_id: str, timestamp: int, signature: str) -> bool:
    """Verify QR code signature"""
    expected = generate_qr_signature(user_id, timestamp)
    return hmac.compare_digest(expected, signature)

@api_router.get("/checkin/qr")
async def get_qr_data(current_user: User = Depends(get_current_user)):
    """Generate QR code data for check-in"""
    timestamp = int(datetime.now(timezone.utc).timestamp())
    signature = generate_qr_signature(current_user.user_id, timestamp)
    
    qr_data = f"ECLIPSE:{current_user.user_id}:{timestamp}:{signature}"
    
    return {
        "qr_data": qr_data,
        "user_id": current_user.user_id,
        "timestamp": timestamp,
        "expires_in": 60  # seconds
    }

class CheckInRequest(BaseModel):
    qr_data: str
    venue_room: str = "eclipse"

@api_router.post("/checkin/validate")
async def validate_checkin(request: CheckInRequest):
    """Validate QR code and record check-in (for door staff)"""
    try:
        parts = request.qr_data.split(":")
        if len(parts) != 4 or parts[0] != "ECLIPSE":
            raise HTTPException(status_code=400, detail="Invalid QR format")
        
        _, user_id, timestamp_str, signature = parts
        timestamp = int(timestamp_str)
        
        # Verify signature
        if not verify_qr_signature(user_id, timestamp, signature):
            raise HTTPException(status_code=400, detail="Invalid QR signature")
        
        # Check if QR is expired (60 seconds)
        current_time = int(datetime.now(timezone.utc).timestamp())
        if current_time - timestamp > 60:
            raise HTTPException(status_code=400, detail="QR code expired")
        
        # Get user
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check for active boosts
        now = datetime.now(timezone.utc)
        active_boost = await db.boosts.find_one({
            "is_active": True,
            "venue_room": request.venue_room,
            "start_time": {"$lte": now},
            "end_time": {"$gte": now}
        }, {"_id": 0})
        
        # Calculate points
        base_points = 100
        multiplier = active_boost["multiplier"] if active_boost else 1.0
        tier_bonus = {"bronze": 1.0, "silver": 1.2, "gold": 1.5, "platinum": 2.0, "black": 3.0}
        final_points = int(base_points * multiplier * tier_bonus.get(user["tier"], 1.0))
        
        # Record check-in
        checkin = CheckIn(
            user_id=user_id,
            venue_room=request.venue_room,
            points_awarded=final_points,
            boost_id=active_boost["id"] if active_boost else None
        )
        await db.check_ins.insert_one(checkin.dict())
        
        # Award points
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"points_balance": final_points}}
        )
        
        # Record transaction
        await db.points_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "amount": final_points,
            "transaction_type": "earned",
            "source": "check_in",
            "description": f"Check-in at {request.venue_room}" + (f" (Boost: {active_boost['name']}!)" if active_boost else ""),
            "created_at": datetime.now(timezone.utc)
        })
        
        # Update mission progress
        await update_mission_progress(user_id, "check_in_streak", 1)
        
        # Check if early bird (before 10:30pm)
        if now.hour < 22 or (now.hour == 22 and now.minute < 30):
            await update_mission_progress(user_id, "early_bird", 1)
        
        return {
            "success": True,
            "user_name": user["name"],
            "user_tier": user["tier"],
            "points_awarded": final_points,
            "boost_applied": active_boost["name"] if active_boost else None,
            "new_balance": user["points_balance"] + final_points
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid QR data")

async def update_mission_progress(user_id: str, mission_type: str, increment: int):
    """Update mission progress for a user"""
    missions = await db.missions.find({"mission_type": mission_type, "is_active": True}, {"_id": 0}).to_list(100)
    
    for mission in missions:
        progress = await db.mission_progress.find_one(
            {"user_id": user_id, "mission_id": mission["id"]},
            {"_id": 0}
        )
        
        if progress and progress.get("completed"):
            continue
        
        if not progress:
            progress = {
                "user_id": user_id,
                "mission_id": mission["id"],
                "current_value": 0,
                "completed": False
            }
            await db.mission_progress.insert_one(progress)
        
        new_value = progress["current_value"] + increment
        completed = new_value >= mission["requirement_value"]
        
        update_data = {"current_value": new_value, "completed": completed}
        if completed:
            update_data["completed_at"] = datetime.now(timezone.utc)
            # Award mission points
            await db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"points_balance": mission["points_reward"]}}
            )
            await db.points_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user_id,
                "amount": mission["points_reward"],
                "transaction_type": "bonus",
                "source": "mission",
                "description": f"Mission completed: {mission['name']}",
                "created_at": datetime.now(timezone.utc)
            })
        
        await db.mission_progress.update_one(
            {"user_id": user_id, "mission_id": mission["id"]},
            {"$set": update_data}
        )

# ==================== Rewards ====================

@api_router.get("/rewards", response_model=List[Reward])
async def get_rewards(category: Optional[str] = None):
    """Get available rewards"""
    query = {"is_active": True}
    if category:
        query["category"] = category
    
    rewards = await db.rewards.find(query, {"_id": 0}).to_list(100)
    return [Reward(**r) for r in rewards]

class RedeemRequest(BaseModel):
    reward_id: str

@api_router.post("/rewards/redeem")
async def redeem_reward(request: RedeemRequest, current_user: User = Depends(get_current_user)):
    """Redeem a reward"""
    reward = await db.rewards.find_one({"id": request.reward_id, "is_active": True}, {"_id": 0})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if current_user.points_balance < reward["points_cost"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Create redemption
    redemption = Redemption(
        user_id=current_user.user_id,
        reward_id=reward["id"],
        reward_name=reward["name"],
        points_spent=reward["points_cost"]
    )
    await db.redemptions.insert_one(redemption.dict())
    
    # Deduct points
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"points_balance": -reward["points_cost"]}}
    )
    
    # Record transaction
    await db.points_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "amount": -reward["points_cost"],
        "transaction_type": "spent",
        "source": "redemption",
        "description": f"Redeemed: {reward['name']}",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "redemption_id": redemption.id,
        "validation_code": redemption.validation_code,
        "reward_name": reward["name"],
        "points_spent": reward["points_cost"],
        "new_balance": current_user.points_balance - reward["points_cost"],
        "expires_at": redemption.expires_at.isoformat()
    }

@api_router.get("/rewards/redemptions")
async def get_user_redemptions(current_user: User = Depends(get_current_user)):
    """Get user's redemptions"""
    redemptions = await db.redemptions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return redemptions

# ==================== Missions ====================

@api_router.get("/missions")
async def get_missions(current_user: User = Depends(get_current_user)):
    """Get active missions with user progress"""
    missions = await db.missions.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    result = []
    for mission in missions:
        progress = await db.mission_progress.find_one(
            {"user_id": current_user.user_id, "mission_id": mission["id"]},
            {"_id": 0}
        )
        
        mission_data = {
            **mission,
            "current_value": progress["current_value"] if progress else 0,
            "completed": progress["completed"] if progress else False,
            "completed_at": progress.get("completed_at") if progress else None
        }
        result.append(mission_data)
    
    return result

# ==================== Boosts ====================

@api_router.get("/boosts")
async def get_active_boosts():
    """Get currently active boosts"""
    now = datetime.now(timezone.utc)
    boosts = await db.boosts.find({
        "is_active": True,
        "start_time": {"$lte": now},
        "end_time": {"$gte": now}
    }, {"_id": 0}).to_list(100)
    return boosts

@api_router.get("/boosts/upcoming")
async def get_upcoming_boosts():
    """Get upcoming boosts"""
    now = datetime.now(timezone.utc)
    boosts = await db.boosts.find({
        "is_active": True,
        "start_time": {"$gte": now}
    }, {"_id": 0}).sort("start_time", 1).to_list(100)
    return boosts

# ==================== Events ====================

@api_router.get("/events")
async def get_events():
    """Get upcoming events"""
    now = datetime.now(timezone.utc)
    events = await db.events.find({
        "is_active": True,
        "event_date": {"$gte": now}
    }, {"_id": 0}).sort("event_date", 1).to_list(100)
    return events

# ==================== Points History ====================

@api_router.get("/points/history")
async def get_points_history(current_user: User = Depends(get_current_user), limit: int = 20):
    """Get user's points history"""
    transactions = await db.points_transactions.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return transactions

@api_router.get("/points/stats")
async def get_points_stats(current_user: User = Depends(get_current_user)):
    """Get user's points statistics"""
    # Total earned
    earned_pipeline = [
        {"$match": {"user_id": current_user.user_id, "transaction_type": {"$in": ["earned", "bonus"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    earned_result = await db.points_transactions.aggregate(earned_pipeline).to_list(1)
    total_earned = earned_result[0]["total"] if earned_result else 0
    
    # Total spent
    spent_pipeline = [
        {"$match": {"user_id": current_user.user_id, "transaction_type": "spent"}},
        {"$group": {"_id": None, "total": {"$sum": {"$abs": "$amount"}}}}
    ]
    spent_result = await db.points_transactions.aggregate(spent_pipeline).to_list(1)
    total_spent = spent_result[0]["total"] if spent_result else 0
    
    # Check-in count
    checkin_count = await db.check_ins.count_documents({"user_id": current_user.user_id})
    
    # Missions completed
    missions_completed = await db.mission_progress.count_documents({
        "user_id": current_user.user_id,
        "completed": True
    })
    
    return {
        "current_balance": current_user.points_balance,
        "total_earned": total_earned,
        "total_spent": total_spent,
        "checkin_count": checkin_count,
        "missions_completed": missions_completed,
        "tier": current_user.tier
    }

# ==================== Queue Status (Mock) ====================

@api_router.get("/queue/status")
async def get_queue_status():
    """Get current queue status (mock data)"""
    import random
    statuses = ["low", "medium", "high"]
    weights = [0.4, 0.4, 0.2]  # More likely to be low/medium
    status = random.choices(statuses, weights=weights)[0]
    
    people_inside = random.randint(80, 200)
    queue_length = random.randint(0, 30) if status != "high" else random.randint(20, 50)
    
    return {
        "status": status,
        "people_inside": people_inside,
        "queue_length": queue_length,
        "best_arrival_time": "10:30pm - 11:00pm",
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

# ==================== Membership Tiers (Mock) ====================

MEMBERSHIP_TIERS = {
    "bronze": {"name": "Bronze", "price": 0, "benefits": ["Basic points", "Standard queue", "1.0x multiplier"]},
    "silver": {"name": "Silver", "price": 29, "benefits": ["1 free entry/week", "10% off drinks", "1.2x points", "Early booth booking"]},
    "gold": {"name": "Gold", "price": 79, "benefits": ["Unlimited entry", "20% off drinks", "1.5x points", "Dedicated lane", "1 guest free"]},
    "platinum": {"name": "Platinum", "price": 199, "benefits": ["All Gold benefits", "$100 bottle credit/mo", "Concierge", "Exclusive events", "2.0x points"]},
    "black": {"name": "Black", "price": 499, "benefits": ["All Platinum benefits", "Unlimited everything", "Private events", "3.0x points", "Personal host"]}
}

@api_router.get("/membership/tiers")
async def get_membership_tiers():
    """Get available membership tiers"""
    return MEMBERSHIP_TIERS

class UpgradeTierRequest(BaseModel):
    tier: str

@api_router.post("/membership/upgrade")
async def upgrade_membership(request: UpgradeTierRequest, current_user: User = Depends(get_current_user)):
    """Upgrade membership tier (mock - would integrate with Stripe)"""
    if request.tier not in MEMBERSHIP_TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    tier_order = ["bronze", "silver", "gold", "platinum", "black"]
    current_index = tier_order.index(current_user.tier)
    new_index = tier_order.index(request.tier)
    
    if new_index <= current_index:
        raise HTTPException(status_code=400, detail="Can only upgrade to higher tiers")
    
    # Mock payment success
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$set": {"tier": request.tier}}
    )
    
    # Award upgrade bonus
    bonus_points = (new_index - current_index) * 500
    await db.users.update_one(
        {"user_id": current_user.user_id},
        {"$inc": {"points_balance": bonus_points}}
    )
    
    await db.points_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user.user_id,
        "amount": bonus_points,
        "transaction_type": "bonus",
        "source": "upgrade",
        "description": f"Upgrade bonus: {current_user.tier} → {request.tier}",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "new_tier": request.tier,
        "bonus_points": bonus_points,
        "message": f"Welcome to {MEMBERSHIP_TIERS[request.tier]['name']}!"
    }

# ==================== Admin Endpoints ====================

@api_router.get("/admin/stats")
async def get_admin_stats():
    """Get admin dashboard statistics"""
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    total_users = await db.users.count_documents({})
    today_checkins = await db.check_ins.count_documents({"check_in_time": {"$gte": today_start}})
    total_checkins = await db.check_ins.count_documents({})
    total_redemptions = await db.redemptions.count_documents({})
    active_auctions = await db.auctions.count_documents({"status": "active"})
    total_photos = await db.venue_photos.count_documents({})
    
    # Tier distribution
    tier_pipeline = [
        {"$group": {"_id": "$tier", "count": {"$sum": 1}}}
    ]
    tier_dist = await db.users.aggregate(tier_pipeline).to_list(10)
    tier_distribution = {item["_id"]: item["count"] for item in tier_dist}
    
    return {
        "total_users": total_users,
        "today_checkins": today_checkins,
        "total_checkins": total_checkins,
        "total_redemptions": total_redemptions,
        "active_auctions": active_auctions,
        "total_photos": total_photos,
        "tier_distribution": tier_distribution
    }

# ==================== Live Auctions ====================

@api_router.get("/auctions")
async def get_auctions(status: Optional[str] = None):
    """Get auctions - filter by status (upcoming, active, ended)"""
    now = datetime.now(timezone.utc)
    
    # Auto-update auction statuses
    await db.auctions.update_many(
        {"status": "upcoming", "start_time": {"$lte": now}},
        {"$set": {"status": "active"}}
    )
    await db.auctions.update_many(
        {"status": "active", "end_time": {"$lte": now}},
        {"$set": {"status": "ended"}}
    )
    
    query = {}
    if status:
        query["status"] = status
    else:
        query["status"] = {"$in": ["active", "upcoming"]}
    
    auctions = await db.auctions.find(query, {"_id": 0}).sort("start_time", 1).to_list(50)
    return auctions

@api_router.get("/auctions/{auction_id}")
async def get_auction_detail(auction_id: str):
    """Get single auction with bid history"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Get recent bids
    bids = await db.auction_bids.find(
        {"auction_id": auction_id},
        {"_id": 0}
    ).sort("bid_time", -1).to_list(20)
    
    return {**auction, "recent_bids": bids}

class PlaceBidRequest(BaseModel):
    auction_id: str
    bid_amount: float

@api_router.post("/auctions/bid")
async def place_bid(request: PlaceBidRequest, current_user: User = Depends(get_current_user)):
    """Place a bid on an auction"""
    now = datetime.now(timezone.utc)
    
    # Get auction
    auction = await db.auctions.find_one({"id": request.auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Check auction is active
    if auction["status"] != "active":
        # Check if it should be active
        start_time = auction["start_time"]
        end_time = auction["end_time"]
        if start_time.tzinfo is None:
            start_time = start_time.replace(tzinfo=timezone.utc)
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        
        if now < start_time:
            raise HTTPException(status_code=400, detail="Auction hasn't started yet")
        if now > end_time:
            raise HTTPException(status_code=400, detail="Auction has ended")
        
        # Update status to active
        await db.auctions.update_one({"id": request.auction_id}, {"$set": {"status": "active"}})
    
    # Check bid amount
    min_bid = max(auction["reserve_price"], auction["current_bid"] + auction["bid_increment"])
    if request.bid_amount < min_bid:
        raise HTTPException(status_code=400, detail=f"Minimum bid is ${min_bid:.2f}")
    
    # Mark previous winning bid as not winning
    await db.auction_bids.update_many(
        {"auction_id": request.auction_id, "is_winning": True},
        {"$set": {"is_winning": False}}
    )
    
    # Create new bid
    bid = AuctionBid(
        auction_id=request.auction_id,
        user_id=current_user.user_id,
        user_name=current_user.name,
        bid_amount=request.bid_amount,
        is_winning=True
    )
    await db.auction_bids.insert_one(bid.dict())
    
    # Update auction
    await db.auctions.update_one(
        {"id": request.auction_id},
        {"$set": {
            "current_bid": request.bid_amount,
            "winner_id": current_user.user_id,
            "winner_name": current_user.name
        }}
    )
    
    # Get updated auction
    updated_auction = await db.auctions.find_one({"id": request.auction_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": "Bid placed successfully!",
        "bid_amount": request.bid_amount,
        "auction": updated_auction
    }

@api_router.get("/auctions/user/won")
async def get_user_won_auctions(current_user: User = Depends(get_current_user)):
    """Get auctions won by current user"""
    auctions = await db.auctions.find(
        {"winner_id": current_user.user_id, "status": {"$in": ["ended", "claimed"]}},
        {"_id": 0}
    ).sort("end_time", -1).to_list(20)
    return auctions

@api_router.post("/auctions/{auction_id}/claim")
async def claim_auction_prize(auction_id: str, current_user: User = Depends(get_current_user)):
    """Claim an auction prize - generates claim code"""
    auction = await db.auctions.find_one({"id": auction_id}, {"_id": 0})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction["winner_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="You didn't win this auction")
    
    if auction["status"] == "claimed":
        # Return existing claim
        claim = await db.auction_claims.find_one({"auction_id": auction_id}, {"_id": 0})
        return {"success": True, "claim": claim, "already_claimed": True}
    
    if auction["status"] != "ended":
        raise HTTPException(status_code=400, detail="Auction hasn't ended yet")
    
    # Create claim
    claim = AuctionClaim(
        auction_id=auction_id,
        user_id=current_user.user_id
    )
    await db.auction_claims.insert_one(claim.dict())
    
    # Update auction status
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"status": "claimed"}}
    )
    
    return {
        "success": True,
        "claim": claim.dict(),
        "message": "Show this code to staff to claim your prize!"
    }

# ==================== Photo System ====================

@api_router.get("/photos")
async def get_user_photos(current_user: User = Depends(get_current_user)):
    """Get photos where user is tagged"""
    # Get user's photo tags
    tags = await db.photo_tags.find(
        {"user_id": current_user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get photo details
    photo_ids = [tag["photo_id"] for tag in tags]
    photos = await db.venue_photos.find(
        {"id": {"$in": photo_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Merge tag info with photos
    photo_map = {p["id"]: p for p in photos}
    result = []
    for tag in tags:
        photo = photo_map.get(tag["photo_id"])
        if photo:
            result.append({
                **photo,
                "tag_id": tag["id"],
                "tag_status": tag["status"],
                "purchase_price": tag["purchase_price"],
                "ai_enhanced": tag.get("ai_enhanced", False),
                "approved_at": tag.get("approved_at"),
                "purchased_at": tag.get("purchased_at")
            })
    
    return result

@api_router.get("/photos/pending")
async def get_pending_photos(current_user: User = Depends(get_current_user)):
    """Get photos pending user approval"""
    tags = await db.photo_tags.find(
        {"user_id": current_user.user_id, "status": "pending"},
        {"_id": 0}
    ).to_list(50)
    
    photo_ids = [tag["photo_id"] for tag in tags]
    photos = await db.venue_photos.find(
        {"id": {"$in": photo_ids}},
        {"_id": 0}
    ).to_list(50)
    
    photo_map = {p["id"]: p for p in photos}
    result = []
    for tag in tags:
        photo = photo_map.get(tag["photo_id"])
        if photo:
            result.append({**photo, "tag_id": tag["id"]})
    
    return result

class PhotoApprovalRequest(BaseModel):
    tag_id: str
    approved: bool

@api_router.post("/photos/approve")
async def approve_photo(request: PhotoApprovalRequest, current_user: User = Depends(get_current_user)):
    """Approve or decline a photo tag"""
    tag = await db.photo_tags.find_one({"id": request.tag_id}, {"_id": 0})
    if not tag:
        raise HTTPException(status_code=404, detail="Photo tag not found")
    
    if tag["user_id"] != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not your photo")
    
    new_status = "approved" if request.approved else "declined"
    update_data = {"status": new_status}
    if request.approved:
        update_data["approved_at"] = datetime.now(timezone.utc)
    
    await db.photo_tags.update_one(
        {"id": request.tag_id},
        {"$set": update_data}
    )
    
    return {"success": True, "status": new_status}

class PhotoPurchaseRequest(BaseModel):
    photo_ids: List[str]
    ai_enhance: bool = False

@api_router.post("/photos/purchase")
async def purchase_photos(request: PhotoPurchaseRequest, current_user: User = Depends(get_current_user)):
    """Purchase photos (mock payment)"""
    # Get tags for these photos
    tags = await db.photo_tags.find(
        {
            "photo_id": {"$in": request.photo_ids},
            "user_id": current_user.user_id,
            "status": "approved"
        },
        {"_id": 0}
    ).to_list(50)
    
    if len(tags) == 0:
        raise HTTPException(status_code=400, detail="No approved photos to purchase")
    
    # Calculate price
    base_price = len(tags) * 5.0  # $5 per photo
    ai_price = len(tags) * 2.0 if request.ai_enhance else 0
    
    # Bundle discount: $25 for all if 5+ photos
    is_bundle = len(tags) >= 5
    if is_bundle:
        bundle_price = 25.0
        discount = base_price - bundle_price
        total = bundle_price + ai_price
    else:
        discount = 0
        total = base_price + ai_price
    
    # Create purchase record
    purchase = PhotoPurchase(
        user_id=current_user.user_id,
        photo_ids=request.photo_ids,
        total_amount=total,
        is_bundle=is_bundle,
        bundle_discount=discount
    )
    await db.photo_purchases.insert_one(purchase.dict())
    
    # Update tags to purchased
    await db.photo_tags.update_many(
        {"photo_id": {"$in": request.photo_ids}, "user_id": current_user.user_id},
        {"$set": {
            "status": "purchased",
            "purchased_at": datetime.now(timezone.utc),
            "ai_enhanced": request.ai_enhance
        }}
    )
    
    return {
        "success": True,
        "purchase_id": purchase.id,
        "photos_purchased": len(tags),
        "base_price": base_price,
        "ai_enhancement": ai_price,
        "bundle_discount": discount,
        "total_charged": total,
        "message": "Photos purchased! Check your gallery."
    }

@api_router.get("/photos/purchased")
async def get_purchased_photos(current_user: User = Depends(get_current_user)):
    """Get user's purchased photos"""
    tags = await db.photo_tags.find(
        {"user_id": current_user.user_id, "status": "purchased"},
        {"_id": 0}
    ).to_list(100)
    
    photo_ids = [tag["photo_id"] for tag in tags]
    photos = await db.venue_photos.find(
        {"id": {"$in": photo_ids}},
        {"_id": 0}
    ).to_list(100)
    
    photo_map = {p["id"]: p for p in photos}
    result = []
    for tag in tags:
        photo = photo_map.get(tag["photo_id"])
        if photo:
            result.append({
                **photo,
                "ai_enhanced": tag.get("ai_enhanced", False),
                "purchased_at": tag.get("purchased_at")
            })
    
    return result

@api_router.get("/photos/recap")
async def get_night_recap(current_user: User = Depends(get_current_user)):
    """Get night recap with stats and photos"""
    now = datetime.now(timezone.utc)
    last_24h = now - timedelta(hours=24)
    
    # Get recent check-ins
    checkins = await db.check_ins.find(
        {"user_id": current_user.user_id, "check_in_time": {"$gte": last_24h}},
        {"_id": 0}
    ).to_list(10)
    
    # Get recent points earned
    points_earned = await db.points_transactions.find(
        {
            "user_id": current_user.user_id,
            "created_at": {"$gte": last_24h},
            "transaction_type": {"$in": ["earned", "bonus"]}
        },
        {"_id": 0}
    ).to_list(50)
    total_points = sum(p["amount"] for p in points_earned)
    
    # Get recent photos
    photos = await get_user_photos(current_user)
    recent_photos = []
    for p in photos:
        if p.get("taken_at"):
            taken_at = p["taken_at"]
            if isinstance(taken_at, str):
                try:
                    taken_at = datetime.fromisoformat(str(taken_at).replace("Z", "+00:00"))
                except:
                    continue
            elif taken_at.tzinfo is None:
                taken_at = taken_at.replace(tzinfo=timezone.utc)
            
            if taken_at >= last_24h:
                recent_photos.append(p)
                if len(recent_photos) >= 10:
                    break
    
    return {
        "date": now.date().isoformat(),
        "checkins": len(checkins),
        "points_earned": total_points,
        "photos_count": len(recent_photos),
        "photos": recent_photos[:5],
        "message": f"You earned {total_points} points last night!" if total_points > 0 else "No activity in the last 24 hours"
    }

# Admin endpoints for photos (for photographers)
class TagPhotoRequest(BaseModel):
    photo_url: str
    user_id: str  # From QR scan
    event_id: Optional[str] = None
    event_name: Optional[str] = None

@api_router.post("/admin/photos/tag")
async def tag_photo_to_user(request: TagPhotoRequest):
    """Photographer tags a photo to a user (via QR scan)"""
    # Verify user exists
    user = await db.users.find_one({"user_id": request.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create photo
    photo = VenuePhoto(
        photo_url=request.photo_url,
        event_id=request.event_id,
        event_name=request.event_name
    )
    await db.venue_photos.insert_one(photo.dict())
    
    # Create tag
    tag = PhotoTag(
        photo_id=photo.id,
        user_id=request.user_id
    )
    await db.photo_tags.insert_one(tag.dict())
    
    return {
        "success": True,
        "photo_id": photo.id,
        "tag_id": tag.id,
        "user_name": user["name"]
    }

# ==================== Seed Data ====================

@api_router.post("/admin/seed")
async def seed_data():
    """Seed initial data for rewards, missions, boosts, events"""
    
    # Clear existing data
    await db.rewards.delete_many({})
    await db.missions.delete_many({})
    await db.boosts.delete_many({})
    await db.events.delete_many({})
    
    # Seed Rewards
    rewards = [
        {"id": "r1", "name": "Free House Drink", "description": "Any house spirit with mixer", "points_cost": 500, "category": "drinks", "is_active": True},
        {"id": "r2", "name": "Premium Cocktail", "description": "Choose from our signature cocktails", "points_cost": 800, "category": "drinks", "is_active": True},
        {"id": "r3", "name": "Shot Flight", "description": "3 premium shots of your choice", "points_cost": 1000, "category": "drinks", "is_active": True},
        {"id": "r4", "name": "Bottle of Moet", "description": "750ml Moet & Chandon Champagne", "points_cost": 5000, "category": "bottles", "is_active": True},
        {"id": "r5", "name": "Grey Goose Bottle", "description": "700ml Grey Goose Vodka with mixers", "points_cost": 4000, "category": "bottles", "is_active": True},
        {"id": "r6", "name": "VIP Fast Lane", "description": "Skip the queue + 3 guests", "points_cost": 2000, "category": "vip", "is_active": True},
        {"id": "r7", "name": "Eclipse Cap", "description": "Exclusive Eclipse Brisbane snapback", "points_cost": 1500, "category": "merch", "is_active": True},
        {"id": "r8", "name": "VIP Booth Upgrade", "description": "Upgrade to premium booth location", "points_cost": 3000, "category": "vip", "is_active": True},
    ]
    await db.rewards.insert_many(rewards)
    
    # Seed Missions
    missions = [
        {"id": "m1", "name": "Weekend Warrior", "description": "Check in 3 weekends in a row", "mission_type": "check_in_streak", "requirement_value": 3, "points_reward": 500, "is_active": True},
        {"id": "m2", "name": "Early Bird", "description": "Arrive before 10:30pm 5 times", "mission_type": "early_bird", "requirement_value": 5, "points_reward": 300, "is_active": True},
        {"id": "m3", "name": "Night Owl", "description": "Check in 10 times total", "mission_type": "check_in_streak", "requirement_value": 10, "points_reward": 1000, "is_active": True},
        {"id": "m4", "name": "First Timer", "description": "Complete your first check-in", "mission_type": "check_in_streak", "requirement_value": 1, "points_reward": 100, "is_active": True},
    ]
    await db.missions.insert_many(missions)
    
    # Seed Boosts
    now = datetime.now(timezone.utc)
    boosts = [
        {
            "id": "b1",
            "name": "Happy Hour",
            "description": "Double points on all check-ins!",
            "multiplier": 2.0,
            "start_time": now.replace(hour=22, minute=0),
            "end_time": now.replace(hour=23, minute=0),
            "venue_room": "eclipse",
            "is_active": True
        },
        {
            "id": "b2",
            "name": "Weekend Madness",
            "description": "3x points all weekend!",
            "multiplier": 3.0,
            "start_time": now + timedelta(days=(5 - now.weekday()) % 7),
            "end_time": now + timedelta(days=(6 - now.weekday()) % 7 + 1),
            "venue_room": "eclipse",
            "is_active": True
        },
    ]
    await db.boosts.insert_many(boosts)
    
    # Seed Events
    events = [
        {
            "id": "e1",
            "title": "WINDOW KID (UK)",
            "description": "International DJ performing live",
            "event_date": now + timedelta(days=7),
            "venue_room": "eclipse",
            "ticket_url": "https://megatix.com.au/events/submerge-pres-window-kid-uk",
            "is_active": True
        },
        {
            "id": "e2",
            "title": "LEE ANN ROBERTS + JULIET FOX",
            "description": "Double headline techno night",
            "event_date": now + timedelta(days=14),
            "venue_room": "eclipse",
            "ticket_url": "https://www.eventfinda.com.au",
            "is_active": True
        },
        {
            "id": "e3",
            "title": "SPACE 92",
            "description": "Epic techno experience",
            "event_date": now + timedelta(days=21),
            "venue_room": "eclipse",
            "ticket_url": "https://megatix.com.au",
            "is_active": True
        },
    ]
    await db.events.insert_many(events)
    
    # Seed Auctions
    await db.auctions.delete_many({})
    auctions = [
        {
            "id": "a1",
            "title": "Premium Booth Upgrade",
            "description": "Upgrade to VIP booth #1 with bottle service included",
            "auction_type": "booth_upgrade",
            "reserve_price": 50.0,
            "current_bid": 0,
            "bid_increment": 5.0,
            "winner_id": None,
            "winner_name": None,
            "start_time": now + timedelta(minutes=5),
            "end_time": now + timedelta(minutes=12),
            "venue_room": "eclipse",
            "status": "upcoming",
            "image_url": None,
            "created_at": now
        },
        {
            "id": "a2",
            "title": "Fast Lane Bundle",
            "description": "Skip the queue - you + 3 friends",
            "auction_type": "fast_lane",
            "reserve_price": 30.0,
            "current_bid": 35.0,
            "bid_increment": 5.0,
            "winner_id": None,
            "winner_name": None,
            "start_time": now - timedelta(minutes=2),
            "end_time": now + timedelta(minutes=5),
            "venue_room": "eclipse",
            "status": "active",
            "image_url": None,
            "created_at": now
        },
        {
            "id": "a3",
            "title": "Meet the DJ Experience",
            "description": "Backstage meet & greet with tonight's headliner",
            "auction_type": "vip_experience",
            "reserve_price": 100.0,
            "current_bid": 0,
            "bid_increment": 10.0,
            "winner_id": None,
            "winner_name": None,
            "start_time": now + timedelta(hours=1),
            "end_time": now + timedelta(hours=1, minutes=7),
            "venue_room": "eclipse",
            "status": "upcoming",
            "image_url": None,
            "created_at": now
        },
        {
            "id": "a4",
            "title": "Champagne Tower",
            "description": "Spectacular champagne tower for your booth",
            "auction_type": "bottle_service",
            "reserve_price": 200.0,
            "current_bid": 0,
            "bid_increment": 20.0,
            "winner_id": None,
            "winner_name": None,
            "start_time": now + timedelta(minutes=30),
            "end_time": now + timedelta(minutes=37),
            "venue_room": "eclipse",
            "status": "upcoming",
            "image_url": None,
            "created_at": now
        }
    ]
    await db.auctions.insert_many(auctions)
    
    # Seed Sample Photos (for demo)
    await db.venue_photos.delete_many({})
    sample_photos = [
        {
            "id": "p1",
            "photo_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=200",
            "event_name": "Saturday Night Live",
            "taken_at": now - timedelta(hours=2),
            "venue_room": "eclipse",
            "is_active": True
        },
        {
            "id": "p2",
            "photo_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=200",
            "event_name": "Saturday Night Live",
            "taken_at": now - timedelta(hours=1),
            "venue_room": "eclipse",
            "is_active": True
        },
        {
            "id": "p3",
            "photo_url": "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800",
            "thumbnail_url": "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=200",
            "event_name": "Friday Vibes",
            "taken_at": now - timedelta(days=1),
            "venue_room": "eclipse",
            "is_active": True
        }
    ]
    await db.venue_photos.insert_many(sample_photos)
    
    return {
        "message": "Data seeded successfully", 
        "rewards": len(rewards), 
        "missions": len(missions), 
        "boosts": len(boosts), 
        "events": len(events),
        "auctions": len(auctions),
        "photos": len(sample_photos)
    }

# Include the router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
