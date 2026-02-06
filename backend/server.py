from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import hmac
import hashlib
import secrets
import bcrypt
import jwt
import stripe

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Configuration
QR_SECRET = os.environ.get('QR_SECRET', 'luna-group-vip-2024')
JWT_SECRET = os.environ.get('JWT_SECRET', 'luna-jwt-secret-2024')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = 7

# Stripe Configuration (Test Mode)
STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', 'sk_test_demo_key')
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', 'pk_test_demo_key')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', 'whsec_demo_secret')

# Initialize Stripe with test key
stripe.api_key = STRIPE_SECRET_KEY

# ====== SUBSCRIPTION TIERS CONFIGURATION ======
# Venues that charge entry
ENTRY_CHARGING_VENUES = ["eclipse", "afterdark", "su-casa-brisbane", "su-casa-gold-coast"]

SUBSCRIPTION_TIERS = {
    "lunar": {
        "id": "lunar",
        "name": "Lunar",
        "price": 0,  # Free tier
        "billing_period": "monthly",
        "color": "#C0C0C0",  # Silver
        "points_multiplier": 1.0,
        "benefits": {
            "free_entries_per_month": 0,
            "free_drinks_before_10pm": 0,
            "priority_queue": False,
            "skip_the_line": False,
            "early_auction_access": False,
            "exclusive_auctions": False,
            "birthday_booth_upgrade": False,
            "birthday_free_booth": False,
            "coat_check": False,
            "priority_booking": False,
            "private_events_access": False,
        },
        "description": "Basic access to Luna Group venues",
        "perks_list": [
            "Earn 1 point per $1 spent",
            "Access to all public auctions",
            "Digital membership card",
            "Event notifications",
        ]
    },
    "eclipse": {
        "id": "eclipse",
        "name": "Eclipse",
        "price": 29.99,
        "billing_period": "monthly",
        "color": "#E31837",  # Luna Red
        "points_multiplier": 1.5,
        "benefits": {
            "free_entries_per_month": 2,
            "free_drinks_before_10pm": 1,  # Per visit
            "priority_queue": True,
            "skip_the_line": False,
            "early_auction_access": True,
            "exclusive_auctions": False,
            "birthday_booth_upgrade": True,
            "birthday_free_booth": False,
            "coat_check": False,
            "priority_booking": False,
            "private_events_access": False,
        },
        "description": "Enhanced nightlife experience",
        "perks_list": [
            "2 FREE entries per month (Eclipse, Afterdark, Su Casa)",
            "1 FREE drink before 10pm per visit",
            "1.5x points multiplier",
            "Priority queue access",
            "Early access to auctions (30 min head start)",
            "Birthday month: FREE booth upgrade",
        ]
    },
    "supernova": {
        "id": "supernova",
        "name": "Supernova",
        "price": 79.99,
        "billing_period": "monthly",
        "color": "#FFD700",  # Gold
        "points_multiplier": 2.0,
        "benefits": {
            "free_entries_per_month": -1,  # Unlimited (-1)
            "free_drinks_before_10pm": 2,  # Per visit
            "priority_queue": True,
            "skip_the_line": True,
            "early_auction_access": True,
            "exclusive_auctions": True,
            "birthday_booth_upgrade": True,
            "birthday_free_booth": True,
            "coat_check": True,
            "priority_booking": True,
            "private_events_access": True,
        },
        "description": "Ultimate VIP experience",
        "perks_list": [
            "UNLIMITED free entries to all venues",
            "2 FREE drinks before 10pm per visit",
            "2x points multiplier",
            "VIP skip-the-line at ALL venues",
            "Exclusive Supernova-only auctions",
            "Birthday month: FREE VIP booth",
            "Complimentary coat check",
            "Priority booking for all events",
            "Access to private member-only events",
            "Dedicated concierge support",
        ]
    }
}

# Points configuration
POINTS_PER_DOLLAR = 1  # Base rate: $1 = 1 point

