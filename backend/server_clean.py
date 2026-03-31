"""
Luna Group VIP API - Clean Server
All route definitions are in modular files under /routes/
"""
from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import logging
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger

from database import db
from config import STRIPE_SECRET_KEY
import stripe

# Initialize Stripe
stripe.api_key = STRIPE_SECRET_KEY

# ====== SCHEDULER SETUP ======
scheduler = AsyncIOScheduler()

_megatix_sync_func = None
_notification_gen_func = None

def set_megatix_sync_func(func):
    global _megatix_sync_func
    _megatix_sync_func = func

def set_notification_gen_func(func):
    global _notification_gen_func
    _notification_gen_func = func

async def run_scheduled_sync():
    global _megatix_sync_func
    if _megatix_sync_func:
        logging.info("Running scheduled Megatix sync...")
        try:
            result = await _megatix_sync_func()
            logging.info(f"Scheduled sync completed: {result.get('message', 'done')}")
        except Exception as e:
            logging.error(f"Scheduled sync failed: {str(e)}")

async def run_scheduled_notifications():
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
    from services.scheduled_jobs import scheduled_jobs
    
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
    
    # Also run a sync on startup (after 90 seconds)
    scheduler.add_job(
        run_scheduled_sync,
        'date',
        run_date=datetime.now(timezone.utc) + timedelta(seconds=90),
        id="megatix_startup_sync",
        name="Megatix Startup Sync"
    )
    
    scheduler.start()
    scheduled_jobs.is_running = True
    logging.info("Event scheduler started - Megatix sync every 12 hours, churn analysis daily at 3AM, win-back dispatch every 4 hours")
    
    yield
    
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

# ====== CORS ======
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router)
