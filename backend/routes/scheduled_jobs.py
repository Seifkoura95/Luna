"""
Scheduled Jobs API Routes
Endpoints for managing and monitoring scheduled jobs.
"""
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import logging

from database import db
from utils.auth import get_current_user
from services.scheduled_jobs import scheduled_jobs
from services.churn_service import churn_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/jobs", tags=["Scheduled Jobs"])


class TriggerJobRequest(BaseModel):
    job_name: str


@router.get("/status")
async def get_jobs_status(request: Request):
    """
    Get status of scheduled jobs.
    Admin only endpoint.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Get user from DB to check role
    user = await db.users.find_one({"user_id": current_user.get("user_id")})
    if not user or user.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get recent job runs
    recent_runs = await db.scheduled_job_runs.find({}).sort("started_at", -1).limit(20).to_list(20)
    
    for run in recent_runs:
        run["_id"] = str(run["_id"])
        if run.get("started_at"):
            run["started_at"] = run["started_at"].isoformat()
        if run.get("completed_at"):
            run["completed_at"] = run["completed_at"].isoformat()
    
    return {
        "scheduler_running": scheduled_jobs.is_running,
        "jobs": [
            {
                "name": "daily_churn_analysis",
                "schedule": "Daily at 3 AM",
                "description": "Analyzes user churn risk and updates scores"
            },
            {
                "name": "win_back_dispatch",
                "schedule": "Every 4 hours",
                "description": "Sends win-back campaigns to high-risk users"
            },
            {
                "name": "auction_ending_notifications",
                "schedule": "Every 5 minutes",
                "description": "Notifies bidders when auctions are ending soon"
            },
            {
                "name": "event_reminders",
                "schedule": "Every 15 minutes",
                "description": "Sends reminders for upcoming events"
            }
        ],
        "recent_runs": recent_runs
    }


@router.post("/trigger")
async def trigger_job(
    request: Request, 
    body: TriggerJobRequest,
    background_tasks: BackgroundTasks
):
    """
    Manually trigger a scheduled job.
    Admin only endpoint.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user.get("user_id")})
    if not user or user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    valid_jobs = [
        "daily_churn_analysis",
        "win_back_dispatch",
        "auction_ending_notifications",
        "event_reminders"
    ]
    
    if body.job_name not in valid_jobs:
        raise HTTPException(status_code=400, detail=f"Invalid job name. Valid: {valid_jobs}")
    
    # Trigger job in background
    if body.job_name == "daily_churn_analysis":
        background_tasks.add_task(scheduled_jobs.run_daily_churn_analysis)
    elif body.job_name == "win_back_dispatch":
        background_tasks.add_task(scheduled_jobs.dispatch_win_back_campaigns)
    elif body.job_name == "auction_ending_notifications":
        background_tasks.add_task(scheduled_jobs.send_auction_ending_notifications)
    elif body.job_name == "event_reminders":
        background_tasks.add_task(scheduled_jobs.send_event_reminders)
    
    return {
        "status": "triggered",
        "job_name": body.job_name,
        "message": f"Job '{body.job_name}' triggered successfully"
    }


@router.get("/churn-summary")
async def get_churn_summary(request: Request):
    """
    Get summary of churn analysis results.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user.get("user_id")})
    if not user or user.get("role") not in ["admin", "venue_manager", "staff"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    
    # Get churn dashboard stats
    stats = await churn_service.get_churn_dashboard_stats()
    
    # Get last job run
    last_run = await db.scheduled_job_runs.find_one(
        {"job_name": "daily_churn_analysis"},
        sort=[("started_at", -1)]
    )
    
    if last_run:
        last_run["_id"] = str(last_run["_id"])
        if last_run.get("started_at"):
            last_run["started_at"] = last_run["started_at"].isoformat()
        if last_run.get("completed_at"):
            last_run["completed_at"] = last_run["completed_at"].isoformat()
    
    return {
        "stats": stats,
        "last_analysis_run": last_run
    }


@router.get("/win-back-summary")
async def get_win_back_summary(request: Request):
    """
    Get summary of win-back campaign results.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user.get("user_id")})
    if not user or user.get("role") not in ["admin", "venue_manager", "staff"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    thirty_days_ago = now - timedelta(days=30)
    
    # Campaign stats
    total_campaigns = await db.win_back_campaigns.count_documents({})
    recent_campaigns = await db.win_back_campaigns.count_documents({
        "created_at": {"$gte": seven_days_ago}
    })
    claimed_campaigns = await db.win_back_campaigns.count_documents({
        "status": "claimed"
    })
    
    # Conversion rate (claimed / total)
    conversion_rate = (claimed_campaigns / total_campaigns * 100) if total_campaigns > 0 else 0
    
    # Get last dispatch run
    last_dispatch = await db.scheduled_job_runs.find_one(
        {"job_name": "win_back_dispatch"},
        sort=[("started_at", -1)]
    )
    
    if last_dispatch:
        last_dispatch["_id"] = str(last_dispatch["_id"])
        if last_dispatch.get("started_at"):
            last_dispatch["started_at"] = last_dispatch["started_at"].isoformat()
        if last_dispatch.get("completed_at"):
            last_dispatch["completed_at"] = last_dispatch["completed_at"].isoformat()
    
    return {
        "total_campaigns": total_campaigns,
        "campaigns_last_7_days": recent_campaigns,
        "claimed_campaigns": claimed_campaigns,
        "conversion_rate": round(conversion_rate, 1),
        "last_dispatch_run": last_dispatch
    }


@router.post("/start-scheduler")
async def start_scheduler(request: Request):
    """
    Start the scheduled jobs scheduler.
    Admin only endpoint.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user.get("user_id")})
    if not user or user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if scheduled_jobs.is_running:
        return {"status": "already_running", "message": "Scheduler is already running"}
    
    scheduled_jobs.start()
    
    return {"status": "started", "message": "Scheduler started successfully"}


@router.post("/stop-scheduler")
async def stop_scheduler(request: Request):
    """
    Stop the scheduled jobs scheduler.
    Admin only endpoint.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user.get("user_id")})
    if not user or user.get("role") not in ["admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not scheduled_jobs.is_running:
        return {"status": "already_stopped", "message": "Scheduler is not running"}
    
    scheduled_jobs.stop()
    
    return {"status": "stopped", "message": "Scheduler stopped successfully"}
