from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from starlette.middleware.cors import CORSMiddleware
import logging
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import secrets
import bcrypt
import jwt
import stripe
import asyncio
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
import httpx
from bs4 import BeautifulSoup
from pathlib import Path

# Root directory for static files
ROOT_DIR = Path(__file__).parent

# Import database connection
from database import db

# Import configuration
from config import (
    JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRY_DAYS,
    QR_SECRET,
    STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET,
    EMAIL_VERIFICATION_EXPIRY_HOURS,
    REFERRAL_POINTS_REWARD,
    POINTS_PER_DOLLAR, POINTS_PER_CHECKIN, POINTS_PER_MISSION,
    ENTRY_CHARGING_VENUES,
    SUBSCRIPTION_TIERS
)

# Import utilities
from utils.auth import get_current_user, create_access_token, generate_verification_token, send_verification_email
from utils.qr import generate_qr_code, verify_qr_code
from utils.mongo import clean_mongo_doc, clean_mongo_docs

# Import models
from models.auth import RegisterRequest, LoginRequest, PushTokenRequest, RegisterPushTokenRequest
from models.venue import ScanQRRequest, VenueStaffRegister, BookingRequest, GuestlistRequest, TableBookingRequest, TableDepositRequest
from models.events import EventRSVP
from models.rewards import MissionProgressRequest
from models.auctions import PlaceBidRequest, AuctionSubscribeRequest
from models.tickets import PurchaseTicketRequest, AddGuestRequest, CreateCrewRequest, InviteToCrewRequest, CrewBoothBidRequest
from models.safety import IncidentReportRequest, LostPropertyRequest, LocationUpdate, SafetyAlertRequest, EmergencyContact, SilentAlertRequest
from models.social import FriendRequest, LostItemReport, FoundItemReport, LostFoundMessage
from models.payments import PaymentIntentRequest, SplitPaymentRequest, ApplyPromoRequest
from models.notifications import NotificationPreferences, PrivacySettings
from models.cherryhub import CherryHubRegisterRequest, WalletPassRequest, BuyPointsRequest
from models.user import RecordSpendingRequest, SubscribeRequest
from models.email import CrewInviteEmailRequest

# Initialize Stripe with test key
stripe.api_key = STRIPE_SECRET_KEY

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
# Import and include all modular route modules
from routes import ALL_ROUTERS
for router in ALL_ROUTERS:
    api_router.include_router(router)
logger.info(f"Loaded {len(ALL_ROUTERS)} modular route modules")


# NOTE: Health check endpoint moved to routes/health.py

# NOTE: Basic venues list moved to routes/venues.py
from luna_venues_config import LUNA_VENUES

# Venue detail with status (unique to server.py)
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


# NOTE: Auth endpoints moved to routes/auth.py

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

# NOTE: Rewards API moved to routes/rewards.py

# ====== QR CODE REDEMPTION SYSTEM ======

def generate_qr_code(redemption_id: str, user_id: str) -> str:
    """Generate a secure one-time use QR code"""
    timestamp = int(datetime.now(timezone.utc).timestamp())
    data = f"{redemption_id}:{user_id}:{timestamp}"
    signature = hmac.new(QR_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()[:12]
    return f"LUNA-{redemption_id[:8].upper()}-{signature.upper()}"

def verify_qr_code(qr_code: str, redemption_id: str) -> bool:
    """Verify QR code is valid"""
    if not qr_code.startswith("LUNA-"):
        return False
    parts = qr_code.split("-")
    if len(parts) != 3:
        return False
    return parts[1].lower() == redemption_id[:8].lower()

@api_router.get("/redemptions/my")
async def get_my_redemptions(request: Request, status: Optional[str] = None):
    """Get user's redemptions with QR codes"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    query = {"user_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    redemptions = await db.redemptions.find(query).sort("created_at", -1).to_list(50)
    return clean_mongo_docs(redemptions)

@api_router.get("/redemptions/{redemption_id}")
async def get_redemption(request: Request, redemption_id: str):
    """Get a specific redemption with QR code"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    redemption = await db.redemptions.find_one({
        "id": redemption_id,
        "user_id": current_user["user_id"]
    })
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    
    return clean_mongo_doc(redemption)

