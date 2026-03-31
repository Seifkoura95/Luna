"""
WebSocket Routes for Real-time Notifications
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional
import logging
import jwt
import os

from services.notification_ws_manager import notification_ws_manager
from database import db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Notifications WebSocket"])

JWT_SECRET = os.environ.get("JWT_SECRET", "luna-group-secret-key-2024")


def verify_token(token: str) -> Optional[dict]:
    """Verify JWT token and return user data."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


@router.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for real-time notifications.
    
    Connect: ws://host/api/ws/notifications?token={jwt_token}
    
    Messages received:
    - {"type": "connected", "user_id": "..."}
    - {"type": "notification", "data": {...}}
    - {"type": "broadcast", "data": {...}}
    
    Messages to send:
    - {"type": "ping"} - Keep connection alive
    - {"type": "mark_read", "notification_id": "..."} - Mark notification as read
    - {"type": "get_unread"} - Request unread notifications
    """
    if not token:
        await websocket.close(code=4001, reason="Token required")
        return
    
    user_data = verify_token(token)
    if not user_data:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    user_id = user_data.get("user_id")
    if not user_id:
        await websocket.close(code=4001, reason="Invalid user")
        return
    
    try:
        await notification_ws_manager.connect(websocket, user_id)
        
        # Send unread notification count
        unread_count = await db.notifications.count_documents({
            "user_id": user_id,
            "read": False
        })
        
        await websocket.send_json({
            "type": "unread_count",
            "count": unread_count
        })
        
        # Send recent unread notifications
        unread = await db.notifications.find({
            "user_id": user_id,
            "read": False
        }).sort("created_at", -1).limit(10).to_list(10)
        
        for n in unread:
            n["_id"] = str(n["_id"])
            if n.get("created_at"):
                n["created_at"] = n["created_at"].isoformat()
        
        await websocket.send_json({
            "type": "unread_notifications",
            "notifications": unread
        })
        
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif msg_type == "mark_read":
                notification_id = data.get("notification_id")
                if notification_id:
                    from bson import ObjectId
                    try:
                        await db.notifications.update_one(
                            {"_id": ObjectId(notification_id), "user_id": user_id},
                            {"$set": {"read": True}}
                        )
                        await websocket.send_json({
                            "type": "marked_read",
                            "notification_id": notification_id
                        })
                    except:
                        pass
            
            elif msg_type == "mark_all_read":
                await db.notifications.update_many(
                    {"user_id": user_id, "read": False},
                    {"$set": {"read": True}}
                )
                await websocket.send_json({
                    "type": "all_marked_read",
                    "count": unread_count
                })
            
            elif msg_type == "get_unread":
                unread = await db.notifications.find({
                    "user_id": user_id,
                    "read": False
                }).sort("created_at", -1).limit(20).to_list(20)
                
                for n in unread:
                    n["_id"] = str(n["_id"])
                    if n.get("created_at"):
                        n["created_at"] = n["created_at"].isoformat()
                
                await websocket.send_json({
                    "type": "unread_notifications",
                    "notifications": unread
                })
                
    except WebSocketDisconnect:
        notification_ws_manager.disconnect(websocket, user_id)
        logger.info(f"User {user_id} disconnected from notifications")
    except Exception as e:
        logger.error(f"Notification WebSocket error: {e}")
        notification_ws_manager.disconnect(websocket, user_id)


@router.get("/ws/notifications/stats")
async def get_notification_ws_stats():
    """Get notification WebSocket statistics."""
    return notification_ws_manager.get_stats()


@router.get("/ws/notifications/online/{user_id}")
async def check_user_online(user_id: str):
    """Check if a specific user is currently connected."""
    return {
        "user_id": user_id,
        "online": notification_ws_manager.is_user_online(user_id)
    }
