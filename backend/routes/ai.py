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
    Chat history is stored per-user with strict isolation.
    """
    current_user = await get_user_from_request(request)
    user_id = current_user.get("user_id")
    
    # Generate session ID if not provided - ALWAYS prefixed with user_id for security
    session_id = body.session_id or f"chat-{user_id}-{datetime.now().timestamp()}"
    
    # Validate session belongs to this user
    if not session_id.startswith(f"chat-{user_id}"):
        raise HTTPException(status_code=403, detail="Invalid session - access denied")
    
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
        user_id=user_id,  # Pass user_id for isolation
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


# ====== CHAT HISTORY & SESSION MANAGEMENT ======

@router.get("/chat/history")
async def get_my_chat_history(request: Request, session_id: Optional[str] = None, limit: int = 50):
    """
    Get chat history for the current user.
    Only returns messages belonging to the authenticated user.
    """
    current_user = await get_user_from_request(request)
    user_id = current_user.get("user_id")
    
    query = {"user_id": user_id}  # ALWAYS filter by user_id
    if session_id:
        # Validate session belongs to this user
        if not session_id.startswith(f"chat-{user_id}"):
            raise HTTPException(status_code=403, detail="Access denied - invalid session")
        query["session_id"] = session_id
    
    messages = await db.chat_history.find(
        query,
        {"_id": 0, "role": 1, "content": 1, "timestamp": 1, "session_id": 1}
    ).sort("timestamp", -1).to_list(limit)
    
    return {
        "messages": messages,
        "total": len(messages),
        "user_id": user_id
    }


@router.get("/chat/sessions")
async def get_my_chat_sessions(request: Request):
    """
    Get list of chat sessions for the current user.
    Each session is isolated to this user only.
    """
    current_user = await get_user_from_request(request)
    user_id = current_user.get("user_id")
    
    # Get distinct sessions for this user only
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$session_id",
            "message_count": {"$sum": 1},
            "first_message": {"$min": "$timestamp"},
            "last_message": {"$max": "$timestamp"}
        }},
        {"$sort": {"last_message": -1}},
        {"$limit": 20}
    ]
    
    sessions = await db.chat_history.aggregate(pipeline).to_list(20)
    
    return {
        "sessions": [
            {
                "session_id": s["_id"],
                "message_count": s["message_count"],
                "first_message": s["first_message"],
                "last_message": s["last_message"]
            }
            for s in sessions
        ],
        "user_id": user_id
    }


@router.delete("/chat/history")
async def clear_my_chat_history(request: Request, session_id: Optional[str] = None):
    """
    Clear chat history for the current user.
    Can clear all history or a specific session.
    """
    current_user = await get_user_from_request(request)
    user_id = current_user.get("user_id")
    
    query = {"user_id": user_id}  # ALWAYS filter by user_id
    if session_id:
        if not session_id.startswith(f"chat-{user_id}"):
            raise HTTPException(status_code=403, detail="Access denied - invalid session")
        query["session_id"] = session_id
    
    result = await db.chat_history.delete_many(query)
    
    return {
        "success": True,
        "deleted_count": result.deleted_count,
        "scope": "session" if session_id else "all"
    }


# ====== ADMIN ENDPOINTS ======

@router.get("/admin/chat-logs")
async def get_all_chat_logs(request: Request, user_id: Optional[str] = None, limit: int = 100):
    """
    Admin endpoint to view chat logs.
    Requires admin/staff role.
    """
    current_user = await get_user_from_request(request)
    if current_user.get("role") not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if user_id:
        query["user_id"] = user_id
    
    messages = await db.chat_history.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).to_list(limit)
    
    # Get unique user count
    user_count = len(set(m.get("user_id") for m in messages))
    
    return {
        "messages": messages,
        "total": len(messages),
        "unique_users": user_count
    }


@router.get("/admin/chat-stats")
async def get_chat_stats(request: Request):
    """
    Admin endpoint to get chat usage statistics.
    """
    current_user = await get_user_from_request(request)
    if current_user.get("role") not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_messages = await db.chat_history.count_documents({})
    
    # Get unique users
    pipeline = [
        {"$group": {"_id": "$user_id"}},
        {"$count": "unique_users"}
    ]
    user_count = await db.chat_history.aggregate(pipeline).to_list(1)
    
    # Get unique sessions
    session_pipeline = [
        {"$group": {"_id": "$session_id"}},
        {"$count": "unique_sessions"}
    ]
    session_count = await db.chat_history.aggregate(session_pipeline).to_list(1)
    
    return {
        "total_messages": total_messages,
        "unique_users": user_count[0]["unique_users"] if user_count else 0,
        "unique_sessions": session_count[0]["unique_sessions"] if session_count else 0
    }