@api_router.post("/venue/scan-qr")
async def venue_scan_qr(request: Request, scan_req: ScanQRRequest):
    """Venue scans and validates a QR code - marks as redeemed"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Verify user is venue staff
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to scan QR codes")
    
    # Find redemption by QR code
    redemption = await db.redemptions.find_one({"qr_code": scan_req.qr_code})
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    
    if redemption["status"] == "redeemed":
        raise HTTPException(status_code=400, detail="QR code already used")
    
    if redemption["status"] == "expired":
        raise HTTPException(status_code=400, detail="QR code has expired")
    
    if redemption.get("expires_at") and redemption["expires_at"] < datetime.now(timezone.utc):
        await db.redemptions.update_one(
            {"id": redemption["id"]},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="QR code has expired")
    
    # Mark as redeemed
    await db.redemptions.update_one(
        {"id": redemption["id"]},
        {"$set": {
            "status": "redeemed",
            "redeemed_at": datetime.now(timezone.utc),
            "redeemed_by": current_user["user_id"],
            "redeemed_venue": scan_req.venue_id
        }}
    )
    
    # Get customer info
    customer = await db.users.find_one({"user_id": redemption["user_id"]})
    
    return {
        "success": True,
        "message": "Reward redeemed successfully!",
        "reward_name": redemption["reward_name"],
        "customer_name": customer.get("name", "Unknown") if customer else "Unknown",
        "points_spent": redemption["points_spent"],
        "redeemed_at": datetime.now(timezone.utc).isoformat()
    }

# NOTE: Missions API moved to routes/missions.py

# ====== VENUE STAFF/DASHBOARD API ======

@api_router.post("/venue/register-staff")
async def register_venue_staff(request: Request, staff: VenueStaffRegister):
    """Register venue staff - requires admin or venue_manager"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Verify requester is admin or venue manager
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if staff email exists
    existing = await db.users.find_one({"email": staff.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    if staff.role not in ["venue_staff", "venue_manager"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Create staff account
    hashed_password = bcrypt.hashpw(staff.password.encode('utf-8'), bcrypt.gensalt())
    staff_user = {
        "user_id": str(uuid.uuid4()),
        "email": staff.email.lower(),
        "password": hashed_password.decode('utf-8'),
        "name": staff.name,
        "role": staff.role,
        "venue_id": staff.venue_id,
        "is_venue_staff": True,
        "points_balance": 0,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(staff_user)
    
    return {
        "success": True,
        "message": f"Staff account created for {staff.name}",
        "user_id": staff_user["user_id"]
    }

@api_router.get("/venue/dashboard")
async def get_venue_dashboard(request: Request):
    """Get venue dashboard data - analytics, redemptions, etc."""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Verify venue staff
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    # Get date range for stats
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)
    
    # Build query based on role
    redemption_query = {}
    if not is_admin and venue_id:
        redemption_query["redeemed_venue"] = venue_id
    
    # Get redemption stats
    total_redemptions = await db.redemptions.count_documents({
        **redemption_query,
        "status": "redeemed"
    })
    
    today_redemptions = await db.redemptions.count_documents({
        **redemption_query,
        "status": "redeemed",
        "redeemed_at": {"$gte": today}
    })
    
    week_redemptions = await db.redemptions.count_documents({
        **redemption_query,
        "status": "redeemed",
        "redeemed_at": {"$gte": week_ago}
    })
    
    # Get recent redemptions
    recent_redemptions = await db.redemptions.find({
        **redemption_query,
        "status": "redeemed"
    }).sort("redeemed_at", -1).limit(20).to_list(20)
    
    # Enrich with customer names
    for r in recent_redemptions:
        customer = await db.users.find_one({"user_id": r["user_id"]})
        r["customer_name"] = customer.get("name", "Unknown") if customer else "Unknown"
    
    # Get pending redemptions (QR codes generated but not scanned)
    pending_count = await db.redemptions.count_documents({
        "status": "pending"
    })
    
    # Get venue visitors (unique users with activity)
    visitor_query = {"redeemed_venue": venue_id} if venue_id and not is_admin else {}
    unique_visitors = await db.redemptions.distinct("user_id", visitor_query)
    
    return {
        "stats": {
            "total_redemptions": total_redemptions,
            "today_redemptions": today_redemptions,
            "week_redemptions": week_redemptions,
            "pending_redemptions": pending_count,
            "unique_visitors": len(unique_visitors)
        },
        "recent_redemptions": clean_mongo_docs(recent_redemptions),
        "venue_id": venue_id,
        "is_admin": is_admin
    }

@api_router.get("/venue/redemptions")
async def get_venue_redemptions(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get redemptions for venue dashboard"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if user.get("role") != "admin" and user.get("venue_id"):
        query["redeemed_venue"] = user["venue_id"]
    if status:
        query["status"] = status
    
    total = await db.redemptions.count_documents(query)
    redemptions = await db.redemptions.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    # Enrich with customer names
    for r in redemptions:
        customer = await db.users.find_one({"user_id": r["user_id"]})
        r["customer_name"] = customer.get("name", "Unknown") if customer else "Unknown"
    
    return {
        "total": total,
        "redemptions": clean_mongo_docs(redemptions)
    }

@api_router.get("/venue/analytics")
async def get_venue_analytics(request: Request, period: str = "week"):
    """Get detailed analytics for venue"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    # Calculate date range
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "day":
        start_date = today
    elif period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=7)
    
    # Build query
    query = {"redeemed_at": {"$gte": start_date}, "status": "redeemed"}
    if not is_admin and venue_id:
        query["redeemed_venue"] = venue_id
    
    # Get redemptions grouped by day
    redemptions = await db.redemptions.find(query).to_list(1000)
    
    # Group by day
    daily_stats = {}
    for r in redemptions:
        day = r["redeemed_at"].strftime("%Y-%m-%d")
        if day not in daily_stats:
            daily_stats[day] = {"count": 0, "points": 0}
        daily_stats[day]["count"] += 1
        daily_stats[day]["points"] += r.get("points_spent", 0)
    
    # Get top rewards
    reward_counts = {}
    for r in redemptions:
        name = r.get("reward_name", "Unknown")
        reward_counts[name] = reward_counts.get(name, 0) + 1
    
    top_rewards = sorted(reward_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "period": period,
        "daily_stats": daily_stats,
        "top_rewards": [{"name": name, "count": count} for name, count in top_rewards],
        "total_redemptions": len(redemptions),
        "total_points_redeemed": sum(r.get("points_spent", 0) for r in redemptions)
    }

@api_router.get("/venue/analytics/revenue")
async def get_venue_revenue_analytics(request: Request, period: str = "month"):
    """Get revenue analytics for venue - spending, bookings, subscriptions"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    # Calculate date range
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    elif period == "year":
        start_date = today - timedelta(days=365)
    else:
        start_date = today - timedelta(days=30)
    
    # Build query based on role
    spending_query = {"created_at": {"$gte": start_date}}
    if not is_admin and venue_id:
        spending_query["venue_id"] = venue_id
    
    # Get spending records
    spending_records = await db.spending.find(spending_query).to_list(10000)
    
    # Calculate totals by category
    total_revenue = sum(s.get("amount", 0) for s in spending_records)
    category_revenue = {}
    for s in spending_records:
        category = s.get("category", "general")
        category_revenue[category] = category_revenue.get(category, 0) + s.get("amount", 0)
    
    # Get revenue by day for chart
    daily_revenue = {}
    for s in spending_records:
        day = s["created_at"].strftime("%Y-%m-%d")
        if day not in daily_revenue:
            daily_revenue[day] = 0
        daily_revenue[day] += s.get("amount", 0)
    
    # Get booking revenue (bookings and guestlist)
    booking_query = {"created_at": {"$gte": start_date}}
    if not is_admin and venue_id:
        booking_query["venue_id"] = venue_id
    
    bookings = await db.bookings.find(booking_query).to_list(1000)
    booking_revenue = sum(b.get("deposit_amount", 0) for b in bookings)
    
    return {
        "period": period,
        "total_revenue": total_revenue,
        "booking_revenue": booking_revenue,
        "combined_revenue": total_revenue + booking_revenue,
        "category_breakdown": category_revenue,
        "daily_revenue": daily_revenue,
        "average_spend_per_customer": total_revenue / len(spending_records) if spending_records else 0,
        "total_transactions": len(spending_records)
    }

@api_router.get("/venue/analytics/checkins")
async def get_venue_checkin_analytics(request: Request, period: str = "month"):
    """Get check-in analytics for venue - peak hours, frequency, loyalty"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    # Calculate date range
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    elif period == "year":
        start_date = today - timedelta(days=365)
    else:
        start_date = today - timedelta(days=30)
    
    # Build query
    checkin_query = {"created_at": {"$gte": start_date}}
    if not is_admin and venue_id:
        checkin_query["venue_id"] = venue_id
    
    # Get check-ins
    checkins = await db.checkins.find(checkin_query).to_list(10000)
    
    # Total check-ins
    total_checkins = len(checkins)
    
    # Unique visitors
    unique_users = len(set(c["user_id"] for c in checkins))
    
    # Average check-ins per user
    avg_checkins_per_user = total_checkins / unique_users if unique_users > 0 else 0
    
    # Peak hours analysis
    hour_distribution = {}
    for c in checkins:
        hour = c["created_at"].hour
        hour_distribution[hour] = hour_distribution.get(hour, 0) + 1
    
    # Peak day of week analysis
    day_distribution = {}
    for c in checkins:
        day = c["created_at"].strftime("%A")  # Monday, Tuesday, etc.
        day_distribution[day] = day_distribution.get(day, 0) + 1
    
    # Daily check-ins for chart
    daily_checkins = {}
    for c in checkins:
        day = c["created_at"].strftime("%Y-%m-%d")
        if day not in daily_checkins:
            daily_checkins[day] = 0
        daily_checkins[day] += 1
    
    # Top frequent visitors
    user_checkin_counts = {}
    for c in checkins:
        user_id = c["user_id"]
        user_checkin_counts[user_id] = user_checkin_counts.get(user_id, 0) + 1
    
    top_visitors = sorted(user_checkin_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Enrich with user names
    top_visitors_enriched = []
    for user_id, count in top_visitors:
        u = await db.users.find_one({"user_id": user_id})
        top_visitors_enriched.append({
            "user_id": user_id,
            "name": u.get("name", "Unknown") if u else "Unknown",
            "checkins": count
        })
    
    return {
        "period": period,
        "total_checkins": total_checkins,
        "unique_visitors": unique_users,
        "avg_checkins_per_user": round(avg_checkins_per_user, 2),
        "peak_hours": sorted(hour_distribution.items(), key=lambda x: x[1], reverse=True)[:5],
        "peak_days": sorted(day_distribution.items(), key=lambda x: x[1], reverse=True),
        "daily_checkins": daily_checkins,
        "top_visitors": top_visitors_enriched
    }

@api_router.get("/venue/analytics/demographics")
async def get_venue_demographics(request: Request):
    """Get user demographics for venue - age, gender, membership tiers"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    # Get all users who have checked in to this venue
    checkin_query = {}
    if not is_admin and venue_id:
        checkin_query["venue_id"] = venue_id
    
    checkins = await db.checkins.find(checkin_query).to_list(10000)
    unique_user_ids = list(set(c["user_id"] for c in checkins))
    
    # Get user profiles
    users = await db.users.find({"user_id": {"$in": unique_user_ids}}).to_list(10000)
    
    # Analyze membership tiers
    tier_distribution = {}
    for u in users:
        tier = u.get("subscription_tier", "lunar")
        tier_distribution[tier] = tier_distribution.get(tier, 0) + 1
    
    # Analyze age distribution (if available)
    age_distribution = {
        "18-24": 0,
        "25-34": 0,
        "35-44": 0,
        "45+": 0
    }
    
    from datetime import datetime
    for u in users:
        if u.get("date_of_birth"):
            try:
                dob = datetime.fromisoformat(u["date_of_birth"].replace("Z", "+00:00"))
                age = (datetime.now(timezone.utc) - dob).days // 365
                if age < 25:
                    age_distribution["18-24"] += 1
                elif age < 35:
                    age_distribution["25-34"] += 1
                elif age < 45:
                    age_distribution["35-44"] += 1
                else:
                    age_distribution["45+"] += 1
            except:
                pass
    
    # Gender distribution (if available)
    gender_distribution = {}
    for u in users:
        gender = u.get("gender", "unspecified")
        gender_distribution[gender] = gender_distribution.get(gender, 0) + 1
    
    return {
        "total_customers": len(users),
        "membership_tiers": tier_distribution,
        "age_distribution": age_distribution,
        "gender_distribution": gender_distribution,
        "loyalty_breakdown": {
            "new_visitors": len([u for u in users if user_checkin_counts.get(u["user_id"], 0) == 1]) if 'user_checkin_counts' in locals() else 0,
            "regular_visitors": len([u for u in users if 2 <= user_checkin_counts.get(u["user_id"], 0) <= 5]) if 'user_checkin_counts' in locals() else 0,
            "vip_visitors": len([u for u in users if user_checkin_counts.get(u["user_id"], 0) > 5]) if 'user_checkin_counts' in locals() else 0
        }
    }


@api_router.get("/venue/analytics/auctions")
async def get_venue_auction_analytics(request: Request, period: str = "month"):
    """Get auction analytics for venue - live auctions, bids, conversions"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    # Calculate date range
    today = datetime.now(timezone.utc)
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=30)
    
    # Build query
    auction_query = {}
    if not is_admin and venue_id:
        auction_query["venue_id"] = venue_id
    
    # Get all auctions
    auctions = await db.auctions.find(auction_query).to_list(1000)
    
    # Live auctions
    live_auctions = [a for a in auctions if a.get("status") == "active"]
    ended_auctions = [a for a in auctions if a.get("status") in ["ended", "completed"]]
    
    # Get bids
    total_bids = 0
    total_bid_amount = 0
    for auction in auctions:
        bids = auction.get("bids", [])
        total_bids += len(bids)
        total_bid_amount += sum(b.get("amount", 0) for b in bids)
    
    # Format live auctions for frontend
    live_auctions_formatted = []
    for auction in live_auctions[:10]:
        end_time = auction.get("end_time")
        time_left = "Ended"
        delta_seconds = 0
        if end_time:
            # Ensure end_time is timezone-aware
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)
            delta = end_time - today
            delta_seconds = delta.total_seconds()
            if delta_seconds > 0:
                hours = int(delta_seconds // 3600)
                minutes = int((delta_seconds % 3600) // 60)
                time_left = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"
        
        live_auctions_formatted.append({
            "id": auction.get("id"),
            "item": auction.get("title", "Unknown Item"),
            "currentBid": auction.get("current_bid", auction.get("starting_bid", 0)),
            "bids": len(auction.get("bids", [])),
            "timeLeft": time_left,
            "status": "live" if delta_seconds > 3600 else "ending"
        })
    
    return {
        "period": period,
        "live_auctions_count": len(live_auctions),
        "total_auctions": len(auctions),
        "total_bids": total_bids,
        "total_bid_amount": total_bid_amount,
        "conversion_rate": round((len(ended_auctions) / len(auctions) * 100) if auctions else 0, 1),
        "live_auctions": live_auctions_formatted
    }


@api_router.get("/venue/analytics/points")
async def get_venue_points_analytics(request: Request, period: str = "month"):
    """Get points analytics for venue - issued, redeemed, top earners"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    # Calculate date range
    today = datetime.now(timezone.utc)
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=30)
    
    # Get points transactions
    points_query = {"created_at": {"$gte": start_date}}
    if not is_admin and venue_id:
        points_query["venue_id"] = venue_id
    
    transactions = await db.points_transactions.find(points_query).to_list(10000)
    
    # Calculate totals
    points_issued = sum(t.get("total_points", 0) for t in transactions if t.get("type") == "earn")
    points_redeemed = sum(abs(t.get("total_points", 0)) for t in transactions if t.get("type") == "redeem")
    points_expired = 0  # Would need expiry tracking
    
    redemption_rate = round((points_redeemed / points_issued * 100) if points_issued > 0 else 0, 1)
    
    # Top point earners
    user_points = {}
    for t in transactions:
        if t.get("type") == "earn":
            user_id = t.get("user_id")
            user_points[user_id] = user_points.get(user_id, 0) + t.get("total_points", 0)
    
    top_earners = sorted(user_points.items(), key=lambda x: x[1], reverse=True)[:10]
    
    # Enrich with user info
    top_earners_formatted = []
    for user_id, points in top_earners:
        u = await db.users.find_one({"user_id": user_id})
        if u:
            top_earners_formatted.append({
                "user_id": user_id,
                "name": u.get("name", "Unknown"),
                "points": points,
                "tier": u.get("subscription_tier", "lunar"),
                "avatar": u.get("avatar_url", f"https://ui-avatars.com/api/?name={u.get('name', 'U')}&background=E31837&color=fff")
            })
    
    return {
        "period": period,
        "points_issued": points_issued,
        "points_redeemed": points_redeemed,
        "points_expired": points_expired,
        "redemption_rate": redemption_rate,
        "top_earners": top_earners_formatted
    }


@api_router.get("/venue/analytics/activity")
async def get_venue_activity_feed(request: Request, limit: int = 50):
    """Get real-time activity feed for venue - check-ins, redemptions, purchases"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    activities = []
    now = datetime.now(timezone.utc)
    
    # Get recent check-ins
    checkin_query = {}
    if not is_admin and venue_id:
        checkin_query["venue_id"] = venue_id
    
    recent_checkins = await db.checkins.find(checkin_query).sort("created_at", -1).limit(20).to_list(20)
    for c in recent_checkins:
        u = await db.users.find_one({"user_id": c["user_id"]})
        if u:
            delta = now - c["created_at"]
            minutes = int(delta.total_seconds() // 60)
            time_ago = f"{minutes} min ago" if minutes < 60 else f"{minutes // 60}h ago"
            activities.append({
                "type": "checkin",
                "user": u.get("name", "Guest"),
                "action": "checked in",
                "time": time_ago,
                "tier": u.get("subscription_tier", "bronze"),
                "avatar": u.get("avatar_url", f"https://ui-avatars.com/api/?name={u.get('name', 'U')}&background=E31837&color=fff"),
                "timestamp": c["created_at"]
            })
    
    # Get recent redemptions
    redemption_query = {"status": "redeemed"}
    if not is_admin and venue_id:
        redemption_query["redeemed_venue"] = venue_id
    
    recent_redemptions = await db.redemptions.find(redemption_query).sort("redeemed_at", -1).limit(20).to_list(20)
    for r in recent_redemptions:
        u = await db.users.find_one({"user_id": r["user_id"]})
        if u:
            delta = now - r.get("redeemed_at", r.get("created_at", now))
            minutes = int(delta.total_seconds() // 60)
            time_ago = f"{minutes} min ago" if minutes < 60 else f"{minutes // 60}h ago"
            activities.append({
                "type": "redemption",
                "user": u.get("name", "Guest"),
                "action": f"redeemed {r.get('reward_name', 'reward')}",
                "time": time_ago,
                "tier": u.get("subscription_tier", "bronze"),
                "avatar": u.get("avatar_url", f"https://ui-avatars.com/api/?name={u.get('name', 'U')}&background=E31837&color=fff"),
                "timestamp": r.get("redeemed_at", r.get("created_at", now))
            })
    
    # Get recent auction bids
    bid_query = {}
    if not is_admin and venue_id:
        bid_query["venue_id"] = venue_id
    
    recent_auctions = await db.auctions.find(bid_query).sort("updated_at", -1).limit(10).to_list(10)
    for auction in recent_auctions:
        bids = auction.get("bids", [])
        for bid in bids[-3:]:  # Last 3 bids per auction
            u = await db.users.find_one({"user_id": bid.get("user_id")})
            if u:
                bid_time = bid.get("timestamp", now)
                if isinstance(bid_time, str):
                    bid_time = datetime.fromisoformat(bid_time.replace("Z", "+00:00"))
                delta = now - bid_time
                minutes = int(delta.total_seconds() // 60)
                time_ago = f"{minutes} min ago" if minutes < 60 else f"{minutes // 60}h ago"
                activities.append({
                    "type": "bid",
                    "user": u.get("name", "Guest"),
                    "action": f"bid ${bid.get('amount', 0)} on {auction.get('title', 'item')}",
                    "time": time_ago,
                    "tier": u.get("subscription_tier", "bronze"),
                    "avatar": u.get("avatar_url", f"https://ui-avatars.com/api/?name={u.get('name', 'U')}&background=E31837&color=fff"),
                    "timestamp": bid_time
                })
    
    # Sort all activities by timestamp and return most recent
    activities.sort(key=lambda x: x.get("timestamp", now), reverse=True)
    
    # Remove timestamp from response (was just for sorting)
    for a in activities:
        if "timestamp" in a:
            del a["timestamp"]
    
    return {
        "activities": activities[:limit]
    }


@api_router.get("/venue/analytics/top-spenders")
async def get_venue_top_spenders(request: Request, period: str = "month", limit: int = 10):
    """Get top spending customers for venue"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    # Calculate date range
    today = datetime.now(timezone.utc)
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=30)
    
    # Get spending records
    spending_query = {"created_at": {"$gte": start_date}}
    if not is_admin and venue_id:
        spending_query["venue_id"] = venue_id
    
    spending_records = await db.spending.find(spending_query).to_list(10000)
    
    # Aggregate by user
    user_spending = {}
    for s in spending_records:
        user_id = s.get("user_id")
        if user_id:
            if user_id not in user_spending:
                user_spending[user_id] = {"total": 0, "visits": set()}
            user_spending[user_id]["total"] += s.get("amount", 0)
            user_spending[user_id]["visits"].add(s.get("created_at", today).strftime("%Y-%m-%d"))
    
    # Sort by total spending
    top_spenders = sorted(user_spending.items(), key=lambda x: x[1]["total"], reverse=True)[:limit]
    
    # Enrich with user info
    result = []
    for user_id, data in top_spenders:
        u = await db.users.find_one({"user_id": user_id})
        if u:
            result.append({
                "name": u.get("name", "Unknown"),
                "spent": data["total"],
                "visits": len(data["visits"]),
                "tier": u.get("subscription_tier", "bronze"),
                "avatar": u.get("avatar_url", f"https://ui-avatars.com/api/?name={u.get('name', 'U')}&background=E31837&color=fff")
            })
    
    return {
        "period": period,
        "top_spenders": result
    }


@api_router.get("/venue/analytics/vip-alerts")
async def get_venue_vip_alerts(request: Request):
    """Get VIP customer alerts - high value customers arriving/expected"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Get VIP users (platinum tier or high spenders)
    vip_query = {
        "$or": [
            {"subscription_tier": {"$in": ["platinum", "gold"]}},
            {"total_spent": {"$gte": 5000}}
        ]
    }
    
    vip_users = await db.users.find(vip_query).to_list(100)
    
    alerts = []
    for vip in vip_users[:10]:
        # Check for recent bookings today
        booking_query = {
            "user_id": vip["user_id"],
            "booking_date": {"$gte": today_start.isoformat(), "$lte": (today_start + timedelta(days=1)).isoformat()}
        }
        if not is_admin and venue_id:
            booking_query["venue_id"] = venue_id
        
        booking = await db.bookings.find_one(booking_query)
        
        # Check if they checked in today
        checkin_query = {
            "user_id": vip["user_id"],
            "created_at": {"$gte": today_start}
        }
        if not is_admin and venue_id:
            checkin_query["venue_id"] = venue_id
        
        recent_checkin = await db.checkins.find_one(checkin_query)
        
        # Get their total spend
        total_spent = vip.get("total_spent", 0)
        if total_spent == 0:
            # Calculate from spending records
            spending = await db.spending.find({"user_id": vip["user_id"]}).to_list(1000)
            total_spent = sum(s.get("amount", 0) for s in spending)
        
        # Get last visit
        last_checkin = await db.checkins.find_one(
            {"user_id": vip["user_id"]},
            sort=[("created_at", -1)]
        )
        last_visit = "Never"
        if last_checkin:
            delta = now - last_checkin["created_at"]
            if delta.days == 0:
                last_visit = "Today"
            elif delta.days == 1:
                last_visit = "Yesterday"
            else:
                last_visit = f"{delta.days} days ago"
        
        if booking or (recent_checkin and (now - recent_checkin["created_at"]).total_seconds() < 3600):
            status = "arriving"
        elif booking:
            status = "expected"
        else:
            continue  # Skip if no reason to alert
        
        alerts.append({
            "id": vip["user_id"],
            "name": vip.get("name", "VIP Guest"),
            "tier": vip.get("subscription_tier", "gold"),
            "totalSpend": total_spent,
            "lastVisit": last_visit,
            "status": status,
            "avatar": vip.get("avatar_url", f"https://ui-avatars.com/api/?name={vip.get('name', 'V')}&background=FFD700&color=000")
        })
    
    return {
        "alerts": alerts[:5]  # Top 5 VIP alerts
    }


# Update the redeem_reward to include QR code
@api_router.post("/rewards/redeem-with-qr")
async def redeem_reward_with_qr(request: Request, reward_id: str, venue_id: Optional[str] = None):
    """Redeem reward and get a QR code for redemption"""
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
    
    # Deduct points
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"points_balance": -reward["points_cost"]}}
    )
    
    # Create redemption with QR code
    redemption_id = str(uuid.uuid4())
    qr_code = generate_qr_code(redemption_id, user["user_id"])
    
    redemption = {
        "id": redemption_id,
        "user_id": user["user_id"],
        "reward_id": reward_id,
        "reward_name": reward["name"],
        "reward_description": reward.get("description", ""),
        "reward_category": reward.get("category", "general"),
        "points_spent": reward["points_cost"],
        "venue_id": venue_id,
        "qr_code": qr_code,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=48)
    }
    
    await db.redemptions.insert_one(redemption)
    
    # Record points transaction
    await db.points_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "amount": -reward["points_cost"],
        "type": "reward_redemption",
        "description": f"Redeemed: {reward['name']}",
        "reward_id": reward_id,
        "redemption_id": redemption_id,
        "created_at": datetime.now(timezone.utc)
    })
    
    new_user = await db.users.find_one({"user_id": user["user_id"]})
    
    return {
        "success": True,
        "message": "Reward redeemed! Show QR code at venue.",
        "redemption": clean_mongo_doc(redemption),
        "qr_code": qr_code,
        "new_balance": new_user["points_balance"]
    }

# NOTE: Events API moved to routes/events.py

# NOTE: Boosts API moved to routes/boosts.py

# NOTE: Auctions API moved to routes/auctions.py

# NOTE: Photos and Video API moved to routes/photos.py

# NOTE: Referral API moved to routes/referrals.py

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

@api_router.get("/safety/emergency-services")
async def get_emergency_services(venue_id: Optional[str] = None):
    """Get emergency services contact numbers"""
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

# ====== EMERGENCY CONTACTS API ======

class EmergencyContact(BaseModel):
    name: str
    phone: str
    relationship: str  # friend, family, partner, other
    email: Optional[str] = None

@api_router.get("/safety/emergency-contacts")
async def get_emergency_contacts(request: Request):
    """Get user's emergency contacts"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    contacts = user.get("emergency_contacts", []) if user else []
    
    return {"contacts": contacts}

@api_router.post("/safety/emergency-contacts")
async def add_emergency_contact(request: Request, contact: EmergencyContact):
    """Add an emergency contact"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    contact_data = {
        "id": str(uuid.uuid4())[:8],
        "name": contact.name,
        "phone": contact.phone,
        "email": contact.email,
        "relationship": contact.relationship,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$push": {"emergency_contacts": contact_data}}
    )
    
    return {"success": True, "contact": contact_data}

@api_router.delete("/safety/emergency-contacts/{contact_id}")
async def remove_emergency_contact(request: Request, contact_id: str):
    """Remove an emergency contact"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$pull": {"emergency_contacts": {"id": contact_id}}}
    )
    
    return {"success": True, "message": "Contact removed"}

