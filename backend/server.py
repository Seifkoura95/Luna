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
import asyncio
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import httpx
from bs4 import BeautifulSoup

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

# ====== SCHEDULER SETUP ======
scheduler = AsyncIOScheduler()

# Placeholder for the sync function - will be set later
_megatix_sync_func = None
_notification_gen_func = None

def set_megatix_sync_func(func):
    """Set the megatix sync function for the scheduler"""
    global _megatix_sync_func
    _megatix_sync_func = func

def set_notification_gen_func(func):
    """Set the notification generation function for the scheduler"""
    global _notification_gen_func
    _notification_gen_func = func

async def run_scheduled_sync():
    """Wrapper to call the megatix sync function"""
    global _megatix_sync_func
    if _megatix_sync_func:
        logging.info("Running scheduled Megatix sync...")
        try:
            result = await _megatix_sync_func()
            logging.info(f"Scheduled sync completed: {result.get('message', 'done')}")
        except Exception as e:
            logging.error(f"Scheduled sync failed: {str(e)}")

async def run_scheduled_notifications():
    """Wrapper to call the notification generation function"""
    global _notification_gen_func
    if _notification_gen_func:
        logging.info("Running scheduled notification generation...")
        try:
            result = await _notification_gen_func()
            logging.info(f"Notification generation completed: {result} notifications created")
        except Exception as e:
            logging.error(f"Notification generation failed: {str(e)}")

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    """Application lifespan handler - manages scheduler startup/shutdown"""
    global _megatix_sync_func
    
    # Startup
    logging.info("Starting Luna Group VIP API with scheduler...")
    
    # Schedule Megatix sync every 12 hours
    scheduler.add_job(
        run_scheduled_sync,
        IntervalTrigger(hours=12),
        id="megatix_sync",
        name="Megatix Event Sync",
        replace_existing=True
    )
    
    # Schedule notification generation every 6 hours
    scheduler.add_job(
        run_scheduled_notifications,
        IntervalTrigger(hours=6),
        id="notification_generation",
        name="Notification Generation",
        replace_existing=True
    )
    
    # Also run a sync on startup (after 90 seconds to let everything initialize)
    scheduler.add_job(
        run_scheduled_sync,
        'date',
        run_date=datetime.now(timezone.utc) + timedelta(seconds=90),
        id="megatix_startup_sync",
        name="Megatix Startup Sync"
    )
    
    scheduler.start()
    logging.info("Event scheduler started - Megatix sync every 12 hours, notifications every 6 hours")
    
    yield
    
    # Shutdown
    logging.info("Shutting down scheduler...")
    scheduler.shutdown()

# Create app with lifespan
app = FastAPI(title="Luna Group VIP API", lifespan=lifespan)
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
    referral_code: Optional[str] = None  # Optional referral code

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class PushTokenRequest(BaseModel):
    push_token: str

# Email verification token expiry (24 hours)
EMAIL_VERIFICATION_EXPIRY_HOURS = 24

def generate_verification_token():
    """Generate a secure verification token"""
    return secrets.token_urlsafe(32)

async def send_verification_email(email: str, name: str, token: str):
    """
    Send verification email to user.
    In production, this would use SendGrid, AWS SES, or similar service.
    For now, we log the verification link.
    """
    verification_link = f"https://lunagroup.app/verify-email?token={token}"
    logging.info(f"📧 Verification email for {email}:")
    logging.info(f"   Link: {verification_link}")
    
    # In production, integrate with email service:
    # await sendgrid.send_email(
    #     to=email,
    #     subject="Verify your Luna Group account",
    #     html=f"Hi {name}, click here to verify: {verification_link}"
    # )
    
    return verification_link

@api_router.post("/auth/register")
async def register(request: RegisterRequest):
    existing = await db.users.find_one({"email": request.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate referral code if provided
    referrer = None
    if request.referral_code:
        referrer = await db.users.find_one({"referral_code": request.referral_code.upper()})
        if not referrer:
            raise HTTPException(status_code=400, detail="Invalid referral code")
    
    hashed = bcrypt.hashpw(request.password.encode(), bcrypt.gensalt())
    user_id = str(uuid.uuid4())
    
    # Generate email verification token
    verification_token = generate_verification_token()
    verification_expiry = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
    
    user = {
        "user_id": user_id,
        "email": request.email,
        "hashed_password": hashed.decode(),
        "name": request.name,
        "tier": "bronze",
        "points_balance": 500,
        "home_region": "brisbane",
        "favorite_venues": [],
        "referred_by": referrer["user_id"] if referrer else None,
        "email_verified": False,  # Requires verification
        "email_verification_token": verification_token,
        "email_verification_expiry": verification_expiry,
        "push_token": None,  # Set when user enables push notifications
        "created_at": datetime.now(timezone.utc)
    }
    await db.users.insert_one(user)
    
    # Create referral record if code was provided (pending until email verified)
    if referrer:
        referral = {
            "id": str(uuid.uuid4())[:8],
            "referrer_user_id": referrer["user_id"],
            "referrer_name": referrer.get("name", "Luna Member"),
            "referred_user_id": user_id,
            "referred_name": request.name,
            "referral_code": request.referral_code.upper(),
            "status": "pending",
            "created_at": datetime.now(timezone.utc)
        }
        await db.referrals.insert_one(referral)
    
    # Send verification email
    verification_link = await send_verification_email(request.email, request.name, verification_token)
    
    token_payload = {
        "user_id": user_id,
        "email": request.email,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRY_DAYS)
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # Remove sensitive fields
    user_copy = {k: v for k, v in user.items() if k not in ["hashed_password", "_id", "email_verification_token"]}
    
    return {
        "user": user_copy,
        "token": token,
        "verification_required": True,
        "message": "Please check your email to verify your account",
        # Include link for demo purposes (remove in production)
        "demo_verification_link": verification_link
    }

@api_router.post("/auth/verify-email")
async def verify_email(token: str):
    """Verify user's email address using the token sent via email"""
    user = await db.users.find_one({"email_verification_token": token})
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    
    # Check if token has expired
    expiry = user.get("email_verification_expiry")
    if expiry and datetime.now(timezone.utc) > expiry:
        raise HTTPException(status_code=400, detail="Verification token has expired. Please request a new one.")
    
    # Already verified
    if user.get("email_verified"):
        return {"success": True, "message": "Email already verified"}
    
    # Mark email as verified
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$set": {
                "email_verified": True,
                "email_verified_at": datetime.now(timezone.utc)
            },
            "$unset": {
                "email_verification_token": "",
                "email_verification_expiry": ""
            }
        }
    )
    
    # Complete any pending referral
    referral_completed = await complete_referral(user["user_id"])
    
    response = {
        "success": True,
        "message": "Email verified successfully! Welcome to Luna Group.",
        "user_id": user["user_id"]
    }
    
    if referral_completed:
        response["referral_bonus"] = f"You and your friend each earned {REFERRAL_POINTS_REWARD} points!"
    
    return response