# Create app
app = FastAPI(title="Luna Group VIP API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import venues
from luna_venues_config import LUNA_VENUES

# Auth helper
def get_current_user(authorization: Optional[str] = None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization")
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Helper function to clean MongoDB documents
def clean_mongo_doc(doc):
    """Remove MongoDB _id field from document"""
    if doc and isinstance(doc, dict):
        doc_copy = dict(doc)
        doc_copy.pop('_id', None)
        return doc_copy
    return doc

def clean_mongo_docs(docs):
    """Remove MongoDB _id field from list of documents"""
    return [clean_mongo_doc(doc) for doc in docs]

# ====== VENUES API ======

@api_router.get("/venues")
async def get_venues(region: Optional[str] = None):
    venues = list(LUNA_VENUES.values())
    if region:
        venues = [v for v in venues if v["region"] == region]
    return venues

@api_router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    venue = LUNA_VENUES[venue_id].copy()
    now = datetime.now(timezone.utc)
    hour = now.hour
    if venue["type"] in ["nightclub", "bar"]:
        if 22 <= hour or hour < 3:
            venue["status"] = "busy"
        elif 20 <= hour < 22:
            venue["status"] = "open"
        else:
            venue["status"] = "closed"
    return venue

# ====== AUTH API ======

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@api_router.post("/auth/register")
async def register(request: RegisterRequest):
    existing = await db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt())
    user_id = str(uuid.uuid4())
    user = {
        "user_id": user_id,
        "email": request.email,
        "hashed_password": hashed.decode(),
        "name": request.name,
        "tier": "bronze",
        "points_balance": 500,
        "home_region": "brisbane",
        "favorite_venues": [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user)
    token_payload = {
        "user_id": user_id,
        "email": request.email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    # Remove MongoDB _id and hashed_password
    user_copy = {k: v for k, v in user.items() if k not in ["hashed_password", "_id"]}
    return {"user": user_copy, "token": token}

@api_router.post("/auth/login")
async def login(request: LoginRequest):
    user = await db.users.find_one({"email": request.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not bcrypt.checkpw(request.password.encode(), user["hashed_password"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token_payload = {
        "user_id": user["user_id"],
        "email": user["email"],
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    # Remove MongoDB _id and hashed_password
    user_copy = {k: v for k, v in user.items() if k not in ["hashed_password", "_id"]}
    return {"user": user_copy, "token": token}

@api_router.get("/auth/me")
async def get_me(request: Request):
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Remove MongoDB _id and hashed_password
    user_copy = {k: v for k, v in user.items() if k not in ["hashed_password", "_id"]}
    return user_copy

# ====== TONIGHT PASS API ======

@api_router.get("/checkin/qr")
async def generate_qr(request: Request, venue_id: str):
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=400, detail="Invalid venue")
    timestamp = int(datetime.now(timezone.utc).timestamp())
    expiry = timestamp + 60
    payload = f"{current_user['user_id']}:{venue_id}:{timestamp}:{expiry}"
    signature = hmac.new(QR_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    qr_data = f"{payload}:{signature}"
    return {
        "qr_data": qr_data,
        "user_id": current_user["user_id"],
        "venue_id": venue_id,
        "venue_name": LUNA_VENUES[venue_id]["name"],
        "generated_at": timestamp,
        "expires_at": expiry
    }

# ====== REWARDS API ======

@api_router.get("/rewards")
async def get_rewards(category: Optional[str] = None, venue_id: Optional[str] = None):
    query = {"is_active": True}
    if category:
        query["category"] = category
    rewards = await db.rewards.find(query).to_list(100)
    if venue_id:
        rewards = [r for r in rewards if r.get("venue_restriction") is None or r.get("venue_restriction") == venue_id]
    # Clean MongoDB ObjectIds
    return clean_mongo_docs(rewards)

@api_router.post("/rewards/redeem")
async def redeem_reward(request: Request, reward_id: str, venue_id: Optional[str] = None):
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    reward = await db.rewards.find_one({"id": reward_id})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    if reward.get("venue_restriction") and reward["venue_restriction"] != venue_id:
        raise HTTPException(status_code=400, detail="Reward not available at this venue")
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if user["points_balance"] < reward["points_cost"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"points_balance": -reward["points_cost"]}}
    )
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
    new_user = await db.users.find_one({"user_id": user["user_id"]})
    return {
        "message": "Reward redeemed successfully!",
        "redemption": redemption,
        "new_balance": new_user["points_balance"]
    }

# ====== MISSIONS API ======

@api_router.get("/missions")
async def get_missions(request: Request, venue_id: Optional[str] = None):
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    query = {"is_active": True}
    missions = await db.missions.find(query).to_list(100)
    if venue_id:
        missions = [m for m in missions if m.get("venue_requirements") is None or venue_id in m.get("venue_requirements", [])]
    for mission in missions:
        mission["completed"] = False
        mission["progress"] = 0
    return clean_mongo_docs(missions)

# ====== EVENTS API ======

@api_router.get("/events")
async def get_events(venue_id: Optional[str] = None):
    now = datetime.now(timezone.utc)
    query = {"event_date": {"$gte": now}}
    if venue_id:
        query["venue_id"] = venue_id
    events = await db.events.find(query).sort("event_date", 1).to_list(50)
    return clean_mongo_docs(events)

# ====== BOOSTS API ======

@api_router.get("/boosts")
async def get_active_boosts(venue_id: Optional[str] = None):
    now = datetime.now(timezone.utc)
    query = {
        "start_time": {"$lte": now},
        "end_time": {"$gte": now}
    }
    if venue_id:
        query["$or"] = [
            {"venue_restriction": None},
            {"venue_restriction": venue_id}
        ]
    boosts = await db.boosts.find(query).to_list(10)
    return clean_mongo_docs(boosts)

@api_router.get("/boosts/upcoming")
async def get_upcoming_boosts(venue_id: Optional[str] = None):
    now = datetime.now(timezone.utc)
    query = {"start_time": {"$gt": now}}
    if venue_id:
        query["$or"] = [
            {"venue_restriction": None},
            {"venue_restriction": venue_id}
        ]
    boosts = await db.boosts.find(query).sort("start_time", 1).to_list(10)
    return clean_mongo_docs(boosts)

# ====== AUCTIONS API ======

@api_router.get("/auctions")
async def get_auctions(venue_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if venue_id:
        query["venue_id"] = venue_id
    if status:
        query["status"] = status
    auctions = await db.auctions.find(query).sort("start_time", 1).to_list(50)
    return clean_mongo_docs(auctions)

@api_router.get("/auctions/{auction_id}")
async def get_auction_detail(auction_id: str):
    """Get detailed auction info with bid history"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Get bid history
    bids = await db.bids.find({"auction_id": auction_id}).sort("timestamp", -1).to_list(20)
    
    auction_data = clean_mongo_doc(auction)
    auction_data["bid_history"] = clean_mongo_docs(bids)
    auction_data["total_bids"] = len(bids)
    
    return auction_data

class PlaceBidRequest(BaseModel):
    auction_id: str
    amount: float
    max_bid: Optional[float] = None  # For auto-bidding

@api_router.post("/auctions/bid")
async def place_bid(request: Request, bid_request: PlaceBidRequest):
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    auction = await db.auctions.find_one({"id": bid_request.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction not active")
    
    # Check max bid limit
    max_limit = auction.get("max_bid_limit", 10000)
    if bid_request.amount > max_limit:
        raise HTTPException(status_code=400, detail=f"Bid cannot exceed ${max_limit}")
    
    min_bid = auction["current_bid"] + auction.get("min_increment", 5)
    if bid_request.amount < min_bid:
        raise HTTPException(status_code=400, detail=f"Bid must be at least ${min_bid}")
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    previous_winner_id = auction.get("winner_id")
    
    # Update auction
    await db.auctions.update_one(
        {"id": bid_request.auction_id},
        {"$set": {
            "current_bid": bid_request.amount, 
            "winner_id": user["user_id"], 
            "winner_name": user["name"],
            "last_bid_time": datetime.now(timezone.utc)
        }}
    )
    
    # Record bid
    await db.bids.insert_one({
        "id": str(uuid.uuid4()),
        "auction_id": bid_request.auction_id,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "amount": bid_request.amount,
        "max_bid": bid_request.max_bid,
        "timestamp": datetime.now(timezone.utc)
    })
    
    # Notify previous winner they've been outbid
    if previous_winner_id and previous_winner_id != user["user_id"]:
        await db.auction_notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": previous_winner_id,
            "auction_id": bid_request.auction_id,
            "auction_title": auction["title"],
            "type": "outbid",
            "message": f"You've been outbid on {auction['title']}! Current bid: ${bid_request.amount}",
            "new_bid": bid_request.amount,
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })
    
    updated_auction = await db.auctions.find_one({"id": bid_request.auction_id})
    return {"message": "Bid placed successfully!", "auction": clean_mongo_doc(updated_auction)}

@api_router.get("/auctions/{auction_id}/bids")
async def get_auction_bids(auction_id: str):
    """Get bid history for an auction"""
    bids = await db.bids.find({"auction_id": auction_id}).sort("timestamp", -1).to_list(50)
    return clean_mongo_docs(bids)

# ====== PHOTOS API ======

@api_router.get("/photos")
async def get_user_photos(request: Request, venue_id: Optional[str] = None):
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    query = {"tagged_users": current_user["user_id"]}
    if venue_id:
        query["venue_id"] = venue_id
    photos = await db.photos.find(query).sort("created_at", -1).to_list(100)
    return clean_mongo_docs(photos)

# ====== ADMIN SEED API ======

@api_router.post("/admin/seed")
async def seed_database():
    from seed_data import get_seed_data
    
    # Get comprehensive seed data
    seed_data = get_seed_data()
    
    # Seed rewards
    await db.rewards.delete_many({})
    if seed_data["rewards"]:
        await db.rewards.insert_many(seed_data["rewards"])
    
    # Seed missions
    await db.missions.delete_many({})
    if seed_data["missions"]:
        await db.missions.insert_many(seed_data["missions"])
    
    # Seed events
    await db.events.delete_many({})
    if seed_data["events"]:
        await db.events.insert_many(seed_data["events"])
    
    # Seed boosts
    await db.boosts.delete_many({})
    if seed_data["boosts"]:
        await db.boosts.insert_many(seed_data["boosts"])
    
    # Seed auctions
    await db.auctions.delete_many({})
    if seed_data["auctions"]:
        await db.auctions.insert_many(seed_data["auctions"])
    
    return {
        "message": "Luna Group database seeded successfully!",
        "rewards": len(seed_data["rewards"]),
        "missions": len(seed_data["missions"]),
        "events": len(seed_data["events"]),
        "boosts": len(seed_data["boosts"]),
        "auctions": len(seed_data["auctions"])
    }


# ====== SEVENROOMS BOOKING API (MOCK) ======

class BookingRequest(BaseModel):
    venue_id: str
    date: str  # YYYY-MM-DD format
    time: str  # HH:MM format
    party_size: int
    special_requests: Optional[str] = None
    occasion: Optional[str] = None

class GuestlistRequest(BaseModel):
    venue_id: str
    date: str  # YYYY-MM-DD format
    party_size: int
    arrival_time: Optional[str] = None
    vip_booth: bool = False

@api_router.get("/bookings/availability")
async def get_availability(venue_id: str, date: str, party_size: int = 2):
    """Get available time slots for a venue (SevenRooms mock)"""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    venue = LUNA_VENUES[venue_id]
    
    # Mock available time slots based on venue type
    if venue["type"] == "restaurant":
        time_slots = [
            {"time": "12:00", "available": True, "tables": 3},
            {"time": "12:30", "available": True, "tables": 2},
            {"time": "13:00", "available": True, "tables": 4},
            {"time": "18:00", "available": True, "tables": 5},
            {"time": "18:30", "available": True, "tables": 3},
            {"time": "19:00", "available": party_size <= 4, "tables": 2},
            {"time": "19:30", "available": True, "tables": 4},
            {"time": "20:00", "available": party_size <= 6, "tables": 1},
            {"time": "20:30", "available": True, "tables": 3},
            {"time": "21:00", "available": True, "tables": 2},
        ]
    else:
        # Nightclub/bar - guestlist slots
        time_slots = [
            {"time": "21:00", "available": True, "spots": 50},
            {"time": "22:00", "available": True, "spots": 30},
            {"time": "23:00", "available": True, "spots": 20},
        ]
    
    return {
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "date": date,
        "party_size": party_size,
        "time_slots": time_slots,
        "powered_by": "SevenRooms"
    }

@api_router.post("/bookings/reserve")
async def create_booking(request: Request, booking: BookingRequest):
    """Create a restaurant reservation (SevenRooms mock)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    if booking.venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    venue = LUNA_VENUES[booking.venue_id]
    
    # Create booking record
    booking_id = str(uuid.uuid4())[:8].upper()
    booking_record = {
        "booking_id": booking_id,
        "user_id": current_user["user_id"],
        "venue_id": booking.venue_id,
        "venue_name": venue["name"],
        "date": booking.date,
        "time": booking.time,
        "party_size": booking.party_size,
        "special_requests": booking.special_requests,
        "occasion": booking.occasion,
        "status": "confirmed",
        "confirmation_code": f"SR-{booking_id}",
        "created_at": datetime.now(timezone.utc),
        "points_earned": 50 * booking.party_size
    }
    
    await db.bookings.insert_one(booking_record)
    
    # Award points to user
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": booking_record["points_earned"]}}
    )
    
    return {
        "success": True,
        "booking": clean_mongo_doc(booking_record),
        "message": f"Your reservation at {venue['name']} is confirmed!",
        "powered_by": "SevenRooms"
    }

@api_router.post("/bookings/guestlist")
async def add_to_guestlist(request: Request, guestlist: GuestlistRequest):
    """Add to nightclub guestlist (SevenRooms mock)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    if guestlist.venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    venue = LUNA_VENUES[guestlist.venue_id]
    
    # Create guestlist record
    guestlist_id = str(uuid.uuid4())[:8].upper()
    guestlist_record = {
        "guestlist_id": guestlist_id,
        "user_id": current_user["user_id"],
        "venue_id": guestlist.venue_id,
        "venue_name": venue["name"],
        "date": guestlist.date,
        "party_size": guestlist.party_size,
        "arrival_time": guestlist.arrival_time or "22:00",
        "vip_booth": guestlist.vip_booth,
        "status": "confirmed",
        "confirmation_code": f"GL-{guestlist_id}",
        "created_at": datetime.now(timezone.utc),
        "entry_priority": "VIP" if guestlist.vip_booth else "Priority",
        "points_earned": 100 if guestlist.vip_booth else 25
    }
    
    await db.guestlist.insert_one(guestlist_record)
    
    # Award points
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": guestlist_record["points_earned"]}}
    )
    
    return {
        "success": True,
        "guestlist": clean_mongo_doc(guestlist_record),
        "message": f"You're on the list for {venue['name']}! Show your QR code at the door.",
        "powered_by": "SevenRooms"
    }

@api_router.get("/bookings/my-reservations")
async def get_my_reservations(request: Request):
    """Get user's bookings and guestlist entries"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    bookings = await db.bookings.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(50)
    guestlist = await db.guestlist.find({"user_id": current_user["user_id"]}).sort("created_at", -1).to_list(50)
    
    return {
        "bookings": clean_mongo_docs(bookings),
        "guestlist": clean_mongo_docs(guestlist)
    }

@api_router.delete("/bookings/{booking_id}")
async def cancel_booking(request: Request, booking_id: str):
    """Cancel a booking or guestlist entry"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Try to find in bookings
    booking = await db.bookings.find_one({"booking_id": booking_id, "user_id": current_user["user_id"]})
    if booking:
        await db.bookings.update_one(
            {"booking_id": booking_id},
            {"$set": {"status": "cancelled"}}
        )
        return {"success": True, "message": "Reservation cancelled"}
    
    # Try guestlist
    guestlist = await db.guestlist.find_one({"guestlist_id": booking_id, "user_id": current_user["user_id"]})
    if guestlist:
        await db.guestlist.update_one(
            {"guestlist_id": booking_id},
            {"$set": {"status": "cancelled"}}
        )
        return {"success": True, "message": "Guestlist entry cancelled"}
    
    raise HTTPException(status_code=404, detail="Booking not found")


# ====== TICKETS WALLET API ======

@api_router.get("/tickets")
async def get_user_tickets(request: Request, status: Optional[str] = None):
    """Get user's tickets - active, upcoming, or history"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    now = datetime.now(timezone.utc)
    query = {"user_id": current_user["user_id"]}
    
    tickets = await db.tickets.find(query).sort("event_date", -1).to_list(100)
    
    # Categorize tickets
    active = []
    upcoming = []
    history = []
    
    for ticket in tickets:
        ticket_clean = clean_mongo_doc(ticket)
        event_date = ticket.get("event_date")
        
        if isinstance(event_date, str):
            event_date = datetime.fromisoformat(event_date.replace('Z', '+00:00'))
        
        if ticket.get("status") == "cancelled":
            history.append(ticket_clean)
        elif event_date:
            if event_date.date() == now.date():
                active.append(ticket_clean)
            elif event_date > now:
                upcoming.append(ticket_clean)
            else:
                history.append(ticket_clean)
        else:
            upcoming.append(ticket_clean)
    
    if status == "active":
        return active
    elif status == "upcoming":
        return upcoming
    elif status == "history":
        return history
    
    return {
        "active": active,
        "upcoming": upcoming,
        "history": history
    }

class PurchaseTicketRequest(BaseModel):
    event_id: str
    quantity: int = 1
    ticket_type: str = "general"  # general, vip, booth

@api_router.post("/tickets/purchase")
async def purchase_ticket(request: Request, ticket_req: PurchaseTicketRequest):
    """Purchase tickets for an event"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Find the event
    event = await db.events.find_one({"id": ticket_req.event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Create ticket(s)
    tickets_created = []
    for i in range(ticket_req.quantity):
        ticket_id = str(uuid.uuid4())[:8].upper()
        ticket = {
            "id": ticket_id,
            "user_id": current_user["user_id"],
            "event_id": ticket_req.event_id,
            "event_title": event.get("title"),
            "venue_id": event.get("venue_id"),
            "venue_name": event.get("venue_name"),
            "event_date": event.get("event_date"),
            "ticket_type": ticket_req.ticket_type,
            "qr_code": f"TKT-{ticket_id}-{current_user['user_id'][:8]}",
            "status": "active",
            "guests": [],
            "created_at": datetime.now(timezone.utc),
            "price": event.get("ticket_price", 0)
        }
        await db.tickets.insert_one(ticket)
        tickets_created.append(clean_mongo_doc(ticket))
    
    # Award points
    points = 50 * ticket_req.quantity
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": points}}
    )
    
    return {
        "success": True,
        "tickets": tickets_created,
        "points_earned": points,
        "message": f"Successfully purchased {ticket_req.quantity} ticket(s)!"
    }

class AddGuestRequest(BaseModel):
    ticket_id: str
    guest_name: str
    guest_email: Optional[str] = None

@api_router.post("/tickets/add-guest")
async def add_guest_to_ticket(request: Request, guest_req: AddGuestRequest):
    """Add a guest to a ticket"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    ticket = await db.tickets.find_one({
        "id": guest_req.ticket_id,
        "user_id": current_user["user_id"]
    })
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    guest = {
        "id": str(uuid.uuid4())[:8],
        "name": guest_req.guest_name,
        "email": guest_req.guest_email,
        "added_at": datetime.now(timezone.utc)
    }
    
    await db.tickets.update_one(
        {"id": guest_req.ticket_id},
        {"$push": {"guests": guest}}
    )
    
    return {"success": True, "guest": guest, "message": f"Guest {guest_req.guest_name} added!"}

@api_router.delete("/tickets/{ticket_id}/guest/{guest_id}")
async def remove_guest(request: Request, ticket_id: str, guest_id: str):
    """Remove a guest from a ticket"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.tickets.update_one(
        {"id": ticket_id, "user_id": current_user["user_id"]},
        {"$pull": {"guests": {"id": guest_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    
    return {"success": True, "message": "Guest removed"}


# ====== CREW PLAN API ======

class CreateCrewRequest(BaseModel):
    name: str
    event_id: Optional[str] = None

@api_router.post("/crews/create")
async def create_crew(request: Request, crew_req: CreateCrewRequest):
    """Create a new crew for group planning"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew_id = str(uuid.uuid4())[:8].upper()
    crew = {
        "id": crew_id,
        "name": crew_req.name,
        "owner_id": current_user["user_id"],
        "owner_name": (await db.users.find_one({"user_id": current_user["user_id"]}))["name"],
        "event_id": crew_req.event_id,
        "members": [{
            "user_id": current_user["user_id"],
            "name": (await db.users.find_one({"user_id": current_user["user_id"]}))["name"],
            "role": "owner",
            "status": "confirmed",
            "joined_at": datetime.now(timezone.utc)
        }],
        "shared_booth_bid": None,
        "split_payments": [],
        "invite_code": f"CREW-{crew_id}",
        "created_at": datetime.now(timezone.utc),
        "status": "active"
    }
    
    await db.crews.insert_one(crew)
    return {"success": True, "crew": clean_mongo_doc(crew)}

@api_router.get("/crews")
async def get_user_crews(request: Request):
    """Get all crews the user is part of"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crews = await db.crews.find({
        "$or": [
            {"owner_id": current_user["user_id"]},
            {"members.user_id": current_user["user_id"]}
        ]
    }).sort("created_at", -1).to_list(50)
    
    return clean_mongo_docs(crews)

@api_router.get("/crews/{crew_id}")
async def get_crew_detail(request: Request, crew_id: str):
    """Get detailed crew info"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    # Get event details if linked
    event = None
    if crew.get("event_id"):
        event = await db.events.find_one({"id": crew["event_id"]})
    
    crew_data = clean_mongo_doc(crew)
    crew_data["event"] = clean_mongo_doc(event) if event else None
    
    return crew_data

class InviteToCrewRequest(BaseModel):
    crew_id: str
    email: Optional[str] = None
    user_id: Optional[str] = None

@api_router.post("/crews/invite")
async def invite_to_crew(request: Request, invite_req: InviteToCrewRequest):
    """Invite someone to join a crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew = await db.crews.find_one({"id": invite_req.crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    # Find invitee
    invitee = None
    if invite_req.user_id:
        invitee = await db.users.find_one({"user_id": invite_req.user_id})
    elif invite_req.email:
        invitee = await db.users.find_one({"email": invite_req.email})
    
    if not invitee:
        # Create pending invite
        invite = {
            "id": str(uuid.uuid4()),
            "crew_id": invite_req.crew_id,
            "email": invite_req.email,
            "invited_by": current_user["user_id"],
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        await db.crew_invites.insert_one(invite)
        return {"success": True, "message": "Invite sent!", "invite": clean_mongo_doc(invite)}
    
    # Add to crew
    member = {
        "user_id": invitee["user_id"],
        "name": invitee["name"],
        "role": "member",
        "status": "pending",
        "joined_at": datetime.now(timezone.utc)
    }
    
    await db.crews.update_one(
        {"id": invite_req.crew_id},
        {"$push": {"members": member}}
    )
    
    return {"success": True, "message": f"{invitee['name']} invited to crew!"}

@api_router.post("/crews/{crew_id}/join")
async def join_crew(request: Request, crew_id: str):
    """Accept crew invitation"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    await db.crews.update_one(
        {"id": crew_id, "members.user_id": current_user["user_id"]},
        {"$set": {"members.$.status": "confirmed"}}
    )
    
    return {"success": True, "message": "You've joined the crew!"}

class CrewBoothBidRequest(BaseModel):
    crew_id: str
    auction_id: str
    total_amount: float
    contributions: List[Dict[str, Any]]  # [{user_id, amount}]

@api_router.post("/crews/booth-bid")
async def crew_booth_bid(request: Request, bid_req: CrewBoothBidRequest):
    """Place a shared booth bid as a crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew = await db.crews.find_one({"id": bid_req.crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    auction = await db.auctions.find_one({"id": bid_req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Record the shared bid
    shared_bid = {
        "auction_id": bid_req.auction_id,
        "total_amount": bid_req.total_amount,
        "contributions": bid_req.contributions,
        "placed_by": current_user["user_id"],
        "placed_at": datetime.now(timezone.utc),
        "status": "active"
    }
    
    await db.crews.update_one(
        {"id": bid_req.crew_id},
        {"$set": {"shared_booth_bid": shared_bid}}
    )
    
    # Place the actual bid
    if bid_req.total_amount > auction["current_bid"]:
        await db.auctions.update_one(
            {"id": bid_req.auction_id},
            {"$set": {
                "current_bid": bid_req.total_amount,
                "winner_id": f"crew_{bid_req.crew_id}",
                "winner_name": f"Crew: {crew['name']}"
            }}
        )
    
    return {"success": True, "message": "Crew bid placed!", "shared_bid": shared_bid}


# ====== SAFETY SCREEN API ======

class IncidentReportRequest(BaseModel):
    venue_id: str
    incident_type: str  # harassment, emergency, other
    description: str
    location_details: Optional[str] = None

@api_router.post("/safety/report-incident")
async def report_incident(request: Request, report: IncidentReportRequest):
    """Report a safety incident"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    incident_id = str(uuid.uuid4())[:8].upper()
    incident = {
        "id": incident_id,
        "user_id": current_user["user_id"],
        "venue_id": report.venue_id,
        "incident_type": report.incident_type,
        "description": report.description,
        "location_details": report.location_details,
        "status": "reported",
        "created_at": datetime.now(timezone.utc),
        "reference_number": f"INC-{incident_id}"
    }
    
    await db.incidents.insert_one(incident)
    
    return {
        "success": True,
        "reference_number": incident["reference_number"],
        "message": "Incident reported. Our security team has been notified."
    }

class LostPropertyRequest(BaseModel):
    venue_id: str
    item_description: str
    date_lost: str
    contact_phone: Optional[str] = None

@api_router.post("/safety/lost-property")
async def report_lost_property(request: Request, report: LostPropertyRequest):
    """Report lost property"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    report_id = str(uuid.uuid4())[:8].upper()
    lost_item = {
        "id": report_id,
        "user_id": current_user["user_id"],
        "venue_id": report.venue_id,
        "item_description": report.item_description,
        "date_lost": report.date_lost,
        "contact_phone": report.contact_phone,
        "status": "submitted",
        "created_at": datetime.now(timezone.utc),
        "reference_number": f"LP-{report_id}"
    }
    
    await db.lost_property.insert_one(lost_item)
    
    return {
        "success": True,
        "reference_number": lost_item["reference_number"],
        "message": "Lost property report submitted. We'll contact you if found."
    }

@api_router.get("/safety/rideshare-links")
async def get_rideshare_links(venue_id: str):
    """Get rideshare deep links for a venue"""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    venue = LUNA_VENUES[venue_id]
    lat = venue["coordinates"]["lat"]
    lng = venue["coordinates"]["lng"]
    
    return {
        "uber": f"uber://?action=setPickup&pickup=my_location&dropoff[latitude]={lat}&dropoff[longitude]={lng}",
        "uber_web": f"https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]={lat}&dropoff[longitude]={lng}",
        "didi": f"https://page.udache.com/ride/order?dlat={lat}&dlng={lng}",
        "venue_address": venue["address"]
    }

@api_router.get("/safety/emergency-contacts")
async def get_emergency_contacts(venue_id: Optional[str] = None):
    """Get emergency contacts"""
    contacts = {
        "emergency": "000",
        "police_non_emergency": "131 444",
        "lifeline": "13 11 14",
        "luna_security": "1800 LUNA 00",
        "venue_security": None
    }
    
    if venue_id and venue_id in LUNA_VENUES:
        venue = LUNA_VENUES[venue_id]
        contacts["venue_name"] = venue["name"]
        contacts["venue_address"] = venue["address"]
    
    return contacts


# ====== USER STATS API ======

@api_router.get("/users/stats")
async def get_user_stats(request: Request):
    """Get user statistics"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    # Count various stats
    tickets_count = await db.tickets.count_documents({"user_id": current_user["user_id"]})
    bookings_count = await db.bookings.count_documents({"user_id": current_user["user_id"]})
    auctions_won = await db.auctions.count_documents({"winner_id": current_user["user_id"], "status": "ended"})
    
    return {
        "total_visits": user.get("total_visits", 0),
        "missions_completed": user.get("missions_completed", 0),
        "current_streak": user.get("current_streak", 0),
        "auctions_won": auctions_won,
        "tickets_purchased": tickets_count,
        "reservations_made": bookings_count,
        "achievements_earned": user.get("achievements_earned", 0),
        "member_since": user.get("created_at")
    }


# ====== REAL-TIME AUCTION NOTIFICATIONS ======

# Store for auction subscribers (in-memory for simplicity)
auction_subscribers: Dict[str, List[str]] = {}  # auction_id -> list of user_ids

class AuctionSubscribeRequest(BaseModel):
    auction_id: str
    notify_outbid: bool = True

@api_router.post("/auctions/subscribe")
async def subscribe_to_auction(request: Request, sub_request: AuctionSubscribeRequest):
    """Subscribe to auction notifications"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    auction_id = sub_request.auction_id
    user_id = current_user["user_id"]
    
    if auction_id not in auction_subscribers:
        auction_subscribers[auction_id] = []
    
    if user_id not in auction_subscribers[auction_id]:
        auction_subscribers[auction_id].append(user_id)
    
    return {"success": True, "message": "Subscribed to auction notifications"}

@api_router.get("/auctions/notifications")
async def get_auction_notifications(request: Request):
    """Get pending notifications for user's auctions"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    notifications = await db.auction_notifications.find({
        "user_id": current_user["user_id"],
        "read": False
    }).sort("created_at", -1).to_list(20)
    
    return {"notifications": clean_mongo_docs(notifications)}

@api_router.post("/auctions/notifications/mark-read")
async def mark_notifications_read(request: Request):
    """Mark all auction notifications as read"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.auction_notifications.update_many(
        {"user_id": current_user["user_id"]},
        {"$set": {"read": True}}
    )
    
    return {"success": True}


# ====== STRIPE PAYMENT API ======

# In-memory store for push tokens (in production, use database)
push_tokens_store: Dict[str, str] = {}  # user_id -> push_token

class PaymentIntentRequest(BaseModel):
    auction_id: str
    bid_amount: float

@api_router.get("/payments/publishable-key")
async def get_stripe_publishable_key():
    """Get Stripe publishable key for mobile app"""
    return {
        "publishableKey": STRIPE_PUBLISHABLE_KEY,
        "testMode": STRIPE_SECRET_KEY.startswith('sk_test') or STRIPE_SECRET_KEY == 'sk_test_demo_key'
    }

@api_router.post("/payments/create-payment-intent")
async def create_payment_intent(request: Request, payment_req: PaymentIntentRequest):
    """Create a Stripe PaymentIntent for auction bid deposit"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Get the auction
    auction = await db.auctions.find_one({"id": payment_req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Check auction is still active
    if auction.get("status") != "active":
        raise HTTPException(status_code=400, detail="Auction is no longer active")
    
    # Validate bid amount
    if payment_req.bid_amount <= auction.get("current_bid", 0):
        raise HTTPException(status_code=400, detail="Bid must be higher than current bid")
    
    # Calculate deposit (10% of bid amount, minimum $50)
    deposit_amount = max(int(payment_req.bid_amount * 0.10 * 100), 5000)  # in cents
    
    # Check if using demo key (mock payment intent)
    if STRIPE_SECRET_KEY == 'sk_test_demo_key':
        # Return mock payment intent for demo mode
        mock_intent_id = f"pi_demo_{str(uuid.uuid4())[:12]}"
        
        # Store the pending bid
        bid_record = {
            "id": str(uuid.uuid4())[:8],
            "auction_id": payment_req.auction_id,
            "user_id": current_user["user_id"],
            "bid_amount": payment_req.bid_amount,
            "deposit_amount": deposit_amount / 100,  # store in dollars
            "payment_intent_id": mock_intent_id,
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        await db.bid_deposits.insert_one(bid_record)
        
        return {
            "clientSecret": f"{mock_intent_id}_secret_demo",
            "paymentIntentId": mock_intent_id,
            "depositAmount": deposit_amount / 100,
            "currency": "AUD",
            "bidId": bid_record["id"],
            "testMode": True,
            "message": "Demo mode - no real payment will be processed"
        }
    
    try:
        # Create real Stripe PaymentIntent
        payment_intent = stripe.PaymentIntent.create(
            amount=deposit_amount,
            currency="aud",
            automatic_payment_methods={"enabled": True},
            metadata={
                "auction_id": payment_req.auction_id,
                "user_id": current_user["user_id"],
                "bid_amount": str(payment_req.bid_amount),
                "auction_title": auction.get("title", "VIP Booth")
            },
            description=f"Auction deposit for {auction.get('title', 'VIP Booth')}"
        )
        
        # Store the pending bid
        bid_record = {
            "id": str(uuid.uuid4())[:8],
            "auction_id": payment_req.auction_id,
            "user_id": current_user["user_id"],
            "bid_amount": payment_req.bid_amount,
            "deposit_amount": deposit_amount / 100,
            "payment_intent_id": payment_intent.id,
            "payment_status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        await db.bid_deposits.insert_one(bid_record)
        
        return {
            "clientSecret": payment_intent.client_secret,
            "paymentIntentId": payment_intent.id,
            "depositAmount": deposit_amount / 100,
            "currency": "AUD",
            "bidId": bid_record["id"],
            "testMode": False
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Payment processing error")

@api_router.post("/payments/confirm-bid")
async def confirm_bid_payment(request: Request, bid_id: str, payment_intent_id: str):
    """Confirm a bid payment was successful (called after Payment Sheet completes)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Find the bid record
    bid = await db.bid_deposits.find_one({
        "id": bid_id,
        "user_id": current_user["user_id"],
        "payment_intent_id": payment_intent_id
    })
    
    if not bid:
        raise HTTPException(status_code=404, detail="Bid deposit not found")
    
    # For demo mode, auto-confirm
    if STRIPE_SECRET_KEY == 'sk_test_demo_key' or payment_intent_id.startswith('pi_demo_'):
        # Update bid status
        await db.bid_deposits.update_one(
            {"id": bid_id},
            {"$set": {"payment_status": "succeeded", "updated_at": datetime.now(timezone.utc)}}
        )
        
        # Place the actual bid
        auction = await db.auctions.find_one({"id": bid["auction_id"]})
        if auction and bid["bid_amount"] > auction.get("current_bid", 0):
            # Get previous winner to notify
            previous_winner_id = auction.get("winner_id")
            
            await db.auctions.update_one(
                {"id": bid["auction_id"]},
                {"$set": {
                    "current_bid": bid["bid_amount"],
                    "winner_id": current_user["user_id"],
                    "winner_name": (await db.users.find_one({"user_id": current_user["user_id"]}))["name"]
                }}
            )
            
            # Notify outbid user
            if previous_winner_id and previous_winner_id != current_user["user_id"]:
                await notify_outbid_user(previous_winner_id, bid["auction_id"], bid["bid_amount"])
        
        return {
            "success": True,
            "message": "Bid placed successfully!",
            "bidAmount": bid["bid_amount"],
            "depositPaid": bid["deposit_amount"]
        }
    
    # For real Stripe, verify the payment intent status
    try:
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        if payment_intent.status == "succeeded":
            await db.bid_deposits.update_one(
                {"id": bid_id},
                {"$set": {"payment_status": "succeeded", "updated_at": datetime.now(timezone.utc)}}
            )
            
            # Place the actual bid
            auction = await db.auctions.find_one({"id": bid["auction_id"]})
            if auction and bid["bid_amount"] > auction.get("current_bid", 0):
                previous_winner_id = auction.get("winner_id")
                
                await db.auctions.update_one(
                    {"id": bid["auction_id"]},
                    {"$set": {
                        "current_bid": bid["bid_amount"],
                        "winner_id": current_user["user_id"],
                        "winner_name": (await db.users.find_one({"user_id": current_user["user_id"]}))["name"]
                    }}
                )
                
                if previous_winner_id and previous_winner_id != current_user["user_id"]:
                    await notify_outbid_user(previous_winner_id, bid["auction_id"], bid["bid_amount"])
            
            return {
                "success": True,
                "message": "Bid placed successfully!",
                "bidAmount": bid["bid_amount"],
                "depositPaid": bid["deposit_amount"]
            }
        else:
            return {
                "success": False,
                "message": f"Payment status: {payment_intent.status}",
                "status": payment_intent.status
            }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Error verifying payment")

@api_router.post("/payments/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    if STRIPE_WEBHOOK_SECRET == 'whsec_demo_secret':
        return {"status": "webhook_disabled_in_demo"}
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle payment events
    if event['type'] == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        await db.bid_deposits.update_one(
            {"payment_intent_id": payment_intent['id']},
            {"$set": {"payment_status": "succeeded", "updated_at": datetime.now(timezone.utc)}}
        )
        logger.info(f"Payment succeeded for {payment_intent['id']}")
    
    elif event['type'] == 'payment_intent.payment_failed':
        payment_intent = event['data']['object']
        await db.bid_deposits.update_one(
            {"payment_intent_id": payment_intent['id']},
            {"$set": {"payment_status": "failed", "updated_at": datetime.now(timezone.utc)}}
        )
        logger.info(f"Payment failed for {payment_intent['id']}")
    
    return {"status": "received"}


# ====== PUSH NOTIFICATIONS API ======

class RegisterPushTokenRequest(BaseModel):
    push_token: str
    device_type: str = "expo"  # expo, ios, android

@api_router.post("/notifications/register-push-token")
async def register_push_token(request: Request, token_req: RegisterPushTokenRequest):
    """Register a push notification token for the user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Store in database
    await db.push_tokens.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "user_id": current_user["user_id"],
            "push_token": token_req.push_token,
            "device_type": token_req.device_type,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    # Also store in memory for quick access
    push_tokens_store[current_user["user_id"]] = token_req.push_token
    
    return {"success": True, "message": "Push token registered"}

@api_router.delete("/notifications/push-token")
async def remove_push_token(request: Request):
    """Remove push token (on logout)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.push_tokens.delete_one({"user_id": current_user["user_id"]})
    push_tokens_store.pop(current_user["user_id"], None)
    
    return {"success": True, "message": "Push token removed"}

async def notify_outbid_user(user_id: str, auction_id: str, new_bid_amount: float):
    """Send push notification to outbid user"""
    # Get push token
    token_doc = await db.push_tokens.find_one({"user_id": user_id})
    if not token_doc:
        logger.info(f"No push token for user {user_id}")
        return
    
    push_token = token_doc.get("push_token")
    if not push_token:
        return
    
    # Get auction details
    auction = await db.auctions.find_one({"id": auction_id})
    auction_title = auction.get("title", "VIP Booth") if auction else "VIP Booth"
    
    # Store notification in database
    notification = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "type": "outbid",
        "title": "You've been outbid!",
        "body": f"Someone bid ${new_bid_amount:,.0f} on {auction_title}. Place a higher bid to win!",
        "data": {
            "auction_id": auction_id,
            "new_bid": new_bid_amount
        },
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.auction_notifications.insert_one(notification)
    
    # Try to send push notification via Expo
    try:
        # Using expo-server-sdk approach (but keeping it simple for now)
        # In production, you would use the exponent_server_sdk library
        logger.info(f"Would send push to {push_token}: {notification['title']}")
        
        # For now, just log it - the notification is stored in DB
        # Frontend can poll for notifications
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")

@api_router.get("/notifications/pending")
async def get_pending_notifications(request: Request):
    """Get all pending (unread) notifications for the user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    notifications = await db.auction_notifications.find({
        "user_id": current_user["user_id"],
        "read": False
    }).sort("created_at", -1).to_list(50)
    
    return {"notifications": clean_mongo_docs(notifications), "count": len(notifications)}

@api_router.post("/notifications/mark-read/{notification_id}")
async def mark_notification_read(request: Request, notification_id: str):
    """Mark a specific notification as read"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.auction_notifications.update_one(
        {"id": notification_id, "user_id": current_user["user_id"]},
        {"$set": {"read": True}}
    )
    
    return {"success": result.modified_count > 0}

@api_router.post("/notifications/test")
async def send_test_notification(request: Request):
    """Send a test notification to the user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    notification = {
        "id": str(uuid.uuid4())[:8],
        "user_id": current_user["user_id"],
        "type": "test",
        "title": "Test Notification",
        "body": "This is a test notification from Luna Group VIP!",
        "data": {},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.auction_notifications.insert_one(notification)
    
    return {"success": True, "notification": clean_mongo_doc(notification)}


# ====== EMAIL NOTIFICATIONS API (Mock for Development) ======

class CrewInviteEmailRequest(BaseModel):
    crew_id: str
    invitee_email: str
    invitee_name: Optional[str] = None
    message: Optional[str] = None

@api_router.post("/crews/{crew_id}/send-invite-email")
async def send_crew_invite_email(request: Request, crew_id: str, email_req: CrewInviteEmailRequest):
    """Send an email invitation to join a crew (Mock for development)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Get the crew
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    # Get the inviter's details
    inviter = await db.users.find_one({"user_id": current_user["user_id"]})
    inviter_name = inviter.get("name", "A Luna Member") if inviter else "A Luna Member"
    
    # Get the target event/auction
    event = None
    auction = None
    if crew.get("event_id"):
        event = await db.events.find_one({"id": crew["event_id"]})
    if crew.get("target_auction"):
        auction = await db.auctions.find_one({"id": crew["target_auction"]})
    
    # Create the invite record
    invite_token = str(uuid.uuid4())[:12]
    invite = {
        "id": str(uuid.uuid4())[:8],
        "token": invite_token,
        "crew_id": crew_id,
        "crew_name": crew.get("name", "Unnamed Crew"),
        "email": email_req.invitee_email,
        "invitee_name": email_req.invitee_name,
        "invited_by": current_user["user_id"],
        "inviter_name": inviter_name,
        "message": email_req.message,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7)
    }
    await db.crew_invites.insert_one(invite)
    
    # Mock email content (in production, this would send a real email via SendGrid/Resend/etc.)
    invite_link = f"lunagroup://crew-invite/{invite_token}"
    email_content = {
        "to": email_req.invitee_email,
        "from": "noreply@lunagroup.vip",
        "subject": f"🌙 {inviter_name} invited you to join their crew on Luna Group!",
        "body": f"""
Hey{' ' + email_req.invitee_name if email_req.invitee_name else ''}!

{inviter_name} wants you to join their crew "{crew.get('name', 'Party Crew')}" on Luna Group VIP!

{f"They're planning to attend: {event['title']}" if event else ""}
{f"They're bidding on: {auction['title']}" if auction else ""}
{f"Message: {email_req.message}" if email_req.message else ""}

Join the crew to:
✨ Split booth costs with friends
✨ Coordinate entry times
✨ Share VIP perks

Tap here to join: {invite_link}

See you at the club!
- Luna Group Team
        """,
        "invite_link": invite_link
    }
    
    # Store the email record (mock - no actual email sent)
    email_record = {
        "id": str(uuid.uuid4())[:8],
        "type": "crew_invite",
        "invite_id": invite["id"],
        "email_content": email_content,
        "sent_at": datetime.now(timezone.utc),
        "status": "mock_sent"  # In production: "sent", "delivered", "opened"
    }
    await db.sent_emails.insert_one(email_record)
    
    logger.info(f"[MOCK EMAIL] Would send crew invite to {email_req.invitee_email}")
    
    return {
        "success": True,
        "message": f"Invite sent to {email_req.invitee_email}!",
        "invite": clean_mongo_doc(invite),
        "email_preview": email_content,
        "mock": True  # Indicates this is a development mock
    }

@api_router.get("/crews/invite/{token}")
async def get_invite_by_token(token: str):
    """Get invite details by token (for accepting invites)"""
    invite = await db.crew_invites.find_one({"token": token})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or expired")
    
    if invite.get("status") != "pending":
        raise HTTPException(status_code=400, detail=f"Invite already {invite.get('status')}")
    
    if datetime.now(timezone.utc) > invite.get("expires_at", datetime.now(timezone.utc)):
        raise HTTPException(status_code=400, detail="Invite has expired")
    
    crew = await db.crews.find_one({"id": invite["crew_id"]})
    
    return {
        "invite": clean_mongo_doc(invite),
        "crew": clean_mongo_doc(crew) if crew else None
    }

@api_router.post("/crews/invite/{token}/accept")
async def accept_invite_by_token(request: Request, token: str):
    """Accept a crew invite using the token"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    invite = await db.crew_invites.find_one({"token": token, "status": "pending"})
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found or already used")
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    # Add user to crew
    member = {
        "user_id": current_user["user_id"],
        "name": user.get("name", "Member"),
        "role": "member",
        "status": "confirmed",
        "joined_at": datetime.now(timezone.utc)
    }
    
    await db.crews.update_one(
        {"id": invite["crew_id"]},
        {"$push": {"members": member}}
    )
    
    # Update invite status
    await db.crew_invites.update_one(
        {"token": token},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "message": "You've joined the crew!"}

@api_router.post("/crews/invite/{token}/decline")
async def decline_invite_by_token(request: Request, token: str):
    """Decline a crew invite"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.crew_invites.update_one(
        {"token": token, "status": "pending"},
        {"$set": {"status": "declined", "declined_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "message": "Invite declined"}

@api_router.get("/crews/{crew_id}/pending-invites")
async def get_pending_invites(request: Request, crew_id: str):
    """Get all pending invites for a crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    invites = await db.crew_invites.find({
        "crew_id": crew_id,
        "status": "pending"
    }).to_list(50)
    
    return {"invites": clean_mongo_docs(invites)}


# ====== SPLIT PAYMENTS API ======

class SplitPaymentRequest(BaseModel):
    crew_id: str
    auction_id: str
    total_amount: float
    splits: List[Dict[str, Any]]  # [{user_id, amount, email}]

@api_router.post("/payments/create-split-payment")
async def create_split_payment(request: Request, split_req: SplitPaymentRequest):
    """Create a split payment for a crew auction bid"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Validate crew and auction
    crew = await db.crews.find_one({"id": split_req.crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    auction = await db.auctions.find_one({"id": split_req.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Calculate deposit for each split (10% of their share, min $25 each)
    split_payments = []
    for split in split_req.splits:
        deposit = max(int(split["amount"] * 0.10 * 100), 2500)  # cents
        
        # Mock payment intent for demo
        mock_intent_id = f"pi_split_demo_{str(uuid.uuid4())[:8]}"
        
        split_payment = {
            "id": str(uuid.uuid4())[:8],
            "crew_id": split_req.crew_id,
            "auction_id": split_req.auction_id,
            "user_id": split.get("user_id"),
            "email": split.get("email"),
            "share_amount": split["amount"],
            "deposit_amount": deposit / 100,
            "payment_intent_id": mock_intent_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        await db.split_payments.insert_one(split_payment)
        split_payments.append(split_payment)
    
    # Create a master split record
    master_split = {
        "id": str(uuid.uuid4())[:8],
        "crew_id": split_req.crew_id,
        "auction_id": split_req.auction_id,
        "total_amount": split_req.total_amount,
        "total_deposit": sum(s["deposit_amount"] for s in split_payments),
        "initiated_by": current_user["user_id"],
        "splits": [clean_mongo_doc(s) for s in split_payments],
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.master_splits.insert_one(master_split)
    
    return {
        "success": True,
        "message": "Split payment created!",
        "master_split": clean_mongo_doc(master_split),
        "individual_splits": clean_mongo_docs(split_payments),
        "testMode": True
    }

@api_router.get("/crews/{crew_id}/split-status")
async def get_split_status(request: Request, crew_id: str):
    """Get the current split payment status for a crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    master_split = await db.master_splits.find_one({
        "crew_id": crew_id,
        "status": {"$in": ["pending", "partial", "complete"]}
    })
    
    if not master_split:
        return {"split": None}
    
    return {"split": clean_mongo_doc(master_split)}


# ====== SUBSCRIPTION MANAGEMENT API ======

@api_router.get("/subscriptions/tiers")
async def get_subscription_tiers():
    """Get all available subscription tiers"""
    return {
        "tiers": list(SUBSCRIPTION_TIERS.values()),
        "entry_venues": ENTRY_CHARGING_VENUES
    }

@api_router.get("/subscriptions/my")
async def get_my_subscription(request: Request):
    """Get current user's subscription"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    subscription = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    
    if not subscription:
        # Return default free tier
        return {
            "subscription": None,
            "tier": SUBSCRIPTION_TIERS["lunar"],
            "is_subscribed": False
        }
    
    tier_info = SUBSCRIPTION_TIERS.get(subscription.get("tier_id"), SUBSCRIPTION_TIERS["lunar"])
    
    return {
        "subscription": clean_mongo_doc(subscription),
        "tier": tier_info,
        "is_subscribed": True
    }

class SubscribeRequest(BaseModel):
    tier_id: str
    payment_method_id: Optional[str] = None

@api_router.post("/subscriptions/subscribe")
async def subscribe_to_tier(request: Request, sub_req: SubscribeRequest):
    """Subscribe to a tier (Mock for development)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    if sub_req.tier_id not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    tier = SUBSCRIPTION_TIERS[sub_req.tier_id]
    
    # Cancel any existing subscription
    await db.subscriptions.update_many(
        {"user_id": current_user["user_id"], "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": datetime.now(timezone.utc)}}
    )
    
    # Create new subscription
    subscription = {
        "id": str(uuid.uuid4())[:8],
        "user_id": current_user["user_id"],
        "tier_id": sub_req.tier_id,
        "tier_name": tier["name"],
        "price": tier["price"],
        "status": "active",
        "billing_period": tier["billing_period"],
        "current_period_start": datetime.now(timezone.utc),
        "current_period_end": datetime.now(timezone.utc) + timedelta(days=30),
        "free_entries_remaining": tier["benefits"]["free_entries_per_month"],
        "created_at": datetime.now(timezone.utc),
        "mock": True  # Demo mode
    }
    await db.subscriptions.insert_one(subscription)
    
    # Update user's tier
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"subscription_tier": sub_req.tier_id}}
    )
    
    return {
        "success": True,
        "message": f"Welcome to {tier['name']}! 🌙",
        "subscription": clean_mongo_doc(subscription),
        "tier": tier,
        "mock": True
    }

@api_router.post("/subscriptions/cancel")
async def cancel_subscription(request: Request):
    """Cancel current subscription"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.subscriptions.update_one(
        {"user_id": current_user["user_id"], "status": "active"},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc),
            "cancel_at_period_end": True
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="No active subscription found")
    
    return {"success": True, "message": "Subscription will be cancelled at end of billing period"}

@api_router.post("/subscriptions/use-entry")
async def use_free_entry(request: Request, venue_id: str):
    """Use a free entry from subscription"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    subscription = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    
    if not subscription:
        raise HTTPException(status_code=400, detail="No active subscription")
    
    tier = SUBSCRIPTION_TIERS.get(subscription.get("tier_id"), SUBSCRIPTION_TIERS["lunar"])
    
    # Check if unlimited (-1) or has remaining entries
    remaining = subscription.get("free_entries_remaining", 0)
    if remaining == 0:
        raise HTTPException(status_code=400, detail="No free entries remaining this month")
    
    # Check if venue charges entry
    if venue_id not in ENTRY_CHARGING_VENUES:
        raise HTTPException(status_code=400, detail="This venue doesn't charge entry")
    
    # Deduct entry (unless unlimited)
    if remaining > 0:
        await db.subscriptions.update_one(
            {"id": subscription["id"]},
            {"$inc": {"free_entries_remaining": -1}}
        )
    
    # Log the entry usage
    entry_log = {
        "id": str(uuid.uuid4())[:8],
        "user_id": current_user["user_id"],
        "subscription_id": subscription["id"],
        "venue_id": venue_id,
        "type": "free_entry",
        "used_at": datetime.now(timezone.utc)
    }
    await db.subscription_usage.insert_one(entry_log)
    
    new_remaining = remaining - 1 if remaining > 0 else -1  # -1 = unlimited
    
    return {
        "success": True,
        "message": "Free entry applied!",
        "entries_remaining": new_remaining,
        "unlimited": remaining == -1
    }


# ====== POINTS SYSTEM API ======

async def award_points(user_id: str, amount_spent: float, source: str, source_id: str):
    """Award points to a user based on spending"""
    # Get user's subscription for multiplier
    subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active"
    })
    
    multiplier = 1.0
    if subscription:
        tier = SUBSCRIPTION_TIERS.get(subscription.get("tier_id"), SUBSCRIPTION_TIERS["lunar"])
        multiplier = tier.get("points_multiplier", 1.0)
    
    # Calculate points: $1 = 1 point * multiplier
    base_points = int(amount_spent * POINTS_PER_DOLLAR)
    bonus_points = int(base_points * (multiplier - 1))
    total_points = base_points + bonus_points
    
    # Create transaction record
    transaction = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "type": "earn",
        "source": source,  # "auction_bid", "booking", "subscription", "purchase"
        "source_id": source_id,
        "amount_spent": amount_spent,
        "base_points": base_points,
        "bonus_points": bonus_points,
        "multiplier": multiplier,
        "total_points": total_points,
        "created_at": datetime.now(timezone.utc)
    }
    await db.points_transactions.insert_one(transaction)
    
    # Update user's points balance
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"points_balance": total_points}}
    )
    
    return {
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier
    }

