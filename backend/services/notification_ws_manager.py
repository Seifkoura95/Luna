"""
WebSocket Manager for Real-time Notifications Feed
Handles WebSocket connections for user-specific notifications.
"""
import asyncio
import json
import logging
from typing import Dict, Set, Optional, List
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class NotificationWebSocketManager:
    """Manages WebSocket connections for real-time notifications."""
    
    def __init__(self):
        # user_id -> WebSocket connection
        self.user_connections: Dict[str, WebSocket] = {}
        # For broadcast to all connected users
        self.all_connections: Set[WebSocket] = set()
        
    async def connect(self, websocket: WebSocket, user_id: str):
        """Connect a user to the notification feed."""
        await websocket.accept()
        
        # Disconnect existing connection for this user (single session)
        if user_id in self.user_connections:
            try:
                old_ws = self.user_connections[user_id]
                await old_ws.send_json({
                    "type": "session_replaced",
                    "message": "Connected from another device"
                })
                await old_ws.close()
                self.all_connections.discard(old_ws)
            except:
                pass
        
        self.user_connections[user_id] = websocket
        self.all_connections.add(websocket)
        
        logger.info(f"User {user_id} connected to notifications")
        
        await websocket.send_json({
            "type": "connected",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def disconnect(self, websocket: WebSocket, user_id: Optional[str] = None):
        """Disconnect a user from the notification feed."""
        self.all_connections.discard(websocket)
        
        if user_id and user_id in self.user_connections:
            if self.user_connections[user_id] == websocket:
                del self.user_connections[user_id]
        else:
            # Find and remove by websocket
            user_to_remove = None
            for uid, ws in self.user_connections.items():
                if ws == websocket:
                    user_to_remove = uid
                    break
            if user_to_remove:
                del self.user_connections[user_to_remove]
        
        logger.info(f"User disconnected from notifications")
    
    async def send_to_user(self, user_id: str, notification: dict):
        """Send a notification to a specific user."""
        if user_id in self.user_connections:
            try:
                message = {
                    "type": "notification",
                    "data": notification,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                await self.user_connections[user_id].send_json(message)
                return True
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")
                self.disconnect(self.user_connections.get(user_id), user_id)
                return False
        return False
    
    async def send_to_users(self, user_ids: List[str], notification: dict):
        """Send a notification to multiple users."""
        results = {}
        for user_id in user_ids:
            results[user_id] = await self.send_to_user(user_id, notification)
        return results
    
    async def broadcast(self, notification: dict, exclude_user_id: Optional[str] = None):
        """Broadcast a notification to all connected users."""
        message = {
            "type": "broadcast",
            "data": notification,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        disconnected = set()
        for websocket in self.all_connections:
            # Skip excluded user
            if exclude_user_id:
                for uid, ws in self.user_connections.items():
                    if ws == websocket and uid == exclude_user_id:
                        continue
            
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Broadcast error: {e}")
                disconnected.add(websocket)
        
        # Clean up disconnected
        for ws in disconnected:
            self.all_connections.discard(ws)
    
    async def send_win_back_notification(self, user_id: str, offer: dict):
        """Send win-back campaign notification."""
        notification = {
            "id": f"winback-{user_id}-{datetime.now().timestamp()}",
            "type": "win_back",
            "title": "We miss you! 🎉",
            "message": f"Here's a special gift: {offer.get('value', 'Special offer')}",
            "offer": offer,
            "priority": "high",
            "action": {
                "type": "claim_offer",
                "label": "Claim Now"
            }
        }
        return await self.send_to_user(user_id, notification)
    
    async def send_outbid_notification(self, user_id: str, auction_id: str, auction_title: str, current_bid: float):
        """Send outbid notification via WebSocket."""
        notification = {
            "id": f"outbid-{auction_id}-{datetime.now().timestamp()}",
            "type": "auction_outbid",
            "title": "You've been outbid!",
            "message": f"Someone bid ${current_bid:.0f} on {auction_title}",
            "priority": "high",
            "data": {
                "auction_id": auction_id,
                "current_bid": current_bid
            },
            "action": {
                "type": "view_auction",
                "label": "Bid Now"
            }
        }
        return await self.send_to_user(user_id, notification)
    
    async def send_points_earned(self, user_id: str, points: int, reason: str):
        """Send points earned notification."""
        notification = {
            "id": f"points-{user_id}-{datetime.now().timestamp()}",
            "type": "points_earned",
            "title": f"+{points} Luna Points!",
            "message": reason,
            "priority": "normal",
            "data": {
                "points": points
            }
        }
        return await self.send_to_user(user_id, notification)
    
    async def send_event_reminder(self, user_id: str, event_id: str, event_title: str, venue_name: str, starts_in: str):
        """Send event reminder notification."""
        notification = {
            "id": f"event-{event_id}-{datetime.now().timestamp()}",
            "type": "event_reminder",
            "title": f"Starting {starts_in}!",
            "message": f"{event_title} at {venue_name}",
            "priority": "normal",
            "data": {
                "event_id": event_id
            },
            "action": {
                "type": "view_event",
                "label": "View Event"
            }
        }
        return await self.send_to_user(user_id, notification)
    
    def get_online_users(self) -> List[str]:
        """Get list of currently connected user IDs."""
        return list(self.user_connections.keys())
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if a user is currently connected."""
        return user_id in self.user_connections
    
    def get_stats(self) -> dict:
        """Get connection statistics."""
        return {
            "total_connections": len(self.all_connections),
            "unique_users": len(self.user_connections),
            "online_users": self.get_online_users()
        }


# Global instance
notification_ws_manager = NotificationWebSocketManager()