@api_router.post("/auth/resend-verification")
async def resend_verification_email(request: Request):
    """Resend verification email for unverified users"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("email_verified"):
        return {"success": True, "message": "Email already verified"}
    
    # Generate new verification token
    verification_token = generate_verification_token()
    verification_expiry = datetime.now(timezone.utc) + timedelta(hours=EMAIL_VERIFICATION_EXPIRY_HOURS)
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {
            "email_verification_token": verification_token,
            "email_verification_expiry": verification_expiry
        }}
    )
    
    # Send new verification email
    verification_link = await send_verification_email(user["email"], user["name"], verification_token)
    
    return {
        "success": True,
        "message": "Verification email sent",
        "demo_verification_link": verification_link  # Remove in production
    }

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
    notify_outbid: bool = True  # Opt-in for outbid notifications

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
    
    # Record bid with notification preference
    await db.bids.insert_one({
        "id": str(uuid.uuid4()),
        "auction_id": bid_request.auction_id,
        "user_id": user["user_id"],
        "user_name": user["name"],
        "amount": bid_request.amount,
        "max_bid": bid_request.max_bid,
        "notify_outbid": bid_request.notify_outbid,
        "timestamp": datetime.now(timezone.utc)
    })
    
    # Store user's notification preference for this auction
    if bid_request.notify_outbid:
        await db.auction_notification_preferences.update_one(
            {"user_id": user["user_id"], "auction_id": bid_request.auction_id},
            {"$set": {
                "user_id": user["user_id"],
                "auction_id": bid_request.auction_id,
                "notify_outbid": True,
                "updated_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
    
    # Notify previous winner they've been outbid
    if previous_winner_id and previous_winner_id != user["user_id"]:
        # Check if previous winner wants notifications
        prev_user_pref = await db.auction_notification_preferences.find_one({
            "user_id": previous_winner_id,
            "auction_id": bid_request.auction_id
        })
        
        should_notify = prev_user_pref.get("notify_outbid", True) if prev_user_pref else True
        
        if should_notify:
            # Create notification record
            notification_id = str(uuid.uuid4())
            await db.auction_notifications.insert_one({
                "id": notification_id,
                "user_id": previous_winner_id,
                "auction_id": bid_request.auction_id,
                "auction_title": auction["title"],
                "type": "outbid",
                "message": f"You've been outbid on {auction['title']}! Current bid: ${bid_request.amount}",
                "new_bid": bid_request.amount,
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })
            
            # Send push notification to outbid user
            prev_user = await db.users.find_one({"user_id": previous_winner_id})
            if prev_user and prev_user.get("push_tokens"):
                push_tokens = prev_user.get("push_tokens", [])
                for token in push_tokens:
                    try:
                        await send_push_notification_to_token(
                            token,
                            title="🔔 You've Been Outbid!",
                            body=f"Someone bid ${bid_request.amount} on {auction['title']}. Bid now to stay ahead!",
                            data={
                                "type": "outbid",
                                "auction_id": bid_request.auction_id,
                                "new_bid": bid_request.amount
                            }
                        )
                        logging.info(f"Sent outbid push notification to {previous_winner_id}")
                    except Exception as e:
                        logging.error(f"Failed to send push notification: {e}")
    
    updated_auction = await db.auctions.find_one({"id": bid_request.auction_id})
    return {"message": "Bid placed successfully!", "auction": clean_mongo_doc(updated_auction)}

@api_router.get("/auctions/{auction_id}/bids")
async def get_auction_bids(auction_id: str):
    """Get bid history for an auction"""
    bids = await db.bids.find({"auction_id": auction_id}).sort("timestamp", -1).to_list(50)
    return clean_mongo_docs(bids)

# ====== PHOTOS API ======

# Venue folder mapping
VENUE_PHOTO_FOLDERS = {
    "eclipse": "eclipse",
    "after_dark": "afterdark",
    "su_casa_brisbane": "sucasa-brisbane",
    "su_casa_gold_coast": "sucasa-goldcoast",
}

@api_router.get("/photos")
async def get_user_photos(request: Request, venue_id: Optional[str] = None):
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    query = {"tagged_users": current_user["user_id"]}
    if venue_id:
        query["venue_id"] = venue_id
    photos = await db.photos.find(query).sort("created_at", -1).to_list(100)
    return clean_mongo_docs(photos)

@api_router.get("/photos/venues")
async def get_venue_galleries():
    """Get list of all venue photo galleries with counts"""
    galleries = []
    photos_dir = ROOT_DIR / "static" / "photos"
    
    for venue_id, folder_name in VENUE_PHOTO_FOLDERS.items():
        folder_path = photos_dir / folder_name
        if folder_path.exists():
            photos = list(folder_path.glob("*.jpg")) + list(folder_path.glob("*.jpeg")) + list(folder_path.glob("*.png"))
            
            # Get venue info
            venue = LUNA_VENUES.get(venue_id, {})
            
            galleries.append({
                "venue_id": venue_id,
                "venue_name": venue.get("name", venue_id),
                "folder": folder_name,
                "photo_count": len(photos),
                "cover_image": f"/api/photos/image/{folder_name}/{photos[0].name}" if photos else None,
                "accent_color": venue.get("accent_color", "#E31837"),
            })
    
    return galleries

@api_router.get("/photos/venue/{venue_id}")
async def get_venue_photos(venue_id: str):
    """Get all photos for a specific venue"""
    folder_name = VENUE_PHOTO_FOLDERS.get(venue_id)
    if not folder_name:
        raise HTTPException(status_code=404, detail="Venue gallery not found")
    
    photos_dir = ROOT_DIR / "static" / "photos" / folder_name
    if not photos_dir.exists():
        return []
    
    photos = []
    for ext in ["*.jpg", "*.jpeg", "*.png"]:
        for photo_path in photos_dir.glob(ext):
            photos.append({
                "id": photo_path.stem,
                "filename": photo_path.name,
                "url": f"/api/photos/image/{folder_name}/{photo_path.name}",
                "venue_id": venue_id,
                "likes": 0,  # Would be stored in DB in production
                "tagged": [],  # Would be stored in DB in production
            })
    
    return photos

@api_router.get("/photos/image/{folder}/{filename}")
async def serve_photo(folder: str, filename: str):
    """Serve a photo file"""
    from fastapi.responses import FileResponse
    
    # Validate folder exists in our mapping
    valid_folders = list(VENUE_PHOTO_FOLDERS.values())
    if folder not in valid_folders:
        raise HTTPException(status_code=404, detail="Invalid folder")
    
    photo_path = ROOT_DIR / "static" / "photos" / folder / filename
    if not photo_path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return FileResponse(
        photo_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"}
    )


# ====== REFERRAL SYSTEM ======

REFERRAL_POINTS_REWARD = 10  # Points awarded when referred friend signs up

@api_router.get("/referral/code")
async def get_referral_code(request: Request):
    """Get or generate user's unique referral code"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user already has a referral code
    if user.get("referral_code"):
        referral_code = user["referral_code"]
    else:
        # Generate unique referral code (username-based or random)
        name_part = (user.get("name", "LUNA")[:4]).upper().replace(" ", "")
        random_part = secrets.token_hex(3).upper()
        referral_code = f"{name_part}{random_part}"
        
        # Save to user
        await db.users.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": {"referral_code": referral_code}}
        )
    
    # Get referral stats
    successful_referrals = await db.referrals.count_documents({
        "referrer_user_id": current_user["user_id"],
        "status": "completed"
    })
    
    pending_referrals = await db.referrals.count_documents({
        "referrer_user_id": current_user["user_id"],
        "status": "pending"
    })
    
    total_points_earned = successful_referrals * REFERRAL_POINTS_REWARD
    
    return {
        "referral_code": referral_code,
        "referral_link": f"https://lunagroup.app/join?ref={referral_code}",
        "stats": {
            "successful_referrals": successful_referrals,
            "pending_referrals": pending_referrals,
            "total_points_earned": total_points_earned,
            "points_per_referral": REFERRAL_POINTS_REWARD
        }
    }