@api_router.get("/points/balance")
async def get_points_balance(request: Request):
    """Get current points balance and recent transactions"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    # Get recent transactions
    transactions = await db.points_transactions.find({
        "user_id": current_user["user_id"]
    }).sort("created_at", -1).limit(20).to_list(20)
    
    # Get subscription multiplier
    subscription = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    
    multiplier = 1.0
    tier_name = "Lunar"
    if subscription:
        tier = SUBSCRIPTION_TIERS.get(subscription.get("tier_id"), SUBSCRIPTION_TIERS["lunar"])
        multiplier = tier.get("points_multiplier", 1.0)
        tier_name = tier.get("name", "Lunar")
    
    return {
        "balance": user.get("points_balance", 0) if user else 0,
        "multiplier": multiplier,
        "tier": tier_name,
        "recent_transactions": clean_mongo_docs(transactions),
        "points_per_dollar": POINTS_PER_DOLLAR
    }

@api_router.get("/points/history")
async def get_points_history(request: Request, limit: int = 50):
    """Get full points history"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    transactions = await db.points_transactions.find({
        "user_id": current_user["user_id"]
    }).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate totals
    total_earned = sum(t.get("total_points", 0) for t in transactions if t.get("type") == "earn")
    total_spent = sum(abs(t.get("total_points", 0)) for t in transactions if t.get("type") == "redeem")
    
    return {
        "transactions": clean_mongo_docs(transactions),
        "total_earned": total_earned,
        "total_spent": total_spent,
        "net_points": total_earned - total_spent
    }

