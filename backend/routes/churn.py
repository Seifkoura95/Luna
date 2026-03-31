"""
Churn Prediction API Routes
Endpoints for churn analysis and win-back campaigns.
"""
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
import logging

from services.churn_service import churn_service
from utils.auth import get_current_user
from database import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/churn", tags=["Churn Prediction"])


class TriggerWinBackRequest(BaseModel):
    user_id: str
    offer_type: Optional[str] = None


class BatchAnalysisRequest(BaseModel):
    limit: int = 100


@router.get("/analyze/{user_id}")
async def analyze_user_churn(request: Request, user_id: str):
    """
    Analyze churn risk for a specific user.
    Returns detailed risk metrics and win-back recommendations.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Fetch user from database to get role
    db_user = await db.users.find_one({"user_id": current_user.get("user_id")})
    user_role = db_user.get("role") if db_user else None
    
    # Check if admin or analyzing own account
    is_admin = user_role in ["admin", "venue_manager", "staff"]
    is_own_account = current_user.get("user_id") == user_id
    
    if not is_admin and not is_own_account:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    analysis = await churn_service.analyze_user_churn_risk(user_id)
    
    if "error" in analysis:
        raise HTTPException(status_code=404, detail=analysis["error"])
    
    return analysis


@router.get("/my-status")
async def get_my_churn_status(request: Request):
    """
    Get current user's engagement status and any available offers.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user.get("user_id")
    
    analysis = await churn_service.analyze_user_churn_risk(user_id)
    
    # Check for active win-back offers
    active_offer = await db.win_back_campaigns.find_one({
        "user_id": user_id,
        "status": {"$in": ["sent", "pending"]},
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    return {
        "engagement_level": "at_risk" if analysis.get("risk_level") in ["high", "medium"] else "healthy",
        "risk_level": analysis.get("risk_level"),
        "days_since_visit": analysis.get("metrics", {}).get("days_inactive", 0),
        "active_offer": {
            "type": active_offer.get("offer_type"),
            "value": active_offer.get("offer_value"),
            "expires_at": active_offer.get("expires_at").isoformat() if active_offer else None
        } if active_offer else None
    }


@router.post("/batch-analyze")
async def run_batch_analysis(
    request: Request, 
    body: BatchAnalysisRequest,
    background_tasks: BackgroundTasks
):
    """
    Run batch churn analysis on users.
    Admin/staff only endpoint.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Fetch user from database to get role
    db_user = await db.users.find_one({"user_id": current_user.get("user_id")})
    user_role = db_user.get("role") if db_user else None
    
    if user_role not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Run in background for large batches
    if body.limit > 50:
        background_tasks.add_task(churn_service.run_batch_analysis, body.limit)
        return {
            "status": "processing",
            "message": f"Batch analysis started for up to {body.limit} users",
            "check_status_at": "/api/churn/dashboard"
        }
    
    # Run immediately for small batches
    results = await churn_service.run_batch_analysis(body.limit)
    return results


@router.post("/trigger-winback")
async def trigger_win_back(request: Request, body: TriggerWinBackRequest):
    """
    Trigger a win-back campaign for a user.
    Admin/staff only endpoint.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Fetch user from database to get role
    db_user = await db.users.find_one({"user_id": current_user.get("user_id")})
    user_role = db_user.get("role") if db_user else None
    
    if user_role not in ["admin", "venue_manager", "staff"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    
    # Get offer if type specified
    offer = None
    if body.offer_type:
        for level_offers in churn_service.WIN_BACK_OFFERS.values():
            for o in level_offers:
                if o["type"] == body.offer_type:
                    offer = o
                    break
    
    result = await churn_service.trigger_win_back_campaign(body.user_id, offer)
    
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    
    return result


@router.get("/dashboard")
async def get_churn_dashboard(request: Request):
    """
    Get churn statistics for venue dashboard.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Fetch user from database to get role
    db_user = await db.users.find_one({"user_id": current_user.get("user_id")})
    user_role = db_user.get("role") if db_user else None
    
    if user_role not in ["admin", "venue_manager", "staff"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    
    stats = await churn_service.get_churn_dashboard_stats()
    
    # Get recent high-risk users
    high_risk_users = await db.users.find(
        {"churn_risk_level": "high"},
        {"user_id": 1, "email": 1, "churn_risk_score": 1, "last_visit_date": 1, "tier": 1, "_id": 0}
    ).sort("churn_risk_score", -1).limit(10).to_list(10)
    
    # Get recent campaigns
    recent_campaigns = await db.win_back_campaigns.find({}).sort("created_at", -1).limit(5).to_list(5)
    
    for c in recent_campaigns:
        c["_id"] = str(c["_id"])
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
        if c.get("expires_at"):
            c["expires_at"] = c["expires_at"].isoformat()
    
    stats["high_risk_users"] = high_risk_users
    stats["recent_campaigns"] = recent_campaigns
    
    return stats


@router.get("/campaigns")
async def get_win_back_campaigns(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50
):
    """
    Get win-back campaign history.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Fetch user from database to get role
    db_user = await db.users.find_one({"user_id": current_user.get("user_id")})
    user_role = db_user.get("role") if db_user else None
    
    if user_role not in ["admin", "venue_manager", "staff"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    
    query = {}
    if status:
        query["status"] = status
    
    campaigns = await db.win_back_campaigns.find(query).sort("created_at", -1).limit(limit).to_list(limit)
    
    for c in campaigns:
        c["_id"] = str(c["_id"])
        if c.get("created_at"):
            c["created_at"] = c["created_at"].isoformat()
        if c.get("expires_at"):
            c["expires_at"] = c["expires_at"].isoformat()
    
    return {"campaigns": campaigns}


@router.post("/claim-offer")
async def claim_win_back_offer(request: Request):
    """
    User claims their win-back offer.
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user.get("user_id")
    
    # Find active offer
    offer = await db.win_back_campaigns.find_one({
        "user_id": user_id,
        "status": {"$in": ["sent", "pending"]},
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not offer:
        raise HTTPException(status_code=404, detail="No active offer found")
    
    # Mark as claimed
    await db.win_back_campaigns.update_one(
        {"_id": offer["_id"]},
        {
            "$set": {
                "status": "claimed",
                "claimed_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "offer_type": offer.get("offer_type"),
        "offer_value": offer.get("offer_value"),
        "message": f"Offer claimed: {offer.get('offer_value')}"
    }
