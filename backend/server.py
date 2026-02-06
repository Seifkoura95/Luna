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


# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Luna Group VIP API", "venues": len(LUNA_VENUES)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