class RecordSpendingRequest(BaseModel):
    amount: float
    source: str  # "auction", "booking", "bar_tab", "merchandise", "subscription"
    source_id: Optional[str] = None
    venue_id: Optional[str] = None
    description: Optional[str] = None

@api_router.post("/points/record-spending")
async def record_spending_and_award_points(request: Request, spend_req: RecordSpendingRequest):
    """Record spending and award points"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    source_id = spend_req.source_id or str(uuid.uuid4())[:8]
    
    # Award points
    points_result = await award_points(
        user_id=current_user["user_id"],
        amount_spent=spend_req.amount,
        source=spend_req.source,
        source_id=source_id
    )
    
    return {
        "success": True,
        "message": f"You earned {points_result['total_points']} points!",
        "amount_spent": spend_req.amount,
        **points_result
    }

@api_router.post("/points/simulate-purchase")
async def simulate_purchase(request: Request, amount: float, description: str = "Test Purchase"):
    """Simulate a purchase for testing points earning (Demo only)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    source_id = f"demo_{str(uuid.uuid4())[:6]}"
    
    # Award points
    points_result = await award_points(
        user_id=current_user["user_id"],
        amount_spent=amount,
        source="demo_purchase",
        source_id=source_id
    )
    
    return {
        "success": True,
        "message": f"Demo: You spent ${amount:.2f} and earned {points_result['total_points']} points!",
        "amount_spent": amount,
        "description": description,
        **points_result,
        "demo": True
    }