@api_router.get("/referral/history")
async def get_referral_history(request: Request):
    """Get user's referral history"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    referrals = await db.referrals.find({
        "referrer_user_id": current_user["user_id"]
    }).sort("created_at", -1).to_list(50)
    
    return {
        "referrals": clean_mongo_docs(referrals),
        "total": len(referrals)
    }

@api_router.post("/referral/apply")
async def apply_referral_code(referral_code: str, request: Request):
    """Apply a referral code for a new user (called during registration)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Check if user has already used a referral code
    existing = await db.referrals.find_one({
        "referred_user_id": current_user["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already used a referral code")
    
    # Find the referrer
    referrer = await db.users.find_one({"referral_code": referral_code.upper()})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    # Can't refer yourself
    if referrer["user_id"] == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot use your own referral code")
    
    # Create pending referral
    referral = {
        "id": str(uuid.uuid4())[:8],
        "referrer_user_id": referrer["user_id"],
        "referrer_name": referrer.get("name", "Luna Member"),
        "referred_user_id": current_user["user_id"],
        "referral_code": referral_code.upper(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.referrals.insert_one(referral)
    
    return {
        "success": True,
        "message": f"Referral code applied! {referrer.get('name', 'Your friend')} will receive {REFERRAL_POINTS_REWARD} points once you're verified.",
        "referral": clean_mongo_doc(referral)
    }

async def complete_referral(referred_user_id: str):
    """
    Complete a referral and award points to the referrer.
    Called automatically when a referred user is verified/completes signup.
    """
    # Find pending referral for this user
    referral = await db.referrals.find_one({
        "referred_user_id": referred_user_id,
        "status": "pending"
    })
    
    if not referral:
        return None  # No pending referral
    
    # Update referral status
    await db.referrals.update_one(
        {"_id": referral["_id"]},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc)
        }}
    )
    
    # Award points to referrer
    await db.users.update_one(
        {"user_id": referral["referrer_user_id"]},
        {"$inc": {"points_balance": REFERRAL_POINTS_REWARD}}
    )
    
    # Create notification for referrer
    await create_notification(
        user_id=referral["referrer_user_id"],
        notification_type="referral",
        title="Referral Bonus! 🎉",
        message=f"Your friend just joined Luna! You earned {REFERRAL_POINTS_REWARD} points.",
        data={
            "points_earned": REFERRAL_POINTS_REWARD,
            "referral_id": referral["id"]
        },
        priority="high"
    )
    
    logging.info(f"Referral completed: {referral['referrer_user_id']} earned {REFERRAL_POINTS_REWARD} points")
    
    return referral

@api_router.post("/referral/verify/{user_id}")
async def verify_and_complete_referral(user_id: str, request: Request):
    """
    Admin endpoint to verify a user and complete their referral.
    In production, this would be triggered by email verification or first purchase.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # For demo purposes, allow any authenticated user to trigger this
    # In production, this would be admin-only or automatic
    
    result = await complete_referral(user_id)
    
    if result:
        return {
            "success": True,
            "message": f"Referral completed! {result['referrer_name']} earned {REFERRAL_POINTS_REWARD} points.",
            "referral": clean_mongo_doc(result)
        }
    else:
        return {
            "success": False,
            "message": "No pending referral found for this user"
        }


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


# ====== USER ACCOUNT MANAGEMENT API ======

@api_router.delete("/user/delete")
async def delete_user_account(request: Request):
    """Delete user account and all associated data (App Store requirement)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]
    
    # Delete all user-related data from all collections
    deletion_results = {}
    
    # Core user data
    result = await db.users.delete_one({"user_id": user_id})
    deletion_results["user"] = result.deleted_count
    
    # Tickets
    result = await db.tickets.delete_many({"user_id": user_id})
    deletion_results["tickets"] = result.deleted_count
    
    # Bookings
    result = await db.bookings.delete_many({"user_id": user_id})
    deletion_results["bookings"] = result.deleted_count
    
    # Guestlist entries
    result = await db.guestlist.delete_many({"user_id": user_id})
    deletion_results["guestlist"] = result.deleted_count
    
    # Redemptions
    result = await db.redemptions.delete_many({"user_id": user_id})
    deletion_results["redemptions"] = result.deleted_count
    
    # Referrals (both as referrer and referred)
    result = await db.referrals.delete_many({"$or": [
        {"referrer_user_id": user_id},
        {"referred_user_id": user_id}
    ]})
    deletion_results["referrals"] = result.deleted_count
    
    # Crews (remove from members or delete if owner)
    await db.crews.update_many(
        {"members.user_id": user_id},
        {"$pull": {"members": {"user_id": user_id}}}
    )
    result = await db.crews.delete_many({"owner_id": user_id})
    deletion_results["crews_owned"] = result.deleted_count
    
    # Notifications
    result = await db.notifications.delete_many({"user_id": user_id})
    deletion_results["notifications"] = result.deleted_count
    
    # Push tokens
    result = await db.push_tokens.delete_many({"user_id": user_id})
    deletion_results["push_tokens"] = result.deleted_count
    
    # Auction notifications and preferences
    await db.auction_notifications.delete_many({"user_id": user_id})
    await db.auction_notification_preferences.delete_many({"user_id": user_id})
    
    # Bids
    result = await db.bids.delete_many({"user_id": user_id})
    deletion_results["bids"] = result.deleted_count
    
    # Incident reports
    result = await db.incidents.delete_many({"user_id": user_id})
    deletion_results["incidents"] = result.deleted_count
    
    # Lost property reports
    result = await db.lost_property.delete_many({"user_id": user_id})
    deletion_results["lost_property"] = result.deleted_count
    
    # Crew invites
    await db.crew_invites.delete_many({"$or": [
        {"invited_by": user_id},
        {"email": current_user.get("email")}
    ]})
    
    # Table bookings
    result = await db.table_bookings.delete_many({"user_id": user_id})
    deletion_results["table_bookings"] = result.deleted_count
    
    logging.info(f"Account deleted for user {user_id}: {deletion_results}")
    
    return {
        "success": True,
        "message": "Your account and all associated data have been permanently deleted.",
        "deletion_summary": deletion_results
    }


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


# ====== SMART NOTIFICATIONS SYSTEM ======

class NotificationPreferences(BaseModel):
    events_nearby: bool = True
    favorite_venues: bool = True
    auction_alerts: bool = True
    friends_attending: bool = True
    new_rewards: bool = True
    weekly_digest: bool = True
    event_reminders: bool = True
    booking_updates: bool = True
    crew_updates: bool = True
    points_milestones: bool = True

# Main notifications collection (separate from auction_notifications for clarity)
# Using 'notifications' collection for the unified notification system

