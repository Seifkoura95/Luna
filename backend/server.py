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
    return boosts

# ====== AUCTIONS API ======

@api_router.get("/auctions")
async def get_auctions(venue_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if venue_id:
        query["venue_id"] = venue_id
    if status:
        query["status"] = status
    auctions = await db.auctions.find(query).sort("start_time", 1).to_list(50)
    return auctions

@api_router.post("/auctions/bid")
async def place_bid(request: Request, auction_id: str, amount: float):
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction not active")
    if amount <= auction["current_bid"]:
        raise HTTPException(status_code=400, detail="Bid must be higher than current bid")
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {"current_bid": amount, "winner_id": user["user_id"], "winner_name": user["name"]}}
    )
    await db.bids.insert_one({
        "id": str(uuid.uuid4()),
        "auction_id": auction_id,
        "user_id": user["user_id"],
        "amount": amount,
        "timestamp": datetime.now(timezone.utc)
    })
    updated_auction = await db.auctions.find_one({"id": auction_id})
    return {"message": "Bid placed successfully!", "auction": updated_auction}

# ====== PHOTOS API ======

@api_router.get("/photos")
async def get_user_photos(request: Request, venue_id: Optional[str] = None):
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    query = {"tagged_users": current_user["user_id"]}
    if venue_id:
        query["venue_id"] = venue_id
    photos = await db.photos.find(query).sort("created_at", -1).to_list(100)
    return photos

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

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Luna Group VIP API", "venues": len(LUNA_VENUES)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