# ====== SAFETY & LOCATION TRACKING API ======

# In-memory store for live locations (in production, use Redis)
live_locations: Dict[str, Dict] = {}

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None

class SafetyAlertRequest(BaseModel):
    alert_type: str  # "emergency", "uncomfortable", "need_help", "lost"
    latitude: float
    longitude: float
    venue_id: Optional[str] = None
    crew_id: Optional[str] = None
    message: Optional[str] = None

@api_router.post("/location/update")
async def update_location(request: Request, location: LocationUpdate):
    """Update user's live location"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    location_data = {
        "user_id": current_user["user_id"],
        "name": user.get("name", "Unknown") if user else "Unknown",
        "latitude": location.latitude,
        "longitude": location.longitude,
        "accuracy": location.accuracy,
        "heading": location.heading,
        "speed": location.speed,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Store in memory for real-time access
    live_locations[current_user["user_id"]] = location_data
    
    # Also persist to database
    await db.user_locations.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": location_data},
        upsert=True
    )
    
    return {"success": True, "message": "Location updated"}

@api_router.get("/location/me")
async def get_my_location(request: Request):
    """Get user's last known location"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Try memory first, then database
    if current_user["user_id"] in live_locations:
        return {"location": live_locations[current_user["user_id"]]}
    
    location = await db.user_locations.find_one({"user_id": current_user["user_id"]})
    return {"location": clean_mongo_doc(location) if location else None}