class SilentAlertRequest(BaseModel):
    latitude: float
    longitude: float
    venue_id: Optional[str] = None
    activation_method: str = "button"  # button, shake, hidden

@api_router.post("/safety/silent-alert")
async def send_silent_alert(request: Request, alert: SilentAlertRequest):
    """Send a silent/discreet safety alert to emergency contacts, crew, and venue"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    user_name = user.get("name", "Someone") if user else "Someone"
    
    # Create the alert record
    alert_record = {
        "id": str(uuid.uuid4())[:8],
        "user_id": current_user["user_id"],
        "user_name": user_name,
        "alert_type": "silent_emergency",
        "latitude": alert.latitude,
        "longitude": alert.longitude,
        "venue_id": alert.venue_id,
        "activation_method": alert.activation_method,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "acknowledged_by": [],
        "resolved_at": None
    }
    await db.safety_alerts.insert_one(alert_record)
    
    notified = {"crew": [], "emergency_contacts": [], "venue": None}
    google_maps_link = f"https://maps.google.com/?q={alert.latitude},{alert.longitude}"
    
    # 1. Notify all crew members in user's crews
    crews = await db.crews.find({"members.user_id": current_user["user_id"]}).to_list(10)
    for crew in crews:
        for member in crew.get("members", []):
            member_id = member.get("user_id")
            if member_id and member_id != current_user["user_id"]:
                notification = {
                    "id": str(uuid.uuid4())[:8],
                    "user_id": member_id,
                    "type": "silent_safety_alert",
                    "alert_id": alert_record["id"],
                    "title": f"🚨 URGENT: {user_name} needs help!",
                    "body": f"Silent alert activated. Tap to see location.",
                    "data": {
                        "alert_id": alert_record["id"],
                        "latitude": alert.latitude,
                        "longitude": alert.longitude,
                        "maps_link": google_maps_link,
                        "alert_type": "silent_emergency"
                    },
                    "read": False,
                    "priority": "critical",
                    "created_at": datetime.now(timezone.utc)
                }
                await db.safety_notifications.insert_one(notification)
                notified["crew"].append(member.get("name", member_id))
    
    # 2. Notify emergency contacts (SMS/email would be sent in production)
    emergency_contacts = user.get("emergency_contacts", []) if user else []
    for contact in emergency_contacts:
        # In production, send SMS via Twilio
        # For now, create a record of the notification
        contact_notification = {
            "id": str(uuid.uuid4())[:8],
            "alert_id": alert_record["id"],
            "contact_name": contact.get("name"),
            "contact_phone": contact.get("phone"),
            "contact_email": contact.get("email"),
            "message": f"URGENT: {user_name} has activated an emergency alert. Location: {google_maps_link}",
            "status": "pending",  # In production: "sent"
            "created_at": datetime.now(timezone.utc)
        }
        await db.emergency_notifications.insert_one(contact_notification)
        notified["emergency_contacts"].append(contact.get("name"))
    
    # 3. Notify venue staff if at a venue
    if alert.venue_id:
        venue = await db.venues.find_one({"id": alert.venue_id})
        if venue:
            venue_alert = {
                "id": str(uuid.uuid4())[:8],
                "venue_id": alert.venue_id,
                "venue_name": venue.get("name", "Venue"),
                "alert_id": alert_record["id"],
                "user_name": user_name,
                "alert_type": "silent_emergency",
                "latitude": alert.latitude,
                "longitude": alert.longitude,
                "priority": "critical",
                "status": "pending",
                "created_at": datetime.now(timezone.utc)
            }
            await db.venue_alerts.insert_one(venue_alert)
            notified["venue"] = venue.get("name")
            
            # Also notify venue staff users
            venue_staff = await db.users.find({"venue_id": alert.venue_id, "is_venue_staff": True}).to_list(20)
            for staff in venue_staff:
                staff_notification = {
                    "id": str(uuid.uuid4())[:8],
                    "user_id": staff["user_id"],
                    "type": "venue_emergency_alert",
                    "alert_id": alert_record["id"],
                    "title": "🚨 EMERGENCY at your venue!",
                    "body": f"{user_name} needs immediate assistance.",
                    "data": {
                        "alert_id": alert_record["id"],
                        "latitude": alert.latitude,
                        "longitude": alert.longitude,
                        "maps_link": google_maps_link
                    },
                    "read": False,
                    "priority": "critical",
                    "created_at": datetime.now(timezone.utc)
                }
                await db.safety_notifications.insert_one(staff_notification)
    
    return {
        "success": True,
        "alert_id": alert_record["id"],
        "message": "Silent alert sent to all contacts",
        "notified": notified,
        "location_link": google_maps_link
    }

# ====== FRIENDS & SOCIAL API ======

class FriendRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None

@api_router.get("/friends")
async def get_friends(request: Request):
    """Get user's friends list"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    friend_ids = user.get("friends", []) if user else []
    
    # Get friend details
    friends = []
    for friend_id in friend_ids:
        friend = await db.users.find_one({"user_id": friend_id})
        if friend:
            friends.append({
                "user_id": friend["user_id"],
                "name": friend.get("name", "Unknown"),
                "username": friend.get("username"),
                "avatar": friend.get("avatar"),
                "tier": friend.get("tier", "bronze")
            })
    
    return {"friends": friends, "count": len(friends)}

