"""
Luna Group VIP API - Main Server
Cleaned version with modular routes
"""

from fastapi import FastAPI, APIRouter, HTTPException, Request
from starlette.middleware.cors import CORSMiddleware
import logging
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Root directory for static files
ROOT_DIR = Path(__file__).parent

# Import database connection
from database import db

# Import utilities
from utils.auth import get_current_user

# Import venue configuration
from luna_venues_config import LUNA_VENUES

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
    
    # Import scheduled jobs service
    from services.scheduled_jobs import scheduled_jobs
    
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
    
    # Schedule daily churn analysis at 3 AM
    scheduler.add_job(
        scheduled_jobs.run_daily_churn_analysis,
        CronTrigger(hour=3, minute=0),
        id="daily_churn_analysis",
        name="Daily Churn Analysis",
        replace_existing=True
    )
    
    # Schedule win-back campaign dispatch every 4 hours
    scheduler.add_job(
        scheduled_jobs.dispatch_win_back_campaigns,
        IntervalTrigger(hours=4),
        id="win_back_dispatch",
        name="Win-back Campaign Dispatch",
        replace_existing=True
    )
    
    # Schedule auction ending notifications every 5 minutes
    scheduler.add_job(
        scheduled_jobs.send_auction_ending_notifications,
        IntervalTrigger(minutes=5),
        id="auction_ending_notifications",
        name="Auction Ending Notifications",
        replace_existing=True
    )
    
    # Schedule new auction alerts every hour
    scheduler.add_job(
        scheduled_jobs.send_new_auction_alerts,
        IntervalTrigger(hours=1),
        id="new_auction_alerts",
        name="New Auction Alerts",
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
    scheduled_jobs.is_running = True  # Set flag to indicate scheduler is running
    logging.info("Event scheduler started - Megatix sync every 12 hours, churn analysis daily at 3AM, win-back dispatch every 4 hours, new auction alerts hourly")
    
    yield
    
    # Shutdown
    logging.info("Shutting down scheduler...")
    scheduler.shutdown()


# Create app with lifespan
app = FastAPI(title="Luna Group VIP API", lifespan=lifespan)
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ====== INCLUDE MODULAR ROUTES ======
from routes import ALL_ROUTERS
for router in ALL_ROUTERS:
    api_router.include_router(router)
logger.info(f"Loaded {len(ALL_ROUTERS)} modular route modules")


# ====== UNIQUE ENDPOINTS (Not in routes/) ======

# Admin seed endpoint
@api_router.post("/admin/seed")
async def seed_data():
    """Seed sample data for development"""
    # This is just a placeholder - actual seeding is handled by startup scripts
    return {"message": "Data seeding triggered", "success": True}


# User stats endpoint
@api_router.get("/users/stats")
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


# Venue detail with live status
@api_router.get("/venues/{venue_id}")
async def get_venue(venue_id: str):
    """Get venue details with live status based on current time"""
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


# ====== PROMO CODES SYSTEM ======

PROMO_CODES = {
    "LUNA50": {
        "type": "bonus_points",
        "value": 50,
        "description": "50 bonus Luna Points",
        "max_uses": 1,
        "active": True
    },
    "LUNAWEEKEND": {
        "type": "bonus_points",
        "value": 100,
        "description": "Weekend special - 100 bonus points!",
        "max_uses": 1,
        "active": True
    },
    "FREEENTRY": {
        "type": "free_entry",
        "value": 1,
        "description": "One free entry voucher",
        "venue": "any",
        "max_uses": 1,
        "active": True
    },
    "ECLIPSEFREE": {
        "type": "free_entry",
        "value": 1,
        "description": "Free entry to Eclipse",
        "venue": "eclipse",
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
    """Apply a promo code to the user's account"""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    code = body.code.strip().upper()
    
    if code not in PROMO_CODES:
        raise HTTPException(status_code=400, detail="Invalid promo code")
    
    promo = PROMO_CODES[code]
    
    if not promo.get("active"):
        raise HTTPException(status_code=400, detail="This promo code has expired")
    
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
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        }
        await db.vouchers.insert_one(voucher)
        vouchers_added.append(voucher)
        rewards_applied.append(f"{promo['value']}x Free Entry Voucher")
    
    elif promo["type"] == "drink_voucher":
        voucher = {
            "voucher_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "drink_voucher",
            "quantity": promo["value"],
            "source": f"promo_code:{code}",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        }
        await db.vouchers.insert_one(voucher)
        vouchers_added.append(voucher)
        rewards_applied.append(f"{promo['value']}x Free Drink Voucher")
    
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
                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                }
                await db.vouchers.insert_one(voucher)
                vouchers_added.append(voucher)
                rewards_applied.append(f"{reward['value']}x Free Drink Voucher")
    
    # Add points if any
    if points_added > 0:
        current_points = user.get("points", 0)
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {"points": current_points + points_added},
                "$push": {
                    "points_history": {
                        "amount": points_added,
                        "type": "promo_code",
                        "description": f"Promo code: {code}",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
    
    # Record promo redemption
    await db.promo_redemptions.insert_one({
        "user_id": user_id,
        "code": code,
        "promo_type": promo["type"],
        "rewards_applied": rewards_applied,
        "points_added": points_added,
        "vouchers_added": len(vouchers_added),
        "redeemed_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "code": code,
        "description": promo["description"],
        "rewards_applied": rewards_applied,
        "points_added": points_added,
        "vouchers_added": len(vouchers_added),
        "new_points_balance": user.get("points", 0) + points_added
    }


@api_router.get("/promo/validate/{code}")
async def validate_promo_code(request: Request, code: str):
    """Validate a promo code without applying it"""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    code = code.strip().upper()
    
    if code not in PROMO_CODES:
        return {
            "valid": False,
            "error": "Invalid promo code"
        }
    
    promo = PROMO_CODES[code]
    
    if not promo.get("active"):
        return {
            "valid": False,
            "error": "This promo code has expired"
        }
    
    existing_use = await db.promo_redemptions.find_one({
        "user_id": user_id,
        "code": code
    })
    
    if existing_use:
        return {
            "valid": False,
            "error": "You have already used this promo code"
        }
    
    return {
        "valid": True,
        "code": code,
        "type": promo["type"],
        "description": promo["description"]
    }


@api_router.get("/vouchers")
async def get_user_vouchers(request: Request):
    """Get all vouchers for the current user"""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    vouchers = await db.vouchers.find({
        "user_id": user_id,
        "status": "active"
    }).to_list(length=100)
    
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
    """Get the combined Instagram feed from Luna Group accounts and hashtags"""
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
    try:
        feed = await get_instagram_feed(limit)
        return feed
    except Exception as e:
        logger.error(f"Failed to get Instagram feed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get Instagram feed: {str(e)}")


@api_router.get("/instagram/account/{account}")
async def get_instagram_account_posts(request: Request, account: str, limit: int = 10):
    """Get posts from a specific Luna Group Instagram account"""
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
    """Get posts with a specific hashtag"""
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
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
    """Get Instagram integration configuration and status"""
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
    return instagram_service.get_configuration()


# ====== VENUE PORTAL STATIC FILES ======

VENUE_PORTAL_DIR = ROOT_DIR / "static" / "venue-portal"

@api_router.get("/venue-portal")
async def serve_venue_portal_root():
    """Serve the venue portal SPA root"""
    index_file = ROOT_DIR / "static" / "venue-portal" / "index.html"
    if index_file.exists():
        return FileResponse(
            index_file, 
            media_type="text/html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    raise HTTPException(status_code=404, detail="Venue portal not found")


@api_router.get("/venue-portal/{path:path}")
async def serve_venue_portal(path: str):
    """Serve venue portal static files with SPA fallback"""
    # Skip if path starts with assets/ - serve actual file
    if path.startswith("assets/"):
        asset_path = VENUE_PORTAL_DIR / path
        if asset_path.exists():
            if path.endswith('.js'):
                return FileResponse(asset_path, media_type="application/javascript", headers={"Cache-Control": "public, max-age=31536000"})
            elif path.endswith('.css'):
                return FileResponse(asset_path, media_type="text/css", headers={"Cache-Control": "public, max-age=31536000"})
            elif path.endswith('.json'):
                return FileResponse(asset_path, media_type="application/json")
            elif path.endswith('.svg'):
                return FileResponse(asset_path, media_type="image/svg+xml")
            elif path.endswith('.png'):
                return FileResponse(asset_path, media_type="image/png")
            elif path.endswith('.jpg') or path.endswith('.jpeg'):
                return FileResponse(asset_path, media_type="image/jpeg")
            elif path.endswith('.woff') or path.endswith('.woff2'):
                return FileResponse(asset_path, media_type="font/woff2")
            return FileResponse(asset_path)
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # For all other paths, serve the index.html (SPA routing)
    index_file = ROOT_DIR / "static" / "venue-portal" / "index.html"
    if index_file.exists():
        return FileResponse(
            index_file, 
            media_type="text/html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            }
        )
    raise HTTPException(status_code=404, detail="Venue portal not found")


# ====== CORS & APP SETUP ======

app.add_middleware(
    CORSMiddleware, 
    allow_origins=["*"], 
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"]
)
app.include_router(api_router)


@app.get("/")
async def root():
    return {"message": "Luna Group VIP API", "venues": len(LUNA_VENUES), "scheduler": "active"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