@api_router.get("/location/crew/{crew_id}")
async def get_crew_locations(request: Request, crew_id: str):
    """Get live locations of all crew members"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Get crew members
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    # Check if user is a member
    member_ids = [m.get("user_id") for m in crew.get("members", [])]
    if current_user["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Not a member of this crew")
    
    # Get locations for all members
    locations = []
    for member in crew.get("members", []):
        member_id = member.get("user_id")
        
        # Try live memory first
        if member_id in live_locations:
            loc = live_locations[member_id].copy()
            loc["is_live"] = True
            locations.append(loc)
        else:
            # Fall back to database
            db_loc = await db.user_locations.find_one({"user_id": member_id})
            if db_loc:
                loc = clean_mongo_doc(db_loc)
                loc["is_live"] = False
                locations.append(loc)
            else:
                # No location data, add placeholder
                locations.append({
                    "user_id": member_id,
                    "name": member.get("name", "Unknown"),
                    "latitude": None,
                    "longitude": None,
                    "is_live": False,
                    "no_location": True
                })
    
    return {
        "crew_id": crew_id,
        "crew_name": crew.get("name", "Crew"),
        "members": locations,
        "count": len(locations)
    }

@api_router.post("/safety/alert")
async def send_safety_alert(request: Request, alert: SafetyAlertRequest):
    """Send a safety alert to venue and/or crew members"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    user_name = user.get("name", "A member") if user else "A member"
    
    # Create the alert record
    alert_record = {
        "id": str(uuid.uuid4())[:8],
        "user_id": current_user["user_id"],
        "user_name": user_name,
        "alert_type": alert.alert_type,
        "latitude": alert.latitude,
        "longitude": alert.longitude,
        "venue_id": alert.venue_id,
        "crew_id": alert.crew_id,
        "message": alert.message,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "acknowledged_by": [],
        "resolved_at": None
    }
    await db.safety_alerts.insert_one(alert_record)
    
    # Get alert type description
    alert_types = {
        "emergency": "🚨 EMERGENCY - Needs immediate help",
        "uncomfortable": "⚠️ Feeling uncomfortable",
        "need_help": "🆘 Needs assistance",
        "lost": "📍 Lost/separated from group"
    }
    alert_desc = alert_types.get(alert.alert_type, "Needs help")
    
    notified_users = []
    notified_venues = []
    
    # Notify crew members if crew_id provided
    if alert.crew_id:
        crew = await db.crews.find_one({"id": alert.crew_id})
        if crew:
            for member in crew.get("members", []):
                member_id = member.get("user_id")
                if member_id and member_id != current_user["user_id"]:
                    # Create notification for crew member
                    notification = {
                        "id": str(uuid.uuid4())[:8],
                        "user_id": member_id,
                        "type": "safety_alert",
                        "alert_id": alert_record["id"],
                        "title": f"🚨 {user_name} needs help!",
                        "body": f"{alert_desc}. Tap to see their location.",
                        "data": {
                            "alert_id": alert_record["id"],
                            "latitude": alert.latitude,
                            "longitude": alert.longitude,
                            "alert_type": alert.alert_type
                        },
                        "read": False,
                        "created_at": datetime.now(timezone.utc)
                    }
                    await db.safety_notifications.insert_one(notification)
                    notified_users.append(member.get("name", member_id))
    
    # Notify venue if venue_id provided
    if alert.venue_id:
        venue = await db.venues.find_one({"id": alert.venue_id})
        if venue:
            # Create venue alert (in production, this would alert staff devices)
            venue_alert = {
                "id": str(uuid.uuid4())[:8],
                "venue_id": alert.venue_id,
                "venue_name": venue.get("name", "Venue"),
                "alert_id": alert_record["id"],
                "user_name": user_name,
                "alert_type": alert.alert_type,
                "latitude": alert.latitude,
                "longitude": alert.longitude,
                "message": alert.message,
                "status": "pending",
                "created_at": datetime.now(timezone.utc)
            }
            await db.venue_alerts.insert_one(venue_alert)
            notified_venues.append(venue.get("name", "Venue"))
    
    return {
        "success": True,
        "alert_id": alert_record["id"],
        "message": "Safety alert sent!",
        "notified_crew_members": notified_users,
        "notified_venues": notified_venues,
        "alert": clean_mongo_doc(alert_record)
    }

@api_router.get("/safety/alerts/active")
async def get_active_safety_alerts(request: Request):
    """Get active safety alerts for crews user is part of"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Get user's crews
    crews = await db.crews.find({
        "members.user_id": current_user["user_id"]
    }).to_list(20)
    
    crew_ids = [c.get("id") for c in crews]
    
    # Get active alerts for these crews
    alerts = await db.safety_alerts.find({
        "status": "active",
        "$or": [
            {"crew_id": {"$in": crew_ids}},
            {"user_id": current_user["user_id"]}
        ]
    }).sort("created_at", -1).to_list(20)
    
    return {"alerts": clean_mongo_docs(alerts)}

@api_router.post("/safety/alerts/{alert_id}/acknowledge")
async def acknowledge_safety_alert(request: Request, alert_id: str):
    """Acknowledge a safety alert (mark as seen/responding)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    user_name = user.get("name", "Unknown") if user else "Unknown"
    
    await db.safety_alerts.update_one(
        {"id": alert_id},
        {"$push": {"acknowledged_by": {
            "user_id": current_user["user_id"],
            "name": user_name,
            "at": datetime.now(timezone.utc)
        }}}
    )
    
    return {"success": True, "message": "Alert acknowledged"}