@api_router.post("/friends/request")
async def send_friend_request(request: Request, friend_req: FriendRequest):
    """Send a friend request by email or username"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Find target user
    target_user = None
    if friend_req.email:
        target_user = await db.users.find_one({"email": friend_req.email.lower()})
    elif friend_req.username:
        target_user = await db.users.find_one({"username": friend_req.username.lower()})
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user["user_id"] == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a friend")
    
    # Check if already friends
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if target_user["user_id"] in user.get("friends", []):
        raise HTTPException(status_code=400, detail="Already friends")
    
    # Check if request already exists
    existing = await db.friend_requests.find_one({
        "from_user_id": current_user["user_id"],
        "to_user_id": target_user["user_id"],
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already sent")
    
    # Create friend request
    friend_request = {
        "id": str(uuid.uuid4())[:8],
        "from_user_id": current_user["user_id"],
        "from_name": user.get("name", "Unknown"),
        "to_user_id": target_user["user_id"],
        "to_name": target_user.get("name", "Unknown"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.friend_requests.insert_one(friend_request)
    
    # Create notification for target user
    notification = {
        "id": str(uuid.uuid4())[:8],
        "user_id": target_user["user_id"],
        "type": "friend_request",
        "title": "New Friend Request",
        "body": f"{user.get('name', 'Someone')} wants to be friends",
        "data": {"request_id": friend_request["id"]},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    return {"success": True, "message": "Friend request sent", "request_id": friend_request["id"]}

@api_router.get("/friends/requests")
async def get_friend_requests(request: Request):
    """Get pending friend requests"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Incoming requests
    incoming = await db.friend_requests.find({
        "to_user_id": current_user["user_id"],
        "status": "pending"
    }).to_list(50)
    
    # Outgoing requests
    outgoing = await db.friend_requests.find({
        "from_user_id": current_user["user_id"],
        "status": "pending"
    }).to_list(50)
    
    return {
        "incoming": clean_mongo_docs(incoming),
        "outgoing": clean_mongo_docs(outgoing)
    }

