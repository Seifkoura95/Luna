"""
WebSocket Manager for Real-time Auction Bidding
Handles WebSocket connections and broadcasts bid updates to subscribers.
"""
import asyncio
import json
import logging
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


class AuctionWebSocketManager:
    """Manages WebSocket connections for real-time auction updates."""
    
    def __init__(self):
        # auction_id -> set of WebSocket connections
        self.auction_subscribers: Dict[str, Set[WebSocket]] = {}
        # user_id -> WebSocket connection (for user-specific notifications)
        self.user_connections: Dict[str, WebSocket] = {}
        # Global connections for all auction updates
        self.global_subscribers: Set[WebSocket] = set()
        
    async def connect_to_auction(self, websocket: WebSocket, auction_id: str, user_id: Optional[str] = None):
        """Subscribe a WebSocket to a specific auction."""
        await websocket.accept()
        
        if auction_id not in self.auction_subscribers:
            self.auction_subscribers[auction_id] = set()
        self.auction_subscribers[auction_id].add(websocket)
        
        if user_id:
            self.user_connections[user_id] = websocket
        
        logger.info(f"WebSocket connected to auction {auction_id}")
        
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "connected",
            "auction_id": auction_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def connect_global(self, websocket: WebSocket, user_id: Optional[str] = None):
        """Subscribe to all auction updates."""
        await websocket.accept()
        self.global_subscribers.add(websocket)
        
        if user_id:
            self.user_connections[user_id] = websocket
        
        logger.info("WebSocket connected globally")
        
        await websocket.send_json({
            "type": "connected",
            "scope": "global",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def disconnect(self, websocket: WebSocket, auction_id: Optional[str] = None):
        """Remove a WebSocket from subscriptions."""
        # Remove from auction-specific subscribers
        if auction_id and auction_id in self.auction_subscribers:
            self.auction_subscribers[auction_id].discard(websocket)
            if not self.auction_subscribers[auction_id]:
                del self.auction_subscribers[auction_id]
        
        # Remove from global subscribers
        self.global_subscribers.discard(websocket)
        
        # Remove from user connections
        user_id_to_remove = None
        for user_id, conn in self.user_connections.items():
            if conn == websocket:
                user_id_to_remove = user_id
                break
        if user_id_to_remove:
            del self.user_connections[user_id_to_remove]
        
        logger.info(f"WebSocket disconnected from auction {auction_id}")
    
    async def broadcast_bid(self, auction_id: str, bid_data: dict):
        """Broadcast a new bid to all subscribers of an auction."""
        message = {
            "type": "new_bid",
            "auction_id": auction_id,
            "bid": bid_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Send to auction-specific subscribers
        if auction_id in self.auction_subscribers:
            disconnected = set()
            for websocket in self.auction_subscribers[auction_id]:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to websocket: {e}")
                    disconnected.add(websocket)
            
            # Clean up disconnected sockets
            for ws in disconnected:
                self.auction_subscribers[auction_id].discard(ws)
        
        # Also send to global subscribers
        disconnected_global = set()
        for websocket in self.global_subscribers:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error sending global: {e}")
                disconnected_global.add(websocket)
        
        for ws in disconnected_global:
            self.global_subscribers.discard(ws)
    
    async def broadcast_outbid(self, auction_id: str, outbid_user_id: str, new_high_bid: float, new_bidder_name: str):
        """Send outbid notification to a specific user."""
        if outbid_user_id in self.user_connections:
            message = {
                "type": "outbid",
                "auction_id": auction_id,
                "current_high_bid": new_high_bid,
                "new_leader": new_bidder_name,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            try:
                await self.user_connections[outbid_user_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending outbid notification: {e}")
    
    async def broadcast_auction_ending(self, auction_id: str, seconds_remaining: int):
        """Broadcast auction ending soon notification."""
        message = {
            "type": "auction_ending",
            "auction_id": auction_id,
            "seconds_remaining": seconds_remaining,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if auction_id in self.auction_subscribers:
            for websocket in self.auction_subscribers[auction_id]:
                try:
                    await websocket.send_json(message)
                except:
                    pass
    
    async def broadcast_auction_ended(self, auction_id: str, winner_data: dict):
        """Broadcast auction ended notification with winner."""
        message = {
            "type": "auction_ended",
            "auction_id": auction_id,
            "winner": winner_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Send to auction subscribers
        if auction_id in self.auction_subscribers:
            for websocket in self.auction_subscribers[auction_id]:
                try:
                    await websocket.send_json(message)
                except:
                    pass
        
        # Send to global subscribers
        for websocket in self.global_subscribers:
            try:
                await websocket.send_json(message)
            except:
                pass
    
    def get_subscriber_count(self, auction_id: str) -> int:
        """Get number of subscribers for an auction."""
        if auction_id in self.auction_subscribers:
            return len(self.auction_subscribers[auction_id])
        return 0


# Global WebSocket manager instance
auction_ws_manager = AuctionWebSocketManager()