@api_router.post("/safety/alerts/{alert_id}/resolve")
async def resolve_safety_alert(request: Request, alert_id: str):
    """Mark a safety alert as resolved"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.safety_alerts.update_one(
        {"id": alert_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc),
            "resolved_by": current_user["user_id"]
        }}
    )
    
    return {"success": True, "message": "Alert resolved"}

@api_router.get("/safety/notifications")
async def get_safety_notifications(request: Request):
    """Get safety-related notifications for user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    notifications = await db.safety_notifications.find({
        "user_id": current_user["user_id"],
        "read": False
    }).sort("created_at", -1).to_list(20)
    
    return {"notifications": clean_mongo_docs(notifications)}

@api_router.post("/location/share/{crew_id}")
async def toggle_location_sharing(request: Request, crew_id: str, enabled: bool = True):
    """Enable/disable location sharing with a crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.location_sharing.update_one(
        {"user_id": current_user["user_id"], "crew_id": crew_id},
        {"$set": {
            "user_id": current_user["user_id"],
            "crew_id": crew_id,
            "enabled": enabled,
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"Location sharing {'enabled' if enabled else 'disabled'} for this crew"
    }


# ====== VIP TABLE BOOKING API ======

class TableBookingRequest(BaseModel):
    venue_id: str
    table_id: str
    date: str  # YYYY-MM-DD
    party_size: int
    special_requests: Optional[str] = None
    contact_phone: Optional[str] = None

class TableDepositRequest(BaseModel):
    booking_id: str
    payment_method_id: Optional[str] = None

# Table configurations per venue
VIP_TABLES = {
    "eclipse": [
        {
            "id": "eclipse_vip_1",
            "name": "VIP Booth 1",
            "location": "Main Room - Elevated",
            "capacity": 6,
            "min_spend": 500,
            "deposit_amount": 200,
            "features": ["Premium Sound", "Bottle Service", "Dedicated Host", "City Views"],
            "image_url": "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=600"
        },
        {
            "id": "eclipse_vip_2",
            "name": "VIP Booth 2",
            "location": "Main Room - Stage View",
            "capacity": 8,
            "min_spend": 800,
            "deposit_amount": 300,
            "features": ["Best DJ View", "Bottle Service", "Dedicated Host", "VIP Entry"],
            "image_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600"
        },
        {
            "id": "eclipse_skybox",
            "name": "The Skybox",
            "location": "Upper Level - Private",
            "capacity": 12,
            "min_spend": 2000,
            "deposit_amount": 800,
            "features": ["Private Area", "Dedicated Bar", "2 Hosts", "Exclusive Entry", "Premium Spirits"],
            "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600"
        },
        {
            "id": "eclipse_owners",
            "name": "Owner's Suite",
            "location": "Exclusive Level",
            "capacity": 20,
            "min_spend": 5000,
            "deposit_amount": 2000,
            "features": ["Ultra-Private", "Personal Chef", "Unlimited Premium", "Helicopter Transfer Option", "Concierge"],
            "image_url": "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600"
        }
    ],
    "after_dark": [
        {
            "id": "afterdark_booth_1",
            "name": "R&B Lounge Booth",
            "location": "Main Floor",
            "capacity": 6,
            "min_spend": 400,
            "deposit_amount": 150,
            "features": ["Bottle Service", "Dedicated Host", "Dance Floor Access"],
            "image_url": "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=600"
        },
        {
            "id": "afterdark_vip",
            "name": "VIP Section",
            "location": "Elevated Platform",
            "capacity": 10,
            "min_spend": 1000,
            "deposit_amount": 400,
            "features": ["Private Area", "Premium Bottles", "VIP Entry", "Dedicated Server"],
            "image_url": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600"
        }
    ],
    "su_casa_brisbane": [
        {
            "id": "sucasa_rooftop_1",
            "name": "Rooftop Cabana",
            "location": "Rooftop - Poolside",
            "capacity": 8,
            "min_spend": 600,
            "deposit_amount": 250,
            "features": ["City Views", "Pool Access", "Bottle Service", "Daybed Seating"],
            "image_url": "https://images.unsplash.com/photo-1613066697301-d7dccfc86bb5?w=600"
        },
        {
            "id": "sucasa_penthouse",
            "name": "Penthouse Lounge",
            "location": "Top Floor",
            "capacity": 15,
            "min_spend": 2500,
            "deposit_amount": 1000,
            "features": ["360° Views", "Private Bar", "Chef's Table Option", "VIP Elevator"],
            "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600"
        }
    ],
    "juju": [
        {
            "id": "juju_sunset",
            "name": "Sunset Booth",
            "location": "Ocean View Terrace",
            "capacity": 6,
            "min_spend": 500,
            "deposit_amount": 200,
            "features": ["Ocean Views", "Sunset Hours", "Seafood Platter Included", "Champagne Service"],
            "image_url": "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600"
        },
        {
            "id": "juju_beach",
            "name": "Beachfront Private",
            "location": "Ground Level - Beach Access",
            "capacity": 10,
            "min_spend": 1500,
            "deposit_amount": 600,
            "features": ["Direct Beach Access", "Private Area", "Full Menu Access", "Dedicated Staff"],
            "image_url": "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=600"
        }
    ]
}

@api_router.get("/venues/{venue_id}/tables")
async def get_venue_tables(venue_id: str, date: Optional[str] = None):
    """Get available VIP tables for a venue"""
    if venue_id not in VIP_TABLES:
        # Return empty list for venues without table service
        return {"tables": [], "message": "This venue doesn't offer table booking"}
    
    tables = VIP_TABLES[venue_id]
    
    # Check availability for specific date
    if date:
        # Get existing bookings for this date
        bookings = await db.table_bookings.find({
            "venue_id": venue_id,
            "date": date,
            "status": {"$in": ["confirmed", "pending"]}
        }).to_list(100)
        
        booked_table_ids = {b["table_id"] for b in bookings}
        
        # Mark availability
        for table in tables:
            table["available"] = table["id"] not in booked_table_ids
    else:
        for table in tables:
            table["available"] = True
    
    return {"tables": tables, "venue_id": venue_id}

@api_router.post("/bookings/table")
async def create_table_booking(request: Request, booking: TableBookingRequest):
    """Create a VIP table booking"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Validate venue and table
    if booking.venue_id not in VIP_TABLES:
        raise HTTPException(status_code=400, detail="Venue doesn't offer table service")
    
    table = next((t for t in VIP_TABLES[booking.venue_id] if t["id"] == booking.table_id), None)
    if not table:
        raise HTTPException(status_code=400, detail="Table not found")
    
    # Check capacity
    if booking.party_size > table["capacity"]:
        raise HTTPException(status_code=400, detail=f"Party size exceeds table capacity of {table['capacity']}")
    
    # Check availability
    existing = await db.table_bookings.find_one({
        "venue_id": booking.venue_id,
        "table_id": booking.table_id,
        "date": booking.date,
        "status": {"$in": ["confirmed", "pending"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Table not available for this date")
    
    booking_id = f"TBL-{str(uuid.uuid4())[:8].upper()}"
    
    booking_doc = {
        "booking_id": booking_id,
        "user_id": current_user["user_id"],
        "user_name": current_user.get("name", current_user["email"]),
        "user_email": current_user["email"],
        "venue_id": booking.venue_id,
        "venue_name": LUNA_VENUES.get(booking.venue_id, {}).get("name", booking.venue_id),
        "table_id": booking.table_id,
        "table_name": table["name"],
        "table_location": table["location"],
        "date": booking.date,
        "party_size": booking.party_size,
        "min_spend": table["min_spend"],
        "deposit_amount": table["deposit_amount"],
        "deposit_paid": False,
        "deposit_payment_id": None,
        "special_requests": booking.special_requests,
        "contact_phone": booking.contact_phone,
        "status": "pending",  # pending -> confirmed (after deposit) -> completed/cancelled
        "features": table["features"],
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=24)  # Must pay deposit within 24h
    }
    
    await db.table_bookings.insert_one(booking_doc)
    
    # Create notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "table_booking",
        "title": "Table Booking Created! 🎉",
        "message": f"Your {table['name']} at {booking_doc['venue_name']} is reserved for {booking.date}. Pay your ${table['deposit_amount']} deposit within 24 hours to confirm.",
        "data": {"booking_id": booking_id},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "booking": {k: v for k, v in booking_doc.items() if k != "_id"},
        "message": f"Table reserved! Pay ${table['deposit_amount']} deposit to confirm."
    }

@api_router.post("/bookings/table/{booking_id}/deposit")
async def pay_table_deposit(request: Request, booking_id: str):
    """Create payment intent for table deposit"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    booking = await db.table_bookings.find_one({
        "booking_id": booking_id,
        "user_id": current_user["user_id"]
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["deposit_paid"]:
        raise HTTPException(status_code=400, detail="Deposit already paid")
    
    if booking["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Booking was cancelled")
    
    # Create Stripe Payment Intent
    try:
        if STRIPE_SECRET_KEY.startswith('sk_test_demo'):
            # Demo mode - simulate payment
            payment_intent_id = f"pi_demo_{uuid.uuid4().hex[:16]}"
            client_secret = f"demo_secret_{uuid.uuid4().hex[:24]}"
            
            return {
                "success": True,
                "client_secret": client_secret,
                "payment_intent_id": payment_intent_id,
                "amount": booking["deposit_amount"],
                "currency": "aud",
                "demo_mode": True,
                "message": "Demo mode - use test card 4242424242424242"
            }
        else:
            # Real Stripe
            payment_intent = stripe.PaymentIntent.create(
                amount=int(booking["deposit_amount"] * 100),  # cents
                currency="aud",
                metadata={
                    "booking_id": booking_id,
                    "user_id": current_user["user_id"],
                    "type": "table_deposit"
                }
            )
            
            return {
                "success": True,
                "client_secret": payment_intent.client_secret,
                "payment_intent_id": payment_intent.id,
                "amount": booking["deposit_amount"],
                "currency": "aud"
            }
    except Exception as e:
        logging.error(f"Stripe error: {e}")
        raise HTTPException(status_code=500, detail="Payment processing error")

@api_router.post("/bookings/table/{booking_id}/confirm")
async def confirm_table_booking(request: Request, booking_id: str, payment_intent_id: str):
    """Confirm table booking after successful payment"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    booking = await db.table_bookings.find_one({
        "booking_id": booking_id,
        "user_id": current_user["user_id"]
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Update booking
    await db.table_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "deposit_paid": True,
            "deposit_payment_id": payment_intent_id,
            "status": "confirmed",
            "confirmed_at": datetime.now(timezone.utc)
        }}
    )
    
    # Award points for booking
    points_earned = int(booking["deposit_amount"] * 2)  # 2 points per dollar on deposits
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"points_balance": points_earned}}
    )
    
    # Create confirmation notification
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "table_confirmed",
        "title": "Table Confirmed! ✅",
        "message": f"Your {booking['table_name']} is confirmed for {booking['date']}. You earned {points_earned} points!",
        "data": {"booking_id": booking_id, "points_earned": points_earned},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "success": True,
        "message": "Table booking confirmed!",
        "points_earned": points_earned,
        "booking_id": booking_id
    }