@api_router.post("/friends/requests/{request_id}/accept")
async def accept_friend_request(request: Request, request_id: str):
    """Accept a friend request"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    friend_request = await db.friend_requests.find_one({
        "id": request_id,
        "to_user_id": current_user["user_id"],
        "status": "pending"
    })
    
    if not friend_request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    # Add each user to the other's friends list
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$addToSet": {"friends": friend_request["from_user_id"]}}
    )
    await db.users.update_one(
        {"user_id": friend_request["from_user_id"]},
        {"$addToSet": {"friends": current_user["user_id"]}}
    )
    
    # Update request status
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc)}}
    )
    
    # Notify the requester
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    notification = {
        "id": str(uuid.uuid4())[:8],
        "user_id": friend_request["from_user_id"],
        "type": "friend_accepted",
        "title": "Friend Request Accepted",
        "body": f"{user.get('name', 'Someone')} accepted your friend request!",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    return {"success": True, "message": "Friend request accepted"}

@api_router.post("/friends/requests/{request_id}/decline")
async def decline_friend_request(request: Request, request_id: str):
    """Decline a friend request"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.friend_requests.update_one(
        {"id": request_id, "to_user_id": current_user["user_id"]},
        {"$set": {"status": "declined", "declined_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "message": "Friend request declined"}

@api_router.delete("/friends/{friend_id}")
async def remove_friend(request: Request, friend_id: str):
    """Remove a friend"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Remove from both users' friends lists
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$pull": {"friends": friend_id}}
    )
    await db.users.update_one(
        {"user_id": friend_id},
        {"$pull": {"friends": current_user["user_id"]}}
    )
    
    return {"success": True, "message": "Friend removed"}

@api_router.get("/friends/activity")
async def get_friends_activity(request: Request):
    """Get activity feed from friends"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    friend_ids = user.get("friends", []) if user else []
    
    if not friend_ids:
        return {"activities": []}
    
    # Get various activities from friends
    activities = []
    
    # Event attendance
    event_rsvps = await db.event_rsvps.find({
        "user_id": {"$in": friend_ids},
        "status": {"$in": ["going", "interested"]},
        "is_private": {"$ne": True}
    }).sort("created_at", -1).limit(20).to_list(20)
    
    for rsvp in event_rsvps:
        friend = await db.users.find_one({"user_id": rsvp["user_id"]})
        activities.append({
            "type": "event_rsvp",
            "user_id": rsvp["user_id"],
            "user_name": friend.get("name", "Friend") if friend else "Friend",
            "user_avatar": friend.get("avatar") if friend else None,
            "event_id": rsvp["event_id"],
            "event_name": rsvp.get("event_name", "an event"),
            "status": rsvp["status"],
            "created_at": rsvp["created_at"].isoformat() if isinstance(rsvp["created_at"], datetime) else rsvp["created_at"]
        })
    
    # Check-ins
    checkins = await db.checkins.find({
        "user_id": {"$in": friend_ids},
        "is_private": {"$ne": True}
    }).sort("created_at", -1).limit(20).to_list(20)
    
    for checkin in checkins:
        friend = await db.users.find_one({"user_id": checkin["user_id"]})
        activities.append({
            "type": "checkin",
            "user_id": checkin["user_id"],
            "user_name": friend.get("name", "Friend") if friend else "Friend",
            "user_avatar": friend.get("avatar") if friend else None,
            "venue_id": checkin.get("venue_id"),
            "venue_name": checkin.get("venue_name", "a venue"),
            "created_at": checkin["created_at"].isoformat() if isinstance(checkin["created_at"], datetime) else checkin["created_at"]
        })
    
    # Sort all activities by date
    activities.sort(key=lambda x: x["created_at"], reverse=True)
    
    return {"activities": activities[:30]}

# ====== EVENT RSVP API ======

@api_router.post("/events/{event_id}/rsvp")
async def rsvp_to_event(request: Request, event_id: str, rsvp: EventRSVP):
    """RSVP to an event (going/interested)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Get event details
    event = await db.events.find_one({"id": event_id})
    event_name = event.get("title", "Event") if event else "Event"
    
    # Update or create RSVP
    await db.event_rsvps.update_one(
        {"user_id": current_user["user_id"], "event_id": event_id},
        {"$set": {
            "user_id": current_user["user_id"],
            "event_id": event_id,
            "event_name": event_name,
            "status": rsvp.status,
            "is_private": rsvp.is_private,
            "updated_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"success": True, "message": f"Marked as {rsvp.status}", "status": rsvp.status}

@api_router.get("/events/{event_id}/rsvp")
async def get_my_event_rsvp(request: Request, event_id: str):
    """Get user's RSVP status for an event"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    rsvp = await db.event_rsvps.find_one({
        "user_id": current_user["user_id"],
        "event_id": event_id
    })
    
    return {"rsvp": clean_mongo_doc(rsvp) if rsvp else None}

