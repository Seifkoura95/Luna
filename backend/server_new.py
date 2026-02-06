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

# Configuration
QR_SECRET = os.environ.get('QR_SECRET', 'luna-group-secret-2024')
JWT_SECRET = os.environ.get('JWT_SECRET', 'luna-jwt-secret-key-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = 7

# Create the main app
app = FastAPI(title="Luna Group VIP API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== LUNA GROUP VENUES ====================

LUNA_VENUES = {
    "eclipse": {
        "id": "eclipse",
        "name": "Eclipse",
        "type": "nightclub",
        "region": "brisbane",
        "location": "Fortitude Valley, Brisbane",
        "address": "201 Wickham St, Fortitude Valley QLD 4006",
        "coordinates": {"lat": -27.4572, "lng": 153.0347},
        "accent_color": "#E31837",
        "description": "Premium nightclub",
        "features": ["booth_booking", "fast_lane", "auctions", "photos"],
        "points_rate": 1.0,  # 1 point per $1
        "image_url": "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800"
    },
    "after_dark": {
        "id": "after_dark",
        "name": "After Dark",
        "type": "nightclub",
        "region": "brisbane",
        "location": "Fortitude Valley, Brisbane (below Eclipse)",
        "address": "201 Wickham St, Fortitude Valley QLD 4006",
        "coordinates": {"lat": -27.4572, "lng": 153.0347},
        "accent_color": "#8B00FF",
        "description": "R&B/Hip Hop/Afrobeats club",
        "features": ["booth_booking", "fast_lane", "auctions", "photos"],
        "points_rate": 1.0,
        "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800"
    },
    "su_casa_brisbane": {
        "id": "su_casa_brisbane",
        "name": "Su Casa Brisbane",
        "type": "bar",
        "region": "brisbane",
        "location": "Fortitude Valley, Brisbane",
        "address": "123 Brunswick St, Fortitude Valley QLD 4006",
        "coordinates": {"lat": -27.4575, "lng": 153.0350},
        "accent_color": "#FFB800",
        "description": "Rooftop bar & nightlife",
        "features": ["booth_booking", "fast_lane", "auctions"],
        "points_rate": 1.0,
        "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800"
    },
    "su_casa_gold_coast": {
        "id": "su_casa_gold_coast",
        "name": "Su Casa Gold Coast",
        "type": "nightclub",
        "region": "gold_coast",
        "location": "Surfers Paradise, Gold Coast",
        "address": "Orchid Ave, Surfers Paradise QLD 4217",
        "coordinates": {"lat": -28.0023, "lng": 153.4295},
        "accent_color": "#FF6B35",
        "description": "Late-night club",
        "features": ["booth_booking", "fast_lane", "auctions"],
        "points_rate": 1.0,
        "image_url": "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=800"
    },
    "juju": {
        "id": "juju",
        "name": "Juju Mermaid Beach",
        "type": "restaurant",
        "region": "gold_coast",
        "location": "Nobby Beach, Gold Coast",
        "address": "2 Albatross Ave, Mermaid Beach QLD 4218",
        "coordinates": {"lat": -28.0450, "lng": 153.4380},
        "accent_color": "#00D4AA",
        "description": "Restaurant & rooftop bar",
        "features": ["table_booking"],
        "points_rate": 0.5,  # 1 point per $2
        "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"
    },
    "night_market": {
        "id": "night_market",
        "name": "Night Market",
        "type": "restaurant",
        "region": "brisbane",
        "location": "Fortitude Valley, Brisbane",
        "address": "Chinatown Mall, Fortitude Valley QLD 4006",
        "coordinates": {"lat": -27.4580, "lng": 153.0345},
        "accent_color": "#FF4757",
        "description": "Asian-inspired dining",
        "features": ["table_booking"],
        "points_rate": 0.5,
        "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800"
    },
    "ember_and_ash": {
        "id": "ember_and_ash",
        "name": "Ember and Ash",
        "type": "restaurant",
        "region": "brisbane",
        "location": "Brisbane",
        "address": "Brisbane CBD QLD 4000",
        "coordinates": {"lat": -27.4698, "lng": 153.0251},
        "accent_color": "#FFA502",
        "description": "Restaurant, cafe & bar",
        "features": ["table_booking"],
        "points_rate": 0.5,
        "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800"
    }
}

# ==================== Models ====================

class Venue(BaseModel):
    id: str
    name: str
    type: str  # nightclub, restaurant, bar
    region: str  # brisbane, gold_coast
    location: str
    address: str
    coordinates: dict
    accent_color: str
    description: str
    features: List[str]
    points_rate: float
    image_url: str
    status: Optional[str] = "open"  # open, closed, at_capacity

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    tier: str = "bronze"
    points_balance: int = 0
    home_region: Optional[str] = "brisbane"
    favorite_venues: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    cherry_hub_id: Optional[str] = None  # For Cherry Hub integration

class CheckIn(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    venue_id: str
    check_in_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    points_awarded: int = 100
    boost_id: Optional[str] = None

class Reward(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    points_cost: int
    category: str  # drinks, bottles, vip, merch, dining
    venue_restriction: Optional[str] = None  # None = universal, or specific venue_id
    image_url: Optional[str] = None
    is_active: bool = True

class Redemption(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    reward_id: str
    reward_name: str
    points_spent: int
    venue_redeemed: Optional[str] = None
    validation_code: str = Field(default_factory=lambda: secrets.token_hex(4).upper())
    status: str = "pending"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))

class Mission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    mission_type: str  # check_in_streak, early_bird, spending, cross_venue
    requirement_value: int
    points_reward: int
    venue_requirements: Optional[List[str]] = None  # None = any venue, or list of venue_ids
    cross_venue_flag: bool = False
    is_active: bool = True

class Event(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    title: str
    description: str
    event_date: datetime
    ticket_url: Optional[str] = None
    image_url: Optional[str] = None
    featured_artist: Optional[dict] = None  # {"name": "DJ Name", "image": "url", "bio": "..."}

class Boost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    multiplier: float  # 1.5x, 2x, etc.
    start_time: datetime
    end_time: datetime
    venue_restriction: Optional[str] = None  # None = all venues
    eligibility: Optional[str] = "all"  # all, subscribers_only, etc.

class Auction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    title: str
    description: str
    auction_type: str
    reserve_price: float
    instant_win_price: Optional[float] = None
    current_bid: float = 0
    winner_id: Optional[str] = None
    winner_name: Optional[str] = None
    start_time: datetime
    end_time: datetime
    status: str = "upcoming"
    bid_increment: float = 5.0

class Photo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    venue_id: str
    event_id: Optional[str] = None
    photo_url: str
    thumbnail_url: Optional[str] = None
    uploader_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== Cherry Hub Mock Layer ====================

class CherryHubAPI:
    """Mock Cherry Hub integration - replace with real API calls when credentials available"""
    
    @staticmethod
    async def get_member(member_id: str):
        """Get member from Cherry Hub"""
        # Mock: Return from our DB for now
        user = await db.users.find_one({"user_id": member_id})
        return user
    
    @staticmethod
    async def get_points_balance(member_id: str):
        """Get unified points balance"""
        user = await db.users.find_one({"user_id": member_id})
        return user.get("points_balance", 0) if user else 0
    
    @staticmethod
    async def add_points(member_id: str, points: int, venue_id: str, source: str):
        """Add points with venue attribution"""
        # Mock: Update our DB
        await db.users.update_one(
            {"user_id": member_id},
            {"$inc": {"points_balance": points}}
        )
        
        # Log transaction
        await db.points_ledger.insert_one({
            "user_id": member_id,
            "type": "earn",
            "amount": points,
            "venue_id": venue_id,
            "source": source,
            "timestamp": datetime.now(timezone.utc)
        })
    
    @staticmethod
    async def deduct_points(member_id: str, points: int, venue_id: str, source: str):
        """Deduct points with venue attribution"""
        await db.users.update_one(
            {"user_id": member_id},
            {"$inc": {"points_balance": -points}}
        )
        
        await db.points_ledger.insert_one({
            "user_id": member_id,
            "type": "redeem",
            "amount": -points,
            "venue_id": venue_id,
            "source": source,
            "timestamp": datetime.now(timezone.utc)
        })
    
    @staticmethod
    async def get_points_history(member_id: str, venue_id: Optional[str] = None):
        """Get points transaction history"""
        query = {"user_id": member_id}
        if venue_id:
            query["venue_id"] = venue_id
        
        history = await db.points_ledger.find(query).sort("timestamp", -1).limit(50).to_list(50)
        return history

# ==================== Auth Dependencies ====================

def get_current_user(authorization: Optional[str] = None) -> dict:
    """Extract and validate JWT token"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== Venues API ====================

@api_router.get("/venues")
async def get_venues(region: Optional[str] = None):
    """Get all Luna Group venues"""
    venues = list(LUNA_VENUES.values())
    
    if region:
        venues = [v for v in venues if v["region"] == region]
    
    return venues

@api_router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    """Get specific venue details"""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    venue = LUNA_VENUES[venue_id].copy()
    
    # Add dynamic data
    now = datetime.now(timezone.utc)
    hour = now.hour
    
    # Mock capacity status based on time
    if venue["type"] in ["nightclub", "bar"]:
        if 22 <= hour or hour < 3:  # 10pm to 3am
            venue["status"] = "busy"
            venue["queue_status"] = "medium"
        elif 20 <= hour < 22:
            venue["status"] = "open"
            venue["queue_status"] = "low"
        else:
            venue["status"] = "closed"
            venue["queue_status"] = None
    
    return venue

@api_router.get("/venues/{venue_id}/featured")
async def get_venue_featured_content(venue_id: str):
    """Get dynamic featured content for venue (artist, promo, etc)"""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    # Mock featured content - in production, this comes from CMS
    featured = {
        "type": "artist",  # artist, promo, event
        "title": "DJ SODA",
        "subtitle": "Tonight's Headliner",
        "description": "International sensation bringing K-Pop and EDM vibes",
        "image": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800",
        "cta": "View Event"
    }
    
    return featured

# ==================== Auth API ====================

@api_router.post("/auth/register")
async def register(email: EmailStr, password: str, name: str):
    """Register new user"""
    # Check if user exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
    
    # Create user
    user_id = str(uuid.uuid4())
    user = {
        "user_id": user_id,
        "email": email,
        "hashed_password": hashed.decode(),
        "name": name,
        "tier": "bronze",
        "points_balance": 0,
        "home_region": "brisbane",
        "favorite_venues": [],
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user)
    
    # Generate JWT
    token_payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    user_copy = user.copy()
    del user_copy["hashed_password"]
    
    return {"user": user_copy, "token": token}

@api_router.post("/auth/login")
async def login(email: EmailStr, password: str):
    """Login user"""
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not bcrypt.checkpw(password.encode(), user["hashed_password"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate JWT
    token_payload = {
        "user_id": user["user_id"],
        "email": user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    user_copy = user.copy()
    del user_copy["hashed_password"]
    
    return {"user": user_copy, "token": token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    """Get current user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_copy = user.copy()
    if "hashed_password" in user_copy:
        del user_copy["hashed_password"]
    
    return user_copy

# ==================== Tonight Pass API ====================

@api_router.get("/checkin/qr")
async def generate_qr(request: Request, venue_id: str):
    """Generate QR code for venue check-in"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=400, detail="Invalid venue")
    
    # Generate QR payload
    timestamp = int(datetime.now(timezone.utc).timestamp())
    expiry = timestamp + 60  # 60 seconds
    
    payload = f"{current_user['user_id']}:{venue_id}:{timestamp}:{expiry}"
    signature = hmac.new(
        QR_SECRET.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    qr_data = f"{payload}:{signature}"
    
    return {
        "qr_data": qr_data,
        "user_id": current_user["user_id"],
        "venue_id": venue_id,
        "venue_name": LUNA_VENUES[venue_id]["name"],
        "generated_at": timestamp,
        "expires_at": expiry
    }

# ==================== Points & Rewards API ====================

@api_router.get("/rewards")
async def get_rewards(
    category: Optional[str] = None,
    venue_id: Optional[str] = None
):
    """Get rewards catalog"""
    query = {"is_active": True}
    
    if category:
        query["category"] = category
    
    rewards = await db.rewards.find(query).to_list(100)
    
    # Filter by venue
    if venue_id:
        rewards = [
            r for r in rewards
            if r.get("venue_restriction") is None or r.get("venue_restriction") == venue_id
        ]
    
    return rewards

@api_router.post("/rewards/redeem")
async def redeem_reward(request: Request, reward_id: str, venue_id: Optional[str] = None):
    """Redeem a reward"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Get reward
    reward = await db.rewards.find_one({"id": reward_id})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    # Check venue restriction
    if reward.get("venue_restriction") and reward["venue_restriction"] != venue_id:
        raise HTTPException(status_code=400, detail="Reward not available at this venue")
    
    # Get user
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    # Check points
    if user["points_balance"] < reward["points_cost"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    # Deduct points via Cherry Hub
    await CherryHubAPI.deduct_points(
        user["user_id"],
        reward["points_cost"],
        venue_id or "universal",
        f"reward_redemption:{reward_id}"
    )
    
    # Create redemption
    redemption = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "reward_id": reward_id,
        "reward_name": reward["name"],
        "points_spent": reward["points_cost"],
        "venue_redeemed": venue_id,
        "validation_code": secrets.token_hex(4).upper(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    
    await db.redemptions.insert_one(redemption)
    
    # Get new balance
    new_balance = await CherryHubAPI.get_points_balance(user["user_id"])
    
    return {
        "message": "Reward redeemed successfully!",
        "redemption": redemption,
        "new_balance": new_balance
    }

@api_router.get("/points/history")
async def get_points_history(
    request: Request,
    venue_id: Optional[str] = None
):
    """Get points transaction history"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    history = await CherryHubAPI.get_points_history(
        current_user["user_id"],
        venue_id
    )
    
    return history

# ==================== Continue with more endpoints...

# TODO: Add missions, events, auctions, photos, etc.

# ==================== CORS ====================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Luna Group VIP API", "venues": len(LUNA_VENUES)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