@api_router.get("/bookings/my-tables")
async def get_my_table_bookings(request: Request):
    """Get user's table bookings"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    bookings = await db.table_bookings.find({
        "user_id": current_user["user_id"]
    }).sort("created_at", -1).to_list(50)
    
    return {"bookings": clean_mongo_docs(bookings)}

@api_router.delete("/bookings/table/{booking_id}")
async def cancel_table_booking(request: Request, booking_id: str):
    """Cancel a table booking"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    booking = await db.table_bookings.find_one({
        "booking_id": booking_id,
        "user_id": current_user["user_id"]
    })
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if booking["status"] == "completed":
        raise HTTPException(status_code=400, detail="Cannot cancel completed booking")
    
    # Check cancellation policy (24h before)
    booking_date = datetime.strptime(booking["date"], "%Y-%m-%d")
    if booking["deposit_paid"] and datetime.now() > booking_date - timedelta(hours=24):
        raise HTTPException(status_code=400, detail="Cannot cancel within 24 hours - deposit is non-refundable")
    
    await db.table_bookings.update_one(
        {"booking_id": booking_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"success": True, "message": "Booking cancelled"}


# ====== SMART NOTIFICATIONS API ======

class NotificationPreferences(BaseModel):
    events_nearby: bool = True
    favorite_venues: bool = True
    price_drops: bool = True
    friends_attending: bool = True
    auction_alerts: bool = True
    points_expiring: bool = False
    new_rewards: bool = True
    weekly_digest: bool = True
    push_enabled: bool = True
    email_enabled: bool = False
    quiet_hours_start: Optional[str] = "23:00"  # HH:MM
    quiet_hours_end: Optional[str] = "09:00"

@api_router.get("/notifications")
async def get_notifications(request: Request, unread_only: bool = False, limit: int = 50):
    """Get user notifications"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    query = {"user_id": current_user["user_id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Count unread
    unread_count = await db.notifications.count_documents({
        "user_id": current_user["user_id"],
        "read": False
    })
    
    return {
        "notifications": clean_mongo_docs(notifications),
        "unread_count": unread_count
    }

@api_router.post("/notifications/{notification_id}/read")
async def mark_notification_read(request: Request, notification_id: str):
    """Mark a notification as read"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["user_id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True}

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.notifications.update_many(
        {"user_id": current_user["user_id"], "read": False},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "marked_read": result.modified_count}

@api_router.get("/notifications/preferences")
async def get_notification_preferences(request: Request):
    """Get user's notification preferences"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    prefs = await db.notification_preferences.find_one({"user_id": current_user["user_id"]})
    
    if not prefs:
        # Return defaults
        return NotificationPreferences().dict()
    
    return {k: v for k, v in prefs.items() if k not in ["_id", "user_id"]}

@api_router.post("/notifications/preferences")
async def update_notification_preferences(request: Request, prefs: NotificationPreferences):
    """Update user's notification preferences"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    prefs_doc = prefs.dict()
    prefs_doc["user_id"] = current_user["user_id"]
    prefs_doc["updated_at"] = datetime.now(timezone.utc)
    
    await db.notification_preferences.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": prefs_doc},
        upsert=True
    )
    
    return {"success": True, "preferences": prefs.dict()}

@api_router.get("/notifications/smart-suggestions")
async def get_smart_suggestions(request: Request):
    """Get personalized event/venue suggestions based on user behavior"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    suggestions = []
    now = datetime.now(timezone.utc)
    
    # Get user's check-in history
    checkins = await db.checkins.find({"user_id": current_user["user_id"]}).to_list(100)
    venue_visits = {}
    for c in checkins:
        venue_visits[c.get("venue_id", "")] = venue_visits.get(c.get("venue_id", ""), 0) + 1
    
    # Get upcoming events
    events = await db.events.find({
        "event_date": {"$gte": now}
    }).sort("event_date", 1).to_list(20)
    
    # Smart suggestion logic
    favorite_venues = user.get("favorite_venues", [])
    top_visited = sorted(venue_visits.items(), key=lambda x: x[1], reverse=True)[:3]
    top_venue_ids = [v[0] for v in top_visited]
    
    for event in events:
        score = 0
        reasons = []
        
        # Favorite venue
        if event.get("venue_id") in favorite_venues:
            score += 30
            reasons.append("At your favorite venue")
        
        # Frequently visited
        if event.get("venue_id") in top_venue_ids:
            score += 20
            reasons.append("You visit here often")
        
        # Featured event
        if event.get("featured"):
            score += 15
            reasons.append("Featured event")
        
        # This weekend
        event_date = event.get("event_date")
        if event_date and (event_date - now).days <= 3:
            score += 10
            reasons.append("Happening soon")
        
        # Has featured artist
        if event.get("featured_artist"):
            score += 10
            reasons.append(f"Featuring {event['featured_artist'].get('name', 'special guest')}")
        
        if score > 0:
            suggestions.append({
                "type": "event",
                "event": {k: v for k, v in event.items() if k != "_id"},
                "score": score,
                "reasons": reasons
            })
    
    # Sort by score
    suggestions.sort(key=lambda x: x["score"], reverse=True)
    
    # Also add venue suggestions for venues they haven't tried
    all_venue_ids = set(LUNA_VENUES.keys())
    unvisited = all_venue_ids - set(venue_visits.keys())
    
    for venue_id in list(unvisited)[:2]:
        venue = LUNA_VENUES.get(venue_id, {})
        if venue:
            suggestions.append({
                "type": "venue_discovery",
                "venue": {
                    "id": venue_id,
                    "name": venue.get("name"),
                    "location": venue.get("location"),
                    "description": venue.get("description"),
                    "image_url": venue.get("image_url")
                },
                "score": 5,
                "reasons": ["Discover something new", "You haven't visited yet"]
            })
    
    return {
        "suggestions": suggestions[:10],
        "generated_at": now.isoformat()
    }

@api_router.post("/notifications/send-test")
async def send_test_notification(request: Request):
    """Send a test notification to the user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    notification = {
        "id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "type": "test",
        "title": "Test Notification 🔔",
        "message": "This is a test notification from Luna Group. If you see this, notifications are working!",
        "data": {},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.notifications.insert_one(notification)
    
    return {"success": True, "notification": {k: v for k, v in notification.items() if k != "_id"}}


# ====== MEGATIX EVENT SYNC API ======

# Megatix venue search terms
MEGATIX_VENUE_SEARCHES = {
    "eclipse": ["Eclipse Brisbane", "Eclipse+", "Luna+Saturday"],
    "after_dark": ["After Dark Brisbane", "After+Dark+Eclipse"],
    "su_casa_brisbane": ["Su Casa Brisbane", "Su+Casa+Rooftop"],
    "juju": ["Juju Mermaid", "Juju+Gold+Coast"],
}

@api_router.get("/admin/megatix/sync-status")
async def get_megatix_sync_status():
    """Get the status of Megatix event synchronization"""
    last_sync = await db.system_config.find_one({"key": "megatix_last_sync"})
    
    return {
        "last_sync": last_sync.get("value") if last_sync else None,
        "venues_configured": list(MEGATIX_VENUE_SEARCHES.keys()),
        "megatix_base_url": "https://megatix.com.au/events",
        "note": "Events are synced from Megatix ticketing platform"
    }

@api_router.post("/admin/megatix/sync")
async def sync_megatix_events():
    """
    Sync events from Megatix. 
    Since Megatix doesn't have a public API, this endpoint provides 
    a manual sync mechanism where events can be added/updated.
    
    In production, you would:
    1. Use a web scraping service (Apify, ScrapingBee) 
    2. Or integrate with Megatix's partner API (requires business agreement)
    3. Or use a scheduled job to fetch and parse their event pages
    """
    try:
        import httpx
        
        synced_events = []
        errors = []
        
        # For each venue, try to fetch events from Megatix
        for venue_id, search_terms in MEGATIX_VENUE_SEARCHES.items():
            for search_term in search_terms[:1]:  # Just use first search term
                try:
                    # Megatix search URL
                    url = f"https://megatix.com.au/events?search={search_term}"
                    
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        response = await client.get(url, follow_redirects=True)
                        
                        if response.status_code == 200:
                            # Parse the response - in production you'd extract event data
                            # For now, we log that we can reach Megatix
                            synced_events.append({
                                "venue_id": venue_id,
                                "search_term": search_term,
                                "status": "reachable",
                                "note": "Megatix page accessible - manual event entry required"
                            })
                        else:
                            errors.append({
                                "venue_id": venue_id,
                                "error": f"HTTP {response.status_code}"
                            })
                except Exception as e:
                    errors.append({
                        "venue_id": venue_id,
                        "error": str(e)
                    })
        
        # Update last sync time
        await db.system_config.update_one(
            {"key": "megatix_last_sync"},
            {"$set": {"value": datetime.now(timezone.utc).isoformat(), "key": "megatix_last_sync"}},
            upsert=True
        )
        
        return {
            "success": True,
            "message": "Megatix sync check completed",
            "synced": synced_events,
            "errors": errors,
            "recommendation": "For automated syncing, integrate with a web scraping service or Megatix partner API",
            "megatix_urls": {
                venue: f"https://megatix.com.au/events?search={terms[0]}"
                for venue, terms in MEGATIX_VENUE_SEARCHES.items()
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "recommendation": "Install httpx package or use manual event entry"
        }

@api_router.post("/admin/events/add")
async def add_event_manually(
    venue_id: str,
    title: str,
    description: str,
    event_date: str,  # ISO format
    ticket_price: float = 0,
    ticket_url: Optional[str] = None,
    image_url: Optional[str] = None,
    category: str = "club_night",
    featured: bool = False,
    featured_artist_name: Optional[str] = None,
    featured_artist_bio: Optional[str] = None
):
    """Manually add an event (for admin use)"""
    
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=400, detail=f"Unknown venue: {venue_id}")
    
    venue = LUNA_VENUES[venue_id]
    
    event = {
        "id": str(uuid.uuid4()),
        "venue_id": venue_id,
        "venue_name": venue["name"],
        "title": title,
        "description": description,
        "event_date": datetime.fromisoformat(event_date.replace('Z', '+00:00')),
        "event_end_date": datetime.fromisoformat(event_date.replace('Z', '+00:00')) + timedelta(hours=6),
        "ticket_url": ticket_url,
        "ticket_price": ticket_price,
        "image_url": image_url or "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800",
        "category": category,
        "featured": featured,
        "featured_artist": {
            "name": featured_artist_name,
            "bio": featured_artist_bio,
            "image": "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400"
        } if featured_artist_name else None,
        "source": "manual",
        "created_at": datetime.now(timezone.utc),
        "active": True
    }
    
    await db.events.insert_one(event)
    
    return {
        "success": True,
        "event": {k: v for k, v in event.items() if k != "_id"},
        "message": f"Event '{title}' added to {venue['name']}"
    }

@api_router.get("/admin/events/megatix-urls")
async def get_megatix_urls():
    """Get Megatix URLs for each venue for manual checking"""
    return {
        "venues": {
            venue_id: {
                "name": LUNA_VENUES[venue_id]["name"],
                "megatix_search_url": f"https://megatix.com.au/events?search={MEGATIX_VENUE_SEARCHES.get(venue_id, [''])[0]}",
                "direct_venue_url": f"https://megatix.com.au/venues/{venue_id}" if venue_id == "eclipse" else None
            }
            for venue_id in MEGATIX_VENUE_SEARCHES.keys()
        },
        "main_search": "https://megatix.com.au/events?search=Luna+Group",
        "note": "Check these URLs regularly to add new events manually, or integrate with a scraping service"
    }


# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Luna Group VIP API", "venues": len(LUNA_VENUES)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