@api_router.get("/events/{event_id}/attendees")
async def get_event_attendees(request: Request, event_id: str):
    """Get list of people going/interested in an event"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    friend_ids = user.get("friends", []) if user else []
    
    # Get all RSVPs for this event
    going = await db.event_rsvps.find({
        "event_id": event_id,
        "status": "going",
        "is_private": {"$ne": True}
    }).to_list(100)
    
    interested = await db.event_rsvps.find({
        "event_id": event_id,
        "status": "interested",
        "is_private": {"$ne": True}
    }).to_list(100)
    
    # Separate friends from others
    friends_going = []
    others_going = []
    for rsvp in going:
        attendee = await db.users.find_one({"user_id": rsvp["user_id"]})
        if attendee:
            attendee_data = {
                "user_id": attendee["user_id"],
                "name": attendee.get("name", "Unknown"),
                "avatar": attendee.get("avatar"),
                "is_friend": rsvp["user_id"] in friend_ids
            }
            if rsvp["user_id"] in friend_ids:
                friends_going.append(attendee_data)
            else:
                others_going.append(attendee_data)
    
    friends_interested = []
    for rsvp in interested:
        if rsvp["user_id"] in friend_ids:
            attendee = await db.users.find_one({"user_id": rsvp["user_id"]})
            if attendee:
                friends_interested.append({
                    "user_id": attendee["user_id"],
                    "name": attendee.get("name", "Unknown"),
                    "avatar": attendee.get("avatar")
                })
    
    return {
        "going_count": len(going),
        "interested_count": len(interested),
        "friends_going": friends_going,
        "friends_interested": friends_interested,
        "others_going_count": len(others_going)
    }

# ====== LOST & FOUND API ======

class LostItemReport(BaseModel):
    venue_id: str
    item_description: str
    item_category: str  # phone, wallet, keys, bag, clothing, jewelry, other
    lost_date: str
    lost_time_approx: Optional[str] = None
    contact_phone: Optional[str] = None
    photo_url: Optional[str] = None

class FoundItemReport(BaseModel):
    venue_id: str
    item_description: str
    item_category: str
    found_date: str
    found_location: Optional[str] = None  # e.g., "near bar", "bathroom", "dance floor"
    photo_url: Optional[str] = None

@api_router.post("/lost-found/report-lost")
async def report_lost_item(request: Request, item: LostItemReport):
    """Report a lost item"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    lost_item = {
        "id": str(uuid.uuid4())[:8],
        "type": "lost",
        "user_id": current_user["user_id"],
        "user_name": user.get("name", "Unknown") if user else "Unknown",
        "user_email": user.get("email") if user else None,
        "venue_id": item.venue_id,
        "item_description": item.item_description,
        "item_category": item.item_category,
        "lost_date": item.lost_date,
        "lost_time_approx": item.lost_time_approx,
        "contact_phone": item.contact_phone,
        "photo_url": item.photo_url,
        "status": "reported",  # reported, matched, claimed, closed
        "matched_with": None,
        "created_at": datetime.now(timezone.utc)
    }
    await db.lost_found.insert_one(lost_item)
    
    # Check for potential matches
    potential_matches = await db.lost_found.find({
        "type": "found",
        "venue_id": item.venue_id,
        "item_category": item.item_category,
        "status": "reported"
    }).to_list(10)
    
    return {
        "success": True,
        "item_id": lost_item["id"],
        "message": "Lost item reported. We'll notify you if it's found.",
        "potential_matches": len(potential_matches)
    }

