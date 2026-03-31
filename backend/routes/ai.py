"""
Luna AI Routes - API endpoints for AI-driven engagement features.
"""
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
import logging

from services.ai_service import luna_ai
from utils.auth import get_current_user
from database import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])


# Request/Response Models
class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None


class ChatResponse(BaseModel):
    response: str
    session_id: str


class AuctionNudgeRequest(BaseModel):
    auction_title: str
    current_bid: float
    user_last_bid: float
    time_remaining: str


class PersonalizedEventsRequest(BaseModel):
    events: List[Dict[str, Any]]
    user_history: Optional[Dict[str, Any]] = None


class SmartMissionRequest(BaseModel):
    user_stats: Optional[Dict[str, Any]] = None


class PhotoCaptionRequest(BaseModel):
    venue_name: str
    event_name: Optional[str] = None
    time_of_day: str = "night"


class ChurnAnalysisRequest(BaseModel):
    user_stats: Dict[str, Any]


class MemoryRecapRequest(BaseModel):
    visit_data: Dict[str, Any]


# Helper to get user from request
async def get_user_from_request(request: Request):
    """Get authenticated user from request headers"""
    authorization = request.headers.get("authorization")
    user_payload = get_current_user(authorization)
    
    # Fetch full user from DB
    user = await db.users.find_one({"user_id": user_payload["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# Endpoints

@router.post("/chat", response_model=ChatResponse)
async def ai_chat(request: Request, body: ChatRequest):
    """
    AI Concierge Chat - Chat with Luna AI for venue questions and recommendations.
    """
    current_user = await get_user_from_request(request)
    
    # Generate session ID if not provided
    session_id = body.session_id or f"chat-{current_user.get('user_id')}-{datetime.now().timestamp()}"
    
    # Build user context
    user_context = {
        "name": current_user.get("display_name") or current_user.get("email", "").split("@")[0],
        "tier": current_user.get("tier", "bronze"),
        "points": current_user.get("points_balance", 0),
        "favorite_venue": current_user.get("favorite_venue")
    }
    
    response = await luna_ai.get_chat_response(
        user_message=body.message,
        session_id=session_id,
        user_context=user_context
    )
    
    return ChatResponse(response=response, session_id=session_id)


@router.post("/auction-nudge")
async def generate_auction_nudge(request: Request, body: AuctionNudgeRequest):
    """
    Dynamic Auction Bid Nudging - Generate AI-powered outbid notification.
    """
    await get_user_from_request(request)  # Verify auth
    
    message = await luna_ai.generate_auction_nudge(
        auction_title=body.auction_title,
        current_bid=body.current_bid,
        user_last_bid=body.user_last_bid,
        time_remaining=body.time_remaining
    )
    
    return {
        "notification": {
            "title": "You've been outbid!",
            "body": message,
            "data": {
                "type": "auction_nudge",
                "auction_title": body.auction_title,
                "current_bid": body.current_bid
            }
        }
    }


@router.post("/personalized-events")
async def get_personalized_events(request: Request, body: PersonalizedEventsRequest):
    """
    Personalized "Tonight for You" - Get AI-curated event recommendations.
    """
    current_user = await get_user_from_request(request)
    
    # Get user history from current user if not provided
    user_history = body.user_history or {
        "favorite_venues": [current_user.get("favorite_venue")] if current_user.get("favorite_venue") else [],
        "events_attended": current_user.get("events_attended", 0),
        "music_preference": current_user.get("music_preference", "varied"),
        "visit_frequency": "regular" if current_user.get("total_visits", 0) > 5 else "occasional"
    }
    
    events = await luna_ai.generate_personalized_events(
        events=body.events,
        user_history=user_history
    )
    
    return {
        "events": events,
        "personalized": True
    }


@router.post("/smart-mission")
async def generate_smart_mission(request: Request, body: SmartMissionRequest = None):
    """
    Smart Mission Generation - Create AI-powered personalized missions.
    """
    current_user = await get_user_from_request(request)
    
    # Build user stats from current user if not provided
    user_stats = (body.user_stats if body else None) or {
        "total_visits": current_user.get("total_visits", 0),
        "streak": current_user.get("current_streak", 0),
        "points": current_user.get("points_balance", 0),
        "last_visit": str(current_user.get("last_visit_date", "never")),
        "tier": current_user.get("tier", "bronze"),
        "favorite_venue": current_user.get("favorite_venue")
    }
    
    mission = await luna_ai.generate_smart_mission(user_stats=user_stats)
    
    return {
        "mission": mission
    }


@router.post("/photo-caption")
async def generate_photo_caption(request: Request, body: PhotoCaptionRequest):
    """
    AI Photo Captioning - Generate captions for venue photos.
    """
    await get_user_from_request(request)  # Verify auth
    
    caption = await luna_ai.generate_photo_caption(
        venue_name=body.venue_name,
        event_name=body.event_name,
        time_of_day=body.time_of_day
    )
    
    return {
        "caption": caption,
        "suggestions": [
            caption,
            f"Living my best life at {body.venue_name}",
            f"Nights like these at {body.venue_name}"
        ]
    }


@router.post("/churn-analysis")
async def analyze_churn_risk(request: Request, body: ChurnAnalysisRequest):
    """
    Churn Prediction - Analyze user churn risk and generate win-back message.
    Admin endpoint for batch processing.
    """
    await get_user_from_request(request)  # Verify auth
    
    result = await luna_ai.analyze_churn_risk(user_stats=body.user_stats)
    
    return result


@router.get("/my-churn-status")
async def get_my_churn_status(request: Request):
    """
    Get current user's engagement status (used internally for win-back campaigns).
    """
    current_user = await get_user_from_request(request)
    
    user_stats = {
        "total_visits": current_user.get("total_visits", 0),
        "points": current_user.get("points_balance", 0),
        "tier": current_user.get("tier", "bronze"),
        "favorite_venue": current_user.get("favorite_venue"),
        "last_visit_date": current_user.get("last_visit_date")
    }
    
    result = await luna_ai.analyze_churn_risk(user_stats=user_stats)
    
    return {
        "engagement_status": result["risk_level"],
        "message": result.get("win_back_message") if result["risk_level"] != "low" else None
    }


@router.post("/memory-recap")
async def generate_memory_recap(request: Request, body: MemoryRecapRequest):
    """
    AI Memory Recap - Generate personalized night recap summary.
    """
    current_user = await get_user_from_request(request)
    user_id = str(current_user.get("user_id"))
    
    recap = await luna_ai.generate_memory_recap(
        user_id=user_id,
        visit_data=body.visit_data
    )
    
    return {
        "recap": recap
    }


@router.get("/health")
async def ai_health_check():
    """
    Check if AI service is operational.
    """
    import os
    has_key = bool(os.environ.get("EMERGENT_LLM_KEY"))
    
    return {
        "status": "operational" if has_key else "limited",
        "ai_enabled": has_key,
        "features": {
            "chat": has_key,
            "auction_nudge": has_key,
            "personalized_events": has_key,
            "smart_missions": has_key,
            "photo_captions": has_key,
            "churn_analysis": has_key,
            "memory_recap": has_key
        }
    }
