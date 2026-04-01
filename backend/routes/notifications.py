"""
Notifications API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional, List
import uuid
import logging
from datetime import datetime, timezone
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_docs

router = APIRouter(prefix="/notifications", tags=["Notifications"])
logger = logging.getLogger(__name__)


class NotificationPreferencesRequest(BaseModel):
    event_reminders: Optional[bool] = True
    auction_updates: Optional[bool] = True
    friend_activity: Optional[bool] = True
    promotions: Optional[bool] = True
    safety_alerts: Optional[bool] = True
    favorite_venues: Optional[bool] = True


class RegisterPushTokenRequest(BaseModel):
    """Request model for push token registration"""
    push_token: str = None  # Support both field names
    token: str = None
    device_type: str = "expo"
    
    @property
    def get_token(self) -> str:
        """Get the token from whichever field is provided"""
        return self.push_token or self.token


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
    
    # Get the token from whichever field is provided
    token = token_req.get_token
    if not token:
        raise HTTPException(status_code=400, detail="Push token is required")
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$set": {
                "push_token": token,
                "push_token_updated_at": datetime.now(timezone.utc).isoformat(),
                "push_device_type": token_req.device_type
            },
            "$addToSet": {"push_tokens": token}
        }
    )
    
    logger.info(f"Push token registered for user {current_user['user_id'][:8]}...")
    
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


@router.get("/push-status")
async def get_push_token_status(request: Request):
    """Get user's push notification token status"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"push_token": 1, "push_tokens": 1, "push_token_updated_at": 1, "push_device_type": 1, "_id": 0}
    )
    
    if not user:
        return {
            "has_push_token": False,
            "push_tokens_count": 0,
            "last_updated": None,
            "device_type": None
        }
    
    push_tokens = user.get("push_tokens", [])
    
    return {
        "has_push_token": bool(user.get("push_token")),
        "push_tokens_count": len(push_tokens),
        "last_updated": user.get("push_token_updated_at"),
        "device_type": user.get("push_device_type", "unknown"),
        "current_token_prefix": user.get("push_token", "")[:20] + "..." if user.get("push_token") else None
    }


@router.post("/test-push")
async def send_test_push_notification(request: Request):
    """Send a test push notification to the current user"""
    import httpx
    
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    push_token = user.get("push_token")
    if not push_token:
        raise HTTPException(status_code=400, detail="No push token registered. Please enable notifications in the app.")
    
    # Validate it's an Expo push token
    if not push_token.startswith("ExponentPushToken["):
        raise HTTPException(status_code=400, detail="Invalid push token format. Expected Expo push token.")
    
    # Send test notification via Expo
    message = {
        "to": push_token,
        "sound": "default",
        "title": "Luna VIP Test",
        "body": "Push notifications are working! You're all set to receive updates.",
        "data": {
            "type": "test",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={"Content-Type": "application/json"}
            )
            result = response.json()
            
            if response.status_code != 200:
                logger.error(f"Expo push failed: {result}")
                raise HTTPException(status_code=500, detail="Failed to send push notification")
            
            # Check for Expo-specific errors
            if result.get("data") and result["data"].get("status") == "error":
                error_message = result["data"].get("message", "Unknown error")
                logger.error(f"Expo push error: {error_message}")
                return {
                    "success": False,
                    "error": error_message,
                    "details": result["data"].get("details")
                }
            
            logger.info(f"Test push sent to user {current_user['user_id'][:8]}...")
            
            return {
                "success": True,
                "message": "Test notification sent! Check your device.",
                "expo_response": result
            }
            
    except httpx.RequestError as e:
        logger.error(f"Failed to send test push: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send notification: {str(e)}")


@router.delete("/push-tokens/all")
async def remove_all_push_tokens(request: Request):
    """Remove all push tokens for the current user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$set": {"push_token": None, "push_tokens": []},
            "$unset": {"push_token_updated_at": "", "push_device_type": ""}
        }
    )
    
    logger.info(f"All push tokens removed for user {current_user['user_id'][:8]}...")
    
    return {"success": True, "message": "All push tokens removed"}