@api_router.post("/lost-found/report-found")
async def report_found_item(request: Request, item: FoundItemReport):
    """Report a found item (venue staff only)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    found_item = {
        "id": str(uuid.uuid4())[:8],
        "type": "found",
        "reported_by_user_id": current_user["user_id"],
        "reported_by_name": user.get("name", "Unknown") if user else "Unknown",
        "venue_id": item.venue_id,
        "item_description": item.item_description,
        "item_category": item.item_category,
        "found_date": item.found_date,
        "found_location": item.found_location,
        "photo_url": item.photo_url,
        "status": "reported",
        "claimed_by": None,
        "created_at": datetime.now(timezone.utc)
    }
    await db.lost_found.insert_one(found_item)
    
    # Check for matching lost items and notify owners
    matching_lost = await db.lost_found.find({
        "type": "lost",
        "venue_id": item.venue_id,
        "item_category": item.item_category,
        "status": "reported"
    }).to_list(20)
    
    for lost in matching_lost:
        notification = {
            "id": str(uuid.uuid4())[:8],
            "user_id": lost["user_id"],
            "type": "potential_item_match",
            "title": "Potential Match Found!",
            "body": f"An item matching your lost {item.item_category} was found at {item.venue_id}",
            "data": {"lost_item_id": lost["id"], "found_item_id": found_item["id"]},
            "read": False,
            "created_at": datetime.now(timezone.utc)
        }
        await db.notifications.insert_one(notification)
    
    return {
        "success": True,
        "item_id": found_item["id"],
        "message": "Found item logged",
        "matching_reports": len(matching_lost)
    }

@api_router.get("/lost-found/my-reports")
async def get_my_lost_reports(request: Request):
    """Get user's lost item reports"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    reports = await db.lost_found.find({
        "user_id": current_user["user_id"],
        "type": "lost"
    }).sort("created_at", -1).to_list(20)
    
    return {"reports": clean_mongo_docs(reports)}