@api_router.get("/notifications")
async def get_all_notifications(
    request: Request,
    unread_only: bool = False,
    limit: int = 50
):
    """Get all notifications for the current user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    query = {"user_id": current_user["user_id"]}
    if unread_only:
        query["read"] = False
    
    # Fetch from both collections for unified view
    notifications = await db.notifications.find(query).sort("created_at", -1).to_list(limit)
    auction_notifs = await db.auction_notifications.find(query).sort("created_at", -1).to_list(limit)
    
    # Combine and sort
    all_notifications = notifications + auction_notifs
    all_notifications.sort(key=lambda x: x.get("created_at", datetime.min), reverse=True)
    all_notifications = all_notifications[:limit]
    
    # Count unread
    unread_count = sum(1 for n in all_notifications if not n.get("read", True))
    
    return {
        "notifications": clean_mongo_docs(all_notifications),
        "unread_count": unread_count,
        "total": len(all_notifications)
    }

@api_router.post("/notifications/{notification_id}/read")
async def mark_single_notification_read(request: Request, notification_id: str):
    """Mark a single notification as read"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Try both collections
    result1 = await db.notifications.update_one(
        {"id": notification_id, "user_id": current_user["user_id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    result2 = await db.auction_notifications.update_one(
        {"id": notification_id, "user_id": current_user["user_id"]},
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": result1.modified_count > 0 or result2.modified_count > 0}

@api_router.post("/notifications/read-all")
async def mark_all_notifications_read(request: Request):
    """Mark all notifications as read for the current user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    now = datetime.now(timezone.utc)
    result1 = await db.notifications.update_many(
        {"user_id": current_user["user_id"], "read": False},
        {"$set": {"read": True, "read_at": now}}
    )
    result2 = await db.auction_notifications.update_many(
        {"user_id": current_user["user_id"], "read": False},
        {"$set": {"read": True, "read_at": now}}
    )
    
    return {
        "success": True,
        "marked_read": result1.modified_count + result2.modified_count
    }

@api_router.get("/notifications/preferences")
async def get_notification_preferences(request: Request):
    """Get user's notification preferences"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    prefs = await db.notification_preferences.find_one({"user_id": current_user["user_id"]})
    
    if not prefs:
        # Return defaults
        return {
            "events_nearby": True,
            "favorite_venues": True,
            "auction_alerts": True,
            "friends_attending": True,
            "new_rewards": True,
            "weekly_digest": True,
            "event_reminders": True,
            "booking_updates": True,
            "crew_updates": True,
            "points_milestones": True
        }
    
    return clean_mongo_doc(prefs)

@api_router.post("/notifications/preferences")
async def update_notification_preferences(request: Request, prefs: NotificationPreferences):
    """Update user's notification preferences"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    prefs_dict = prefs.dict()
    prefs_dict["user_id"] = current_user["user_id"]
    prefs_dict["updated_at"] = datetime.now(timezone.utc)
    
    await db.notification_preferences.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": prefs_dict},
        upsert=True
    )
    
    return {"success": True, "preferences": prefs_dict}

@api_router.get("/notifications/smart-suggestions")
async def get_smart_suggestions(request: Request):
    """
    Generate smart suggestions based on user behavior and preferences.
    This is the AI-powered recommendation engine.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    suggestions = []
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    if not user:
        return {"suggestions": [], "generated_at": datetime.now(timezone.utc).isoformat()}
    
    # Get user's preferences
    prefs = await db.notification_preferences.find_one({"user_id": current_user["user_id"]})
    
    # Get user's past bookings to understand preferences
    bookings = await db.bookings.find({"user_id": current_user["user_id"]}).to_list(20)
    past_venues = [b.get("venue_id") for b in bookings if b.get("venue_id")]
    
    # Get user's favorite venues (most visited)
    venue_counts = {}
    for venue in past_venues:
        venue_counts[venue] = venue_counts.get(venue, 0) + 1
    favorite_venues = sorted(venue_counts.keys(), key=lambda x: venue_counts[x], reverse=True)[:3]
    
    # Get upcoming events
    now = datetime.now(timezone.utc)
    upcoming_events = await db.events.find({
        "date": {"$gte": now},
        "status": {"$in": ["upcoming", "on_sale"]}
    }).sort("date", 1).to_list(50)
    
    # 1. Events at favorite venues
    for event in upcoming_events[:20]:
        if event.get("venue_id") in favorite_venues:
            reasons = [
                f"You've been to {LUNA_VENUES.get(event['venue_id'], {}).get('name', event['venue_id'])} before",
                "One of your favorite spots"
            ]
            suggestions.append({
                "type": "event",
                "event": clean_mongo_doc(event),
                "venue": LUNA_VENUES.get(event.get("venue_id")),
                "reasons": reasons,
                "score": 0.9,
                "priority": "high"
            })
    
    # 2. Events matching user tier benefits
    user_tier = user.get("membership_tier", "lunar")
    if user_tier in ["eclipse", "supernova"]:
        for event in upcoming_events[:10]:
            if event.get("featured") or event.get("vip_available"):
                if not any(s.get("event", {}).get("id") == event.get("id") for s in suggestions):
                    reasons = [
                        f"VIP access with your {user_tier.title()} membership",
                        "Priority entry available"
                    ]
                    suggestions.append({
                        "type": "event",
                        "event": clean_mongo_doc(event),
                        "venue": LUNA_VENUES.get(event.get("venue_id")),
                        "reasons": reasons,
                        "score": 0.8,
                        "priority": "medium"
                    })
    
    # 3. Weekend events (most popular)
    for event in upcoming_events:
        event_date = event.get("date")
        if event_date and isinstance(event_date, datetime):
            if event_date.weekday() in [4, 5]:  # Friday, Saturday
                if not any(s.get("event", {}).get("id") == event.get("id") for s in suggestions):
                    reasons = [
                        "Popular weekend event",
                        "Great atmosphere expected"
                    ]
                    suggestions.append({
                        "type": "event",
                        "event": clean_mongo_doc(event),
                        "venue": LUNA_VENUES.get(event.get("venue_id")),
                        "reasons": reasons,
                        "score": 0.7,
                        "priority": "medium"
                    })
                    if len(suggestions) >= 10:
                        break
    
    # 4. Venue suggestions (if user hasn't been to all venues)
    visited_venues = set(past_venues)
    for venue_id, venue in LUNA_VENUES.items():
        if venue_id not in visited_venues and len(suggestions) < 12:
            if venue.get("type") in ["nightclub", "bar"]:
                reasons = [
                    "You haven't visited yet",
                    f"Known for {venue.get('music_genres', ['great vibes'])[0] if venue.get('music_genres') else 'great vibes'}"
                ]
                suggestions.append({
                    "type": "venue",
                    "venue": venue,
                    "reasons": reasons,
                    "score": 0.6,
                    "priority": "low"
                })
    
    # Sort by score
    suggestions.sort(key=lambda x: x.get("score", 0), reverse=True)
    
    return {
        "suggestions": suggestions[:10],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "user_tier": user_tier,
        "favorite_venues": favorite_venues
    }

@api_router.post("/notifications/send-test")
async def send_test_notification_v2(request: Request):
    """Send a test notification to the current user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    notification = {
        "id": str(uuid.uuid4())[:8],
        "user_id": current_user["user_id"],
        "type": "test",
        "title": "Test Notification",
        "message": "This is a test notification from Luna Group VIP! Your notifications are working correctly.",
        "data": {"test": True},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    return {"success": True, "notification": clean_mongo_doc(notification)}


# ====== PUSH NOTIFICATIONS ======

async def send_push_notification_to_token(token: str, title: str, body: str, data: dict = None):
    """
    Send a push notification to a specific Expo push token.
    Returns True if sent successfully, False otherwise.
    """
    push_url = "https://exp.host/--/api/v2/push/send"
    
    message = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {},
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                push_url,
                json=message,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("data", {}).get("status") == "ok":
                    logging.info(f"Push notification sent to token")
                    return True
        return False
    except Exception as e:
        logging.error(f"Failed to send push notification: {e}")
        return False

async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """
    Send a push notification to a user's device using Expo Push API.
    Returns True if sent successfully, False otherwise.
    """
    user = await db.users.find_one({"user_id": user_id})
    if not user or not user.get("push_token"):
        return False
    
    push_token = user["push_token"]
    
    # Expo Push API endpoint
    push_url = "https://exp.host/--/api/v2/push/send"
    
    message = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {},
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                push_url,
                json=message,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("data", {}).get("status") == "ok":
                    logging.info(f"Push notification sent to {user_id}")
                    return True
                else:
                    logging.warning(f"Push notification failed: {result}")
            else:
                logging.error(f"Push API error: {response.status_code}")
    except Exception as e:
        logging.error(f"Push notification error: {e}")
    
    return False

@api_router.post("/push/register")
async def register_push_token(request: Request, token_request: PushTokenRequest):
    """Register user's push notification token"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"push_token": token_request.push_token}}
    )
    
    return {"success": True, "message": "Push token registered"}

@api_router.delete("/push/unregister")
async def unregister_push_token(request: Request):
    """Remove user's push notification token"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$unset": {"push_token": ""}}
    )
    
    return {"success": True, "message": "Push token removed"}


# ====== NOTIFICATION GENERATION FUNCTIONS ======

async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    data: dict = None,
    priority: str = "normal",
    send_push: bool = True
):
    """Create and store a notification for a user, optionally send push"""
    notification = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "priority": priority,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    # Send push notification for high priority or if explicitly requested
    if send_push and priority in ["high", "medium"]:
        await send_push_notification(user_id, title, message, data)
    
    return notification

async def notify_new_event(event: dict, venue_id: str):
    """
    Notify users about a new event at their favorite venue.
    Called when a new event is added.
    """
    venue = LUNA_VENUES.get(venue_id, {})
    venue_name = venue.get("name", venue_id)
    
    # Find users who have bookings at this venue (interested users)
    interested_users = await db.bookings.distinct(
        "user_id",
        {"venue_id": venue_id}
    )
    
    # Also get users with this venue in favorites (if we track that)
    # For now, notify users who've visited
    
    for user_id in interested_users[:100]:  # Limit to prevent overload
        # Check user preferences
        prefs = await db.notification_preferences.find_one({"user_id": user_id})
        if prefs and not prefs.get("favorite_venues", True):
            continue
        
        await create_notification(
            user_id=user_id,
            notification_type="event",
            title=f"New Event at {venue_name}!",
            message=f"{event.get('title', 'A new event')} is coming up. Get your tickets now!",
            data={
                "event_id": event.get("id"),
                "venue_id": venue_id,
                "action": "view_event"
            },
            priority="high"
        )

async def notify_event_reminder(event: dict, hours_before: int = 24):
    """
    Send reminder notifications for an upcoming event.
    Called by scheduler for events happening soon.
    """
    # Find users with bookings/tickets for this event
    bookings = await db.bookings.find({
        "event_id": event.get("id"),
        "status": {"$in": ["confirmed", "pending"]}
    }).to_list(500)
    
    venue = LUNA_VENUES.get(event.get("venue_id"), {})
    venue_name = venue.get("name", "the venue")
    
    for booking in bookings:
        user_id = booking.get("user_id")
        
        # Check preferences
        prefs = await db.notification_preferences.find_one({"user_id": user_id})
        if prefs and not prefs.get("event_reminders", True):
            continue
        
        await create_notification(
            user_id=user_id,
            notification_type="event",
            title=f"Event Tomorrow: {event.get('title', 'Your Event')}",
            message=f"Don't forget! Your event at {venue_name} is in {hours_before} hours. See you there!",
            data={
                "event_id": event.get("id"),
                "booking_id": booking.get("id"),
                "venue_id": event.get("venue_id"),
                "action": "view_booking"
            }
        )

async def notify_booking_confirmed(booking: dict, user_id: str):
    """Notify user when their booking is confirmed"""
    venue = LUNA_VENUES.get(booking.get("venue_id"), {})
    venue_name = venue.get("name", "the venue")
    
    await create_notification(
        user_id=user_id,
        notification_type="table_confirmed",
        title="Booking Confirmed!",
        message=f"Your booking at {venue_name} has been confirmed. Show this notification at the venue for entry.",
        data={
            "booking_id": booking.get("id"),
            "venue_id": booking.get("venue_id"),
            "action": "view_booking"
        },
        priority="high"
    )

async def notify_crew_invite(crew: dict, invitee_user_id: str, inviter_name: str):
    """Notify user when they're invited to a crew"""
    await create_notification(
        user_id=invitee_user_id,
        notification_type="crew",
        title="Crew Invite!",
        message=f"{inviter_name} invited you to join '{crew.get('name', 'a crew')}' for an upcoming event.",
        data={
            "crew_id": crew.get("id"),
            "action": "view_crew"
        },
        priority="high"
    )

async def notify_crew_update(crew: dict, update_message: str):
    """Notify all crew members about an update"""
    for member in crew.get("members", []):
        user_id = member.get("user_id")
        
        # Check preferences
        prefs = await db.notification_preferences.find_one({"user_id": user_id})
        if prefs and not prefs.get("crew_updates", True):
            continue
        
        await create_notification(
            user_id=user_id,
            notification_type="crew",
            title=f"Crew Update: {crew.get('name', 'Your Crew')}",
            message=update_message,
            data={
                "crew_id": crew.get("id"),
                "action": "view_crew"
            }
        )

async def notify_points_milestone(user_id: str, points: int, milestone: int):
    """Notify user when they reach a points milestone"""
    await create_notification(
        user_id=user_id,
        notification_type="points",
        title=f"Milestone Reached: {milestone} Points!",
        message=f"Congratulations! You've earned {points} points. Keep earning to unlock exclusive rewards!",
        data={
            "points": points,
            "milestone": milestone,
            "action": "view_rewards"
        },
        priority="medium"
    )

async def notify_safety_alert(user_id: str, alert_type: str, message: str):
    """Send safety-related notifications"""
    await create_notification(
        user_id=user_id,
        notification_type="safety",
        title="Safety Update",
        message=message,
        data={
            "alert_type": alert_type,
            "action": "acknowledge"
        },
        priority="high"
    )


# ====== SCHEDULED NOTIFICATION GENERATION ======

async def generate_event_notifications():
    """
    Generate notifications for upcoming events.
    Called periodically by the scheduler.
    """
    now = datetime.now(timezone.utc)
    tomorrow = now + timedelta(days=1)
    next_week = now + timedelta(days=7)
    
    notifications_created = 0
    
    # 1. Events happening tomorrow - send reminders
    tomorrow_events = await db.events.find({
        "date": {
            "$gte": tomorrow - timedelta(hours=12),
            "$lte": tomorrow + timedelta(hours=12)
        }
    }).to_list(50)
    
    for event in tomorrow_events:
        await notify_event_reminder(event, hours_before=24)
        notifications_created += 1
    
    # 2. New events added in the last 24 hours - notify interested users
    recent_events = await db.events.find({
        "created_at": {"$gte": now - timedelta(hours=24)},
        "synced_at": {"$gte": now - timedelta(hours=24)}
    }).to_list(20)
    
    for event in recent_events:
        venue_id = event.get("venue_id")
        if venue_id:
            await notify_new_event(event, venue_id)
            notifications_created += 1
    
    logging.info(f"Generated {notifications_created} event notifications")
    return notifications_created

# Register the event notification generator with the scheduler
async def run_notification_generation():
    """Wrapper for scheduled notification generation"""
    logging.info("Running scheduled notification generation...")
    try:
        count = await generate_event_notifications()
        logging.info(f"Notification generation complete: {count} notifications created")
    except Exception as e:
        logging.error(f"Notification generation failed: {str(e)}")


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
    
    # Award points for subscription purchase (1 point per $1)
    subscription_amount = tier["price"]
    if subscription_amount > 0:
        points_result = await award_points(
            user_id=current_user["user_id"],
            amount_spent=subscription_amount,
            source="subscription",
            source_id=subscription["id"]
        )
        logger.info(f"Awarded {points_result['total_points']} points for subscription purchase")
    
    return {
        "success": True,
        "message": f"Welcome to {tier['name']}! 🌙",
        "subscription": clean_mongo_doc(subscription),
        "tier": tier,
        "points_earned": points_result.get("total_points", 0) if subscription_amount > 0 else 0,
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
    
    # Sync points to CherryHub if member is registered
    try:
        user = await db.users.find_one({"user_id": user_id})
        if user and user.get("cherryhub_member_key"):
            member_key = user["cherryhub_member_key"]
            reason = f"Luna Group App: {source} ({source_id})"
            await cherryhub_service.add_points(member_key, total_points, reason)
            logger.info(f"Synced {total_points} points to CherryHub for user {user_id}")
    except Exception as e:
        logger.error(f"Failed to sync points to CherryHub: {e}")
        # Don't fail the transaction if CherryHub sync fails
    
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
        },
        {
            "id": "juju_rooftop_private",
            "name": "Rooftop Private Dining",
            "location": "Rooftop Level",
            "capacity": 12,
            "min_spend": 2000,
            "deposit_amount": 800,
            "features": ["360° Views", "Private Chef", "Wine Pairing", "Dedicated Wait Staff"],
            "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600"
        }
    ],
    "su_casa_gold_coast": [
        {
            "id": "sucasa_gc_booth_1",
            "name": "VIP Booth",
            "location": "Main Floor - Elevated",
            "capacity": 6,
            "min_spend": 500,
            "deposit_amount": 200,
            "features": ["Bottle Service", "Dance Floor View", "Dedicated Host"],
            "image_url": "https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=600"
        },
        {
            "id": "sucasa_gc_lounge",
            "name": "Surfers Lounge",
            "location": "Mezzanine Level",
            "capacity": 10,
            "min_spend": 1000,
            "deposit_amount": 400,
            "features": ["Private Seating", "Premium Bottles", "VIP Entry", "Ocean Glimpses"],
            "image_url": "https://images.unsplash.com/photo-1571266028243-e4733b0f0bb0?w=600"
        },
        {
            "id": "sucasa_gc_penthouse",
            "name": "Gold Coast Penthouse",
            "location": "Top Floor - Private",
            "capacity": 15,
            "min_spend": 2500,
            "deposit_amount": 1000,
            "features": ["Panoramic Views", "Private Bar", "Concierge Service", "Helicopter Transfer Option"],
            "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600"
        }
    ],
    "night_market": [
        {
            "id": "nm_dragon_room",
            "name": "Dragon Room",
            "location": "Private Dining - Ground Floor",
            "capacity": 8,
            "min_spend": 400,
            "deposit_amount": 150,
            "features": ["Private Dining", "Sharing Menu", "Sake Selection", "Authentic Decor"],
            "image_url": "https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=600"
        },
        {
            "id": "nm_lantern_lounge",
            "name": "Lantern Lounge",
            "location": "Mezzanine - Neon Views",
            "capacity": 12,
            "min_spend": 800,
            "deposit_amount": 300,
            "features": ["Group Seating", "Cocktail Table Service", "Chef's Selection", "Photo Backdrop"],
            "image_url": "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=600"
        },
        {
            "id": "nm_emperor_suite",
            "name": "Emperor's Suite",
            "location": "Top Floor - Exclusive",
            "capacity": 20,
            "min_spend": 2000,
            "deposit_amount": 800,
            "features": ["Private Kitchen Access", "Tasting Menu", "Sake Sommelier", "Karaoke Option"],
            "image_url": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600"
        }
    ],
    "ember_and_ash": [
        {
            "id": "ea_fireside_booth",
            "name": "Fireside Booth",
            "location": "Main Dining - Window",
            "capacity": 4,
            "min_spend": 200,
            "deposit_amount": 50,
            "features": ["Window Seating", "Fireplace View", "Wine Selection", "Intimate Setting"],
            "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600"
        },
        {
            "id": "ea_chef_table",
            "name": "Chef's Table",
            "location": "Kitchen View",
            "capacity": 8,
            "min_spend": 600,
            "deposit_amount": 200,
            "features": ["Kitchen Experience", "Tasting Menu", "Chef Interaction", "Wine Pairing"],
            "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600"
        },
        {
            "id": "ea_private_dining",
            "name": "Private Dining Room",
            "location": "Separate Room - Back",
            "capacity": 16,
            "min_spend": 1500,
            "deposit_amount": 500,
            "features": ["Complete Privacy", "Custom Menu", "AV Equipment", "Private Bar"],
            "image_url": "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600"
        }
    ]
}

