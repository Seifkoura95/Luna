"""
Notifications API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_docs

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationPreferencesRequest(BaseModel):
    event_reminders: Optional[bool] = True
    auction_updates: Optional[bool] = True
    friend_activity: Optional[bool] = True
    promotions: Optional[bool] = True
    safety_alerts: Optional[bool] = True
    favorite_venues: Optional[bool] = True


class RegisterPushTokenRequest(BaseModel):
    token: str


@router.get("")
async def get_notifications(request: Request, unread_only: bool = False, limit: int = 50):
    """Get user's notifications"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    query = {"user_id": current_user["user_id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(query).sort("created_at", -1).to_list(limit)
    
    return clean_mongo_docs(notifications)


@router.post("/mark-read")
async def mark_notifications_read(request: Request, notification_ids: Optional[list] = None):
    """Mark notifications as read"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    query = {"user_id": current_user["user_id"]}
    if notification_ids:
        query["id"] = {"$in": notification_ids}
    
    result = await db.notifications.update_many(
        query,
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    return {"success": True, "marked_count": result.modified_count}


@router.delete("/{notification_id}")
async def delete_notification(request: Request, notification_id: str):
    """Delete a notification"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.notifications.delete_one({
        "id": notification_id,
        "user_id": current_user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True, "message": "Notification deleted"}


@router.get("/preferences")
async def get_notification_preferences(request: Request):
    """Get user's notification preferences"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    prefs = await db.notification_preferences.find_one({"user_id": current_user["user_id"]})
    
    if not prefs:
        return {
            "event_reminders": True,
            "auction_updates": True,
            "friend_activity": True,
            "promotions": True,
            "safety_alerts": True,
            "favorite_venues": True
        }
    
    prefs.pop("_id", None)
    prefs.pop("user_id", None)
    return prefs


@router.put("/preferences")
async def update_notification_preferences(request: Request, prefs: NotificationPreferencesRequest):
    """Update notification preferences"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.notification_preferences.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "user_id": current_user["user_id"],
            **prefs.model_dump(exclude_none=True),
            "updated_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Preferences updated"}


@router.post("/register-push-token")
async def register_push_token(request: Request, token_req: RegisterPushTokenRequest):
    """Register device push token for notifications"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$set": {"push_token": token_req.token},
            "$addToSet": {"push_tokens": token_req.token}
        }
    )
    
    return {"success": True, "message": "Push token registered"}


@router.delete("/push-token")
async def remove_push_token(request: Request, token: str):
    """Remove a push token"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$pull": {"push_tokens": token}}
    )
    
    return {"success": True, "message": "Push token removed"}


@router.get("/unread-count")
async def get_unread_count(request: Request):
    """Get count of unread notifications"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    count = await db.notifications.count_documents({
        "user_id": current_user["user_id"],
        "read": False
    })
    
    return {"unread_count": count}