@api_router.get("/lost-found/venue/{venue_id}")
async def get_venue_lost_found(request: Request, venue_id: str, item_type: Optional[str] = None):
    """Get lost/found items at a venue (for venue staff)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    query = {"venue_id": venue_id}
    if item_type:
        query["type"] = item_type
    
    items = await db.lost_found.find(query).sort("created_at", -1).to_list(50)
    
    return {"items": clean_mongo_docs(items)}

@api_router.post("/lost-found/{item_id}/claim")
async def claim_found_item(request: Request, item_id: str):
    """Claim a found item"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.lost_found.update_one(
        {"id": item_id, "type": "found"},
        {"$set": {
            "status": "claimed",
            "claimed_by": current_user["user_id"],
            "claimed_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"success": True, "message": "Item claimed. Please visit the venue to collect it."}

class LostFoundMessage(BaseModel):
    item_id: str
    message: str

@api_router.post("/lost-found/message")
async def send_lost_found_message(request: Request, msg: LostFoundMessage):
    """Send a message about a lost/found item"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    message = {
        "id": str(uuid.uuid4())[:8],
        "item_id": msg.item_id,
        "from_user_id": current_user["user_id"],
        "from_name": user.get("name", "Unknown") if user else "Unknown",
        "message": msg.message,
        "created_at": datetime.now(timezone.utc)
    }
    await db.lost_found_messages.insert_one(message)
    
    # Notify item owner/reporter
    item = await db.lost_found.find_one({"id": msg.item_id})
    if item:
        notify_user_id = item.get("user_id") or item.get("reported_by_user_id")
        if notify_user_id and notify_user_id != current_user["user_id"]:
            notification = {
                "id": str(uuid.uuid4())[:8],
                "user_id": notify_user_id,
                "type": "lost_found_message",
                "title": "New message about your item",
                "body": msg.message[:50] + "..." if len(msg.message) > 50 else msg.message,
                "data": {"item_id": msg.item_id},
                "read": False,
                "created_at": datetime.now(timezone.utc)
            }
            await db.notifications.insert_one(notification)
    
    return {"success": True, "message_id": message["id"]}

@api_router.get("/lost-found/{item_id}/messages")
async def get_lost_found_messages(request: Request, item_id: str):
    """Get messages for a lost/found item"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    messages = await db.lost_found_messages.find({"item_id": item_id}).sort("created_at", 1).to_list(100)
    
    return {"messages": clean_mongo_docs(messages)}

# ====== RIDE SHARING INTEGRATION ======

@api_router.get("/rides/options")
async def get_ride_options(request: Request, latitude: float, longitude: float, venue_id: Optional[str] = None):
    """Get ride sharing options with deep links"""
    
    # Get venue address if provided
    destination_name = "Luna Group Venue"
    if venue_id:
        venue = await db.venues.find_one({"id": venue_id})
        if venue:
            destination_name = venue.get("name", "Luna Group Venue")
    
    # Build deep links for ride apps
    ride_options = [
        {
            "provider": "uber",
            "name": "Uber",
            "icon": "car",
            "color": "#000000",
            "deep_link": f"uber://?action=setPickup&pickup[latitude]={latitude}&pickup[longitude]={longitude}&pickup[nickname]=Current%20Location",
            "web_fallback": f"https://m.uber.com/ul/?action=setPickup&pickup[latitude]={latitude}&pickup[longitude]={longitude}",
            "affiliate_note": "Partner integration pending"
        },
        {
            "provider": "didi",
            "name": "DiDi",
            "icon": "car-sport",
            "color": "#FF7700",
            "deep_link": f"didiglobal://",
            "web_fallback": "https://web.didiglobal.com/",
            "affiliate_note": "Partner integration pending"
        },
        {
            "provider": "ola",
            "name": "Ola",
            "icon": "car",
            "color": "#1BA94C",
            "deep_link": f"olacabs://app/launch?lat={latitude}&lng={longitude}",
            "web_fallback": "https://book.olacabs.com/",
            "affiliate_note": "Partner integration pending"
        }
    ]
    
    return {
        "pickup_location": {"latitude": latitude, "longitude": longitude},
        "destination": destination_name,
        "options": ride_options
    }

# ====== PRIVACY SETTINGS API ======

class PrivacySettings(BaseModel):
    show_activity_to_friends: bool = True
    show_event_attendance: bool = True
    show_checkins: bool = True
    allow_friend_requests: bool = True

@api_router.get("/settings/privacy")
async def get_privacy_settings(request: Request):
    """Get user's privacy settings"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    settings = user.get("privacy_settings", {}) if user else {}
    
    return {
        "show_activity_to_friends": settings.get("show_activity_to_friends", True),
        "show_event_attendance": settings.get("show_event_attendance", True),
        "show_checkins": settings.get("show_checkins", True),
        "allow_friend_requests": settings.get("allow_friend_requests", True)
    }

@api_router.put("/settings/privacy")
async def update_privacy_settings(request: Request, settings: PrivacySettings):
    """Update user's privacy settings"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"privacy_settings": settings.dict()}}
    )
    
    return {"success": True, "message": "Privacy settings updated"}


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


# ====== VENUE PORTAL STATIC FILES ======
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Mount venue portal static assets on app directly (before router)
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
    """Serve the venue portal SPA for all paths (excluding assets)"""
    # Skip if path starts with assets/ - let the mount handle it
    if path.startswith("assets/"):
        # Return the actual file from assets
        asset_path = VENUE_PORTAL_DIR / path
        if asset_path.exists():
            # Determine content type
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

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(api_router)

@app.get("/")
async def root():
    return {"message": "Luna Group VIP API", "venues": len(LUNA_VENUES), "scheduler": "active"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