@api_router.get("/venues/{venue_id}/tables")
async def get_venue_tables(venue_id: str, date: Optional[str] = None):
    """Get available VIP tables for a venue, respecting opening hours"""
    if venue_id not in VIP_TABLES:
        # Return empty list for venues without table service
        return {"tables": [], "message": "This venue doesn't offer table booking"}
    
    venue = LUNA_VENUES.get(venue_id)
    tables = VIP_TABLES[venue_id].copy()  # Don't modify original
    tables = [t.copy() for t in tables]  # Deep copy
    
    # Check if venue is open on the selected date
    venue_closed = False
    closed_reason = None
    
    if date and venue:
        try:
            from datetime import datetime
            booking_date = datetime.strptime(date, "%Y-%m-%d")
            day_name = booking_date.strftime("%A").lower()
            
            operating_hours = venue.get("operating_hours", {})
            
            # Check if venue has special status (Coming Soon)
            if operating_hours.get("status") == "Coming Soon":
                venue_closed = True
                closed_reason = f"{venue['name']} is coming soon - table bookings not yet available"
            # Check if venue is open on this day
            elif day_name not in operating_hours:
                venue_closed = True
                # Find open days for user-friendly message
                open_days = [d.title() for d in operating_hours.keys() if d != "status"]
                closed_reason = f"{venue['name']} is closed on {booking_date.strftime('%A')}. Open: {', '.join(open_days)}"
        except Exception as e:
            logging.error(f"Date parsing error: {e}")
    
    if venue_closed:
        return {
            "tables": [],
            "venue_id": venue_id,
            "venue_closed": True,
            "closed_reason": closed_reason,
            "operating_hours": venue.get("operating_hours", {}) if venue else {}
        }
    
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
    
    return {
        "tables": tables,
        "venue_id": venue_id,
        "operating_hours": venue.get("operating_hours", {}) if venue else {}
    }

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
        if event_date:
            # Make sure both datetimes are comparable
            if hasattr(event_date, 'tzinfo') and event_date.tzinfo is None:
                event_date = event_date.replace(tzinfo=timezone.utc)
            if (event_date - now).days <= 3:
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

