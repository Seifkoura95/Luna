"""
Luna Group VIP API - Main Server
Cleaned version with modular routes
"""

from fastapi import FastAPI, APIRouter, HTTPException
from starlette.middleware.cors import CORSMiddleware
import logging
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from pathlib import Path
from fastapi.responses import FileResponse

# Root directory for static files
ROOT_DIR = Path(__file__).parent

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

# Serve AI-generated bottle service product photos.
# Directory is resolved relative to this file so the server works on any host
# (Emergent pod, Railway container, local dev). Auto-created on boot so a
# fresh deploy with no pre-existing static assets does not crash.
from fastapi.staticfiles import StaticFiles
from pathlib import Path as _Path
_BOTTLES_DIR = _Path(__file__).resolve().parent / "static" / "bottles"
_BOTTLES_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/static/bottles", StaticFiles(directory=str(_BOTTLES_DIR)), name="bottle-photos")


@app.get("/")
async def root():
    return {"message": "Luna Group VIP API", "venues": len(LUNA_VENUES), "scheduler": "active"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