async def scrape_megatix_events():
    """
    Core function to scrape events from Megatix.
    Called by both the API endpoint and the scheduler.
    """
    synced_events = []
    errors = []
    new_events_count = 0
    updated_events_count = 0
    
    try:
        # For each venue, try to fetch events from Megatix
        for venue_id, search_terms in MEGATIX_VENUE_SEARCHES.items():
            for search_term in search_terms[:1]:  # Just use first search term
                try:
                    # Megatix search URL
                    url = f"https://megatix.com.au/events?search={search_term}"
                    
                    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                        response = await client.get(url, headers={
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                        })
                        
                        if response.status_code == 200:
                            # Parse HTML to extract events
                            soup = BeautifulSoup(response.text, 'lxml')
                            
                            # Find event cards - Megatix uses various structures
                            event_cards = soup.find_all(['div', 'article'], class_=lambda x: x and any(
                                keyword in str(x).lower() for keyword in ['event', 'card', 'listing', 'item']
                            ))
                            
                            parsed_events = []
                            for card in event_cards[:10]:  # Limit to first 10 per venue
                                try:
                                    # Try to extract event info
                                    title_elem = card.find(['h2', 'h3', 'h4', 'a'], class_=lambda x: x and 'title' in str(x).lower() if x else False)
                                    if not title_elem:
                                        title_elem = card.find(['h2', 'h3', 'h4'])
                                    
                                    date_elem = card.find(['span', 'div', 'time'], class_=lambda x: x and 'date' in str(x).lower() if x else False)
                                    if not date_elem:
                                        date_elem = card.find('time')
                                    
                                    link_elem = card.find('a', href=True)
                                    img_elem = card.find('img', src=True)
                                    
                                    if title_elem:
                                        event_title = title_elem.get_text(strip=True)
                                        if event_title and len(event_title) > 5:
                                            event_data = {
                                                "title": event_title,
                                                "date": date_elem.get_text(strip=True) if date_elem else None,
                                                "url": link_elem['href'] if link_elem else None,
                                                "image": img_elem['src'] if img_elem else None,
                                                "source": "megatix"
                                            }
                                            parsed_events.append(event_data)
                                except Exception:
                                    continue
                            
                            # Update database with any valid events found
                            for event_data in parsed_events:
                                if event_data.get("title"):
                                    # Check if event already exists
                                    existing = await db.events.find_one({
                                        "title": event_data["title"],
                                        "venue_id": venue_id
                                    })
                                    
                                    if not existing:
                                        # Create new event
                                        new_event = {
                                            "id": str(uuid.uuid4())[:8],
                                            "venue_id": venue_id,
                                            "title": event_data["title"],
                                            "description": f"Event at {LUNA_VENUES.get(venue_id, {}).get('name', venue_id)}",
                                            "date_raw": event_data.get("date"),
                                            "ticket_url": event_data.get("url"),
                                            "image_url": event_data.get("image"),
                                            "source": "megatix",
                                            "synced_at": datetime.now(timezone.utc),
                                            "status": "upcoming"
                                        }
                                        await db.events.insert_one(new_event)
                                        new_events_count += 1
                                    else:
                                        # Update existing event
                                        await db.events.update_one(
                                            {"_id": existing["_id"]},
                                            {"$set": {
                                                "synced_at": datetime.now(timezone.utc),
                                                "ticket_url": event_data.get("url") or existing.get("ticket_url"),
                                            }}
                                        )
                                        updated_events_count += 1
                            
                            synced_events.append({
                                "venue_id": venue_id,
                                "search_term": search_term,
                                "status": "synced",
                                "events_found": len(parsed_events),
                                "page_reachable": True
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
            {"$set": {
                "value": datetime.now(timezone.utc).isoformat(),
                "key": "megatix_last_sync",
                "new_events": new_events_count,
                "updated_events": updated_events_count
            }},
            upsert=True
        )
        
        logging.info(f"Megatix sync completed: {new_events_count} new, {updated_events_count} updated")
        
        return {
            "success": True,
            "message": "Megatix sync completed",
            "new_events": new_events_count,
            "updated_events": updated_events_count,
            "synced": synced_events,
            "errors": errors
        }
        
    except Exception as e:
        logging.error(f"Megatix sync failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

@api_router.post("/admin/megatix/sync")
async def sync_megatix_events():
    """
    Manually trigger Megatix event sync.
    This endpoint scrapes events from Megatix and updates the database.
    
    Also runs automatically every 12 hours via APScheduler.
    """
    result = await scrape_megatix_events()
    return result

# Register the sync function for the scheduler
set_megatix_sync_func(scrape_megatix_events)

# Register the notification generation function for the scheduler
set_notification_gen_func(generate_event_notifications)

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


# Scheduler status endpoint
@api_router.get("/admin/scheduler/status")
async def get_scheduler_status():
    """Get the status of the event sync scheduler"""
    jobs = scheduler.get_jobs()
    last_sync = await db.system_config.find_one({"key": "megatix_last_sync"})
    
    return {
        "scheduler_running": scheduler.running,
        "jobs": [
            {
                "id": job.id,
                "name": job.name,
                "next_run": str(job.next_run_time) if job.next_run_time else None
            }
            for job in jobs
        ],
        "last_sync": last_sync.get("value") if last_sync else None,
        "sync_interval": "12 hours"
    }


# ====== CHERRYHUB INTEGRATION API ======

from cherryhub_service import (
    cherryhub_service, 
    MemberRegistrationRequest,
    register_cherryhub_member,
    get_wallet_pass
)

class CherryHubRegisterRequest(BaseModel):
    """Request to register user with CherryHub"""
    sync_existing: bool = False  # If true, sync existing user data to CherryHub

class WalletPassRequest(BaseModel):
    """Request to get digital wallet pass"""
    platform: str  # "ios" or "android"

@api_router.post("/cherryhub/register")
async def cherryhub_register_member(
    request: Request,
    body: CherryHubRegisterRequest
):
    """
    Register the current user with CherryHub.
    Creates a new member in CherryHub and stores the member key.
    """
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    # Get user from database
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already registered with CherryHub
    if user.get("cherryhub_member_key") and not body.sync_existing:
        return {
            "status": "already_registered",
            "member_key": user["cherryhub_member_key"],
            "message": "User is already registered with CherryHub"
        }
    
    try:
        # Parse name into first/last
        name_parts = user.get("name", "").split(" ", 1)
        first_name = name_parts[0] if name_parts else "Member"
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        
        # Register with CherryHub
        result = await register_cherryhub_member(
            email=user["email"],
            first_name=first_name,
            last_name=last_name,
            phone=user.get("phone"),
            date_of_birth=user.get("date_of_birth"),
            marketing_opt_in=user.get("marketing_opt_in", False)
        )
        
        # Extract member key from response
        member_key = result.get("memberKey") or result.get("MemberKey") or result.get("member_key")
        
        if member_key:
            # Store CherryHub member key in user record
            await db.users.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "cherryhub_member_key": member_key,
                        "cherryhub_registered_at": datetime.now(timezone.utc).isoformat(),
                        "cherryhub_data": result
                    }
                }
            )
        
        logger.info(f"User {user_id} registered with CherryHub, member_key: {member_key}")
        
        return {
            "status": "success",
            "member_key": member_key,
            "cherryhub_data": result,
            "message": "Successfully registered with CherryHub"
        }
        
    except Exception as e:
        logger.error(f"CherryHub registration failed for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"CherryHub registration failed: {str(e)}")


@api_router.get("/cherryhub/status")
async def cherryhub_get_status(request: Request):
    """
    Get the user's CherryHub membership status and info
    """
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    member_key = user.get("cherryhub_member_key")
    
    if not member_key:
        return {
            "registered": False,
            "member_key": None,
            "message": "Not registered with CherryHub"
        }
    
    # Optionally fetch latest data from CherryHub
    try:
        member_data = await cherryhub_service.get_member_by_key(member_key)
        return {
            "registered": True,
            "member_key": member_key,
            "registered_at": user.get("cherryhub_registered_at"),
            "member_data": member_data,
            "message": "CherryHub member found"
        }
    except Exception as e:
        logger.error(f"Failed to fetch CherryHub member data: {e}")
        return {
            "registered": True,
            "member_key": member_key,
            "registered_at": user.get("cherryhub_registered_at"),
            "member_data": user.get("cherryhub_data"),
            "message": "Using cached CherryHub data"
        }


@api_router.post("/cherryhub/wallet-pass")
async def cherryhub_get_wallet_pass(
    request: Request,
    body: WalletPassRequest
):
    """
    Get digital wallet pass (Apple Wallet or Google Wallet) for the user's CherryHub membership
    
    Returns:
    - For iOS: Base64-encoded .pkpass file content
    - For Android: Google Wallet URL to open
    """
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    member_key = user.get("cherryhub_member_key")
    if not member_key:
        raise HTTPException(
            status_code=400, 
            detail="User not registered with CherryHub. Please register first."
        )
    
    platform = body.platform.lower()
    if platform not in ["ios", "android"]:
        raise HTTPException(status_code=400, detail="Platform must be 'ios' or 'android'")
    
    try:
        pass_data = await get_wallet_pass(member_key, platform)
        
        if platform == "ios":
            # Return base64-encoded .pkpass content
            return {
                "platform": "ios",
                "pass_type": "IosPassKit",
                "pass_content_base64": pass_data.get("IosPassContentBase64"),
                "message": "Save this pass to Apple Wallet"
            }
        else:
            # Return Google Wallet URL
            return {
                "platform": "android",
                "pass_type": "GooglePayPass",
                "google_wallet_url": pass_data.get("GooglePassUrl"),
                "message": "Open this URL to add to Google Wallet"
            }
            
    except Exception as e:
        logger.error(f"Failed to get wallet pass for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get wallet pass: {str(e)}")


@api_router.get("/cherryhub/points")
async def cherryhub_get_points(request: Request):
    """
    Get the user's CherryHub loyalty points balance
    """
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    member_key = user.get("cherryhub_member_key")
    if not member_key:
        raise HTTPException(
            status_code=400, 
            detail="User not registered with CherryHub"
        )
    
    try:
        points_data = await cherryhub_service.get_member_points_balance(member_key)
        return {
            "member_key": member_key,
            "points": points_data.get("points", points_data.get("balance", 0)),
            "points_data": points_data
        }
    except Exception as e:
        logger.error(f"Failed to get CherryHub points for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get points: {str(e)}")


# ====== POINTS PURCHASE API (CherryHub Integration) ======

class BuyPointsRequest(BaseModel):
    """Request to purchase points"""
    package_id: str
    points: int
    price: float
    bonus: int = 0
    payment_method: str = "card"  # card, apple_pay, google_pay

@api_router.post("/cherryhub/buy-points")
async def cherryhub_buy_points(request: Request, body: BuyPointsRequest):
    """
    Purchase Luna Points - integrates with CherryHub to add points
    
    This endpoint:
    1. Validates the purchase request
    2. Records the transaction
    3. Adds points via CherryHub API
    4. Updates user's local points balance
    """
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    member_key = user.get("cherryhub_member_key")
    
    # Validate package
    valid_packages = {
        "p1": {"points": 100, "price": 10, "bonus": 0},
        "p2": {"points": 500, "price": 45, "bonus": 50},
        "p3": {"points": 1000, "price": 80, "bonus": 150},
        "p4": {"points": 2500, "price": 180, "bonus": 500},
    }
    
    if body.package_id not in valid_packages:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = valid_packages[body.package_id]
    total_points = package["points"] + package["bonus"]
    
    # Create transaction record
    transaction_id = str(uuid.uuid4())
    transaction = {
        "transaction_id": transaction_id,
        "user_id": user_id,
        "type": "points_purchase",
        "package_id": body.package_id,
        "points": package["points"],
        "bonus_points": package["bonus"],
        "total_points": total_points,
        "price": package["price"],
        "currency": "AUD",
        "payment_method": body.payment_method,
        "status": "completed",  # In production, this would be "pending" until payment confirmed
        "cherryhub_member_key": member_key,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.transactions.insert_one(transaction)
    
    # Add points via CherryHub
    if member_key:
        try:
            await cherryhub_service.add_points(
                member_key, 
                total_points, 
                f"Points Purchase - Package {body.package_id}"
            )
            logger.info(f"Added {total_points} points via CherryHub for user {user_id}")
        except Exception as e:
            logger.error(f"CherryHub points addition failed: {e}")
            # Continue - points will be added locally as fallback
    
    # Update local points balance
    new_balance = (user.get("points_balance", 0) or 0) + total_points
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {"points_balance": new_balance},
            "$inc": {"lifetime_points": total_points}
        }
    )
    
    # Record in points history
    await db.points_history.insert_one({
        "user_id": user_id,
        "type": "purchase",
        "points": total_points,
        "description": f"Purchased {package['points']} points" + (f" (+{package['bonus']} bonus)" if package['bonus'] > 0 else ""),
        "transaction_id": transaction_id,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "transaction_id": transaction_id,
        "points_added": total_points,
        "base_points": package["points"],
        "bonus_points": package["bonus"],
        "new_balance": new_balance,
        "message": f"Successfully purchased {total_points} Luna Points!"
    }


# ====== PROMO CODE API ======

# Pre-configured promo codes (Top 5 most popular types)
PROMO_CODES = {
    "WELCOME50": {
        "type": "bonus_points",
        "value": 50,
        "description": "Welcome bonus - 50 free points",
        "max_uses": 1,
        "active": True
    },
    "LUNA100": {
        "type": "bonus_points",
        "value": 100,
        "description": "Luna VIP - 100 bonus points",
        "max_uses": 1,
        "active": True
    },
    "FREEENTRY": {
        "type": "free_entry",
        "value": 1,
        "venue": "any",
        "description": "One free venue entry",
        "max_uses": 1,
        "active": True
    },
    "FREEDRINK": {
        "type": "drink_voucher",
        "value": 1,
        "description": "One free drink voucher",
        "max_uses": 1,
        "active": True
    },
    "VIP2024": {
        "type": "combo",
        "rewards": [
            {"type": "bonus_points", "value": 75},
            {"type": "drink_voucher", "value": 2}
        ],
        "description": "VIP Special - 75 points + 2 free drinks",
        "max_uses": 1,
        "active": True
    }
}

class ApplyPromoRequest(BaseModel):
    """Request to apply a promo code"""
    code: str

@api_router.post("/promo/apply")
async def apply_promo_code(request: Request, body: ApplyPromoRequest):
    """
    Apply a promo code to the user's account
    
    Rewards can include:
    - Bonus points
    - Free entry vouchers
    - Drink vouchers
    - Combo rewards
    """
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    code = body.code.strip().upper()
    
    # Check if code exists
    if code not in PROMO_CODES:
        raise HTTPException(status_code=400, detail="Invalid promo code")
    
    promo = PROMO_CODES[code]
    
    if not promo.get("active"):
        raise HTTPException(status_code=400, detail="This promo code has expired")
    
    # Check if user has already used this code (one-time use per user)
    existing_use = await db.promo_redemptions.find_one({
        "user_id": user_id,
        "code": code
    })
    
    if existing_use:
        raise HTTPException(status_code=400, detail="You have already used this promo code")
    
    # Process the promo code rewards
    rewards_applied = []
    points_added = 0
    vouchers_added = []
    
    if promo["type"] == "bonus_points":
        points_added = promo["value"]
        rewards_applied.append(f"+{promo['value']} Luna Points")
    
    elif promo["type"] == "free_entry":
        voucher = {
            "voucher_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "free_entry",
            "venue": promo.get("venue", "any"),
            "quantity": promo["value"],
            "source": f"promo_code:{code}",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
        }
        await db.vouchers.insert_one(voucher)
        vouchers_added.append(voucher)
        rewards_applied.append(f"{promo['value']} Free Entry Voucher(s)")
    
    elif promo["type"] == "drink_voucher":
        voucher = {
            "voucher_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "drink_voucher",
            "quantity": promo["value"],
            "source": f"promo_code:{code}",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
        }
        await db.vouchers.insert_one(voucher)
        vouchers_added.append(voucher)
        rewards_applied.append(f"{promo['value']} Free Drink Voucher(s)")
    
    elif promo["type"] == "combo":
        for reward in promo.get("rewards", []):
            if reward["type"] == "bonus_points":
                points_added += reward["value"]
                rewards_applied.append(f"+{reward['value']} Luna Points")
            elif reward["type"] == "drink_voucher":
                voucher = {
                    "voucher_id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "type": "drink_voucher",
                    "quantity": reward["value"],
                    "source": f"promo_code:{code}",
                    "status": "active",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
                }
                await db.vouchers.insert_one(voucher)
                vouchers_added.append(voucher)
                rewards_applied.append(f"{reward['value']} Free Drink Voucher(s)")
            elif reward["type"] == "free_entry":
                voucher = {
                    "voucher_id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "type": "free_entry",
                    "venue": reward.get("venue", "any"),
                    "quantity": reward["value"],
                    "source": f"promo_code:{code}",
                    "status": "active",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()
                }
                await db.vouchers.insert_one(voucher)
                vouchers_added.append(voucher)
                rewards_applied.append(f"{reward['value']} Free Entry Voucher(s)")
    
    # Add points if any
    if points_added > 0:
        member_key = user.get("cherryhub_member_key")
        if member_key:
            try:
                await cherryhub_service.add_points(member_key, points_added, f"Promo Code: {code}")
            except Exception as e:
                logger.error(f"CherryHub promo points failed: {e}")
        
        new_balance = (user.get("points_balance", 0) or 0) + points_added
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {"points_balance": new_balance},
                "$inc": {"lifetime_points": points_added}
            }
        )
        
        await db.points_history.insert_one({
            "user_id": user_id,
            "type": "promo_code",
            "points": points_added,
            "description": f"Promo code: {code}",
            "balance_after": new_balance,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Record the redemption
    await db.promo_redemptions.insert_one({
        "redemption_id": str(uuid.uuid4()),
        "user_id": user_id,
        "code": code,
        "promo_type": promo["type"],
        "rewards_applied": rewards_applied,
        "points_added": points_added,
        "vouchers_count": len(vouchers_added),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"Promo code {code} applied for user {user_id}: {rewards_applied}")
    
    return {
        "success": True,
        "code": code,
        "description": promo["description"],
        "rewards": rewards_applied,
        "points_added": points_added,
        "vouchers_added": len(vouchers_added),
        "message": f"Promo code applied! {', '.join(rewards_applied)}"
    }


@api_router.get("/promo/validate/{code}")
async def validate_promo_code(request: Request, code: str):
    """
    Validate a promo code without applying it
    """
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    code = code.strip().upper()
    
    if code not in PROMO_CODES:
        return {"valid": False, "message": "Invalid promo code"}
    
    promo = PROMO_CODES[code]
    
    if not promo.get("active"):
        return {"valid": False, "message": "This promo code has expired"}
    
    # Check if already used
    existing_use = await db.promo_redemptions.find_one({
        "user_id": user_id,
        "code": code
    })
    
    if existing_use:
        return {"valid": False, "message": "You have already used this promo code"}
    
    return {
        "valid": True,
        "code": code,
        "type": promo["type"],
        "description": promo["description"],
        "message": "Promo code is valid!"
    }


@api_router.get("/vouchers")
async def get_user_vouchers(request: Request):
    """
    Get all active vouchers for the current user
    """
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    vouchers = await db.vouchers.find({
        "user_id": user_id,
        "status": "active"
    }).to_list(100)
    
    # Convert ObjectId to string
    for v in vouchers:
        v.pop("_id", None)
    
    return {
        "vouchers": vouchers,
        "total": len(vouchers)
    }


# ====== INSTAGRAM INTEGRATION API ======

from instagram_service import (
    instagram_service,
    get_instagram_feed,
    get_account_media,
    get_hashtag_media,
    LUNA_INSTAGRAM_ACCOUNTS,
    LUNA_HASHTAGS
)

@api_router.get("/instagram/feed")
async def get_instagram_social_feed(request: Request, limit: int = 20):
    """
    Get the combined Instagram feed from Luna Group accounts and hashtags
    
    Returns posts from official accounts and user-generated content with hashtags
    """
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)  # Ensure authenticated
    
    try:
        feed = await get_instagram_feed(limit)
        return feed
    except Exception as e:
        logger.error(f"Failed to get Instagram feed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get Instagram feed: {str(e)}")


@api_router.get("/instagram/account/{account}")
async def get_instagram_account_posts(request: Request, account: str, limit: int = 10):
    """
    Get posts from a specific Luna Group Instagram account
    
    Valid accounts: eclipsebrisbane, sucasabrisbane, nightmarketbrisbane, 
                   jujumermaidbeach, eclipse.afterdark, sucasa.gc, lunagrouphospitality
    """
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
    if account not in LUNA_INSTAGRAM_ACCOUNTS:
        raise HTTPException(status_code=400, detail=f"Unknown account: {account}")
    
    try:
        posts = await get_account_media(account, limit)
        return {
            "account": account,
            "account_info": LUNA_INSTAGRAM_ACCOUNTS[account],
            "posts": posts,
            "total": len(posts)
        }
    except Exception as e:
        logger.error(f"Failed to get Instagram posts for {account}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/instagram/hashtag/{hashtag}")
async def get_instagram_hashtag_posts(request: Request, hashtag: str, limit: int = 10):
    """
    Get posts with a specific hashtag
    
    Tracked hashtags: eclipsebrisbane, nightmarket, nightmarketbrisbane,
                     Afterdarkbrisbane, sucasabrisbane, sucasagoldcoast, sucasagc, juju
    """
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
    # Clean hashtag (remove # if present)
    hashtag = hashtag.strip().lstrip('#')
    
    try:
        posts = await get_hashtag_media(hashtag, limit)
        return {
            "hashtag": hashtag,
            "posts": posts,
            "total": len(posts),
            "is_tracked": hashtag.lower() in [h.lower() for h in LUNA_HASHTAGS]
        }
    except Exception as e:
        logger.error(f"Failed to get Instagram posts for #{hashtag}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.get("/instagram/config")
async def get_instagram_config(request: Request):
    """
    Get Instagram integration configuration and status
    """
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
    return instagram_service.get_configuration()


# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Luna Group VIP API", "venues": len(LUNA_VENUES), "scheduler": "active"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
