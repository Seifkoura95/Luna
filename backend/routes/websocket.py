"""
WebSocket Routes for Real-time Auction Bidding
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional
import logging
import jwt
import os

from services.websocket_manager import auction_ws_manager
from database import db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])

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


@router.websocket("/ws/auction/{auction_id}")
async def websocket_auction(
    websocket: WebSocket, 
    auction_id: str,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for real-time auction updates.
    
    Connect: ws://host/api/ws/auction/{auction_id}?token={jwt_token}
    
    Messages received:
    - {"type": "connected", "auction_id": "..."}
    - {"type": "new_bid", "auction_id": "...", "bid": {...}}
    - {"type": "outbid", "auction_id": "...", "current_high_bid": 100}
    - {"type": "auction_ending", "auction_id": "...", "seconds_remaining": 60}
    - {"type": "auction_ended", "auction_id": "...", "winner": {...}}
    
    Messages to send:
    - {"type": "ping"} - Keep connection alive
    - {"type": "place_bid", "amount": 100} - Place a bid (requires auth)
    """
    user_id = None
    user_data = None
    
    # Verify token if provided
    if token:
        user_data = verify_token(token)
        if user_data:
            user_id = user_data.get("user_id")
    
    # Verify auction exists
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        await websocket.close(code=4004, reason="Auction not found")
        return
    
    try:
        await auction_ws_manager.connect_to_auction(websocket, auction_id, user_id)
        
        # Send current auction state
        current_bid = auction.get("current_bid", auction.get("starting_bid", 0))
        await websocket.send_json({
            "type": "auction_state",
            "auction_id": auction_id,
            "title": auction.get("title"),
            "current_bid": current_bid,
            "bid_count": auction.get("bid_count", 0),
            "ends_at": auction.get("end_time"),
            "status": auction.get("status", "active"),
            "high_bidder": auction.get("high_bidder_name", "No bids yet")
        })
        
        while True:
            # Receive messages from client
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
                
            elif msg_type == "place_bid":
                if not user_id:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Authentication required to place bids"
                    })
                    continue
                
                amount = data.get("amount")
                if not amount or amount <= current_bid:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Bid must be higher than ${current_bid}"
                    })
                    continue
                
                # Process bid (simplified - actual logic in auctions.py)
                await websocket.send_json({
                    "type": "bid_received",
                    "amount": amount,
                    "message": "Use /api/auctions/bid endpoint for actual bid placement"
                })
            
            elif msg_type == "get_state":
                # Refresh auction state
                auction = await db.auctions.find_one({"id": auction_id})
                if auction:
                    await websocket.send_json({
                        "type": "auction_state",
                        "auction_id": auction_id,
                        "current_bid": auction.get("current_bid", 0),
                        "bid_count": auction.get("bid_count", 0),
                        "status": auction.get("status", "active"),
                        "high_bidder": auction.get("high_bidder_name", "No bids yet")
                    })
                    
    except WebSocketDisconnect:
        auction_ws_manager.disconnect(websocket, auction_id)
        logger.info(f"WebSocket disconnected from auction {auction_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        auction_ws_manager.disconnect(websocket, auction_id)


@router.websocket("/ws/auctions")
async def websocket_all_auctions(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """
    WebSocket endpoint for all auction updates (global feed).
    
    Connect: ws://host/api/ws/auctions?token={jwt_token}
    
    Receives updates from all active auctions.
    """
    user_id = None
    
    if token:
        user_data = verify_token(token)
        if user_data:
            user_id = user_data.get("user_id")
    
    try:
        await auction_ws_manager.connect_global(websocket, user_id)
        
        # Send list of active auctions
        active_auctions = await db.auctions.find({"status": "active"}).to_list(20)
        await websocket.send_json({
            "type": "active_auctions",
            "auctions": [
                {
                    "id": a.get("id"),
                    "title": a.get("title"),
                    "current_bid": a.get("current_bid", 0),
                    "ends_at": a.get("end_time")
                }
                for a in active_auctions
            ]
        })
        
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif msg_type == "subscribe":
                # Subscribe to specific auction
                auction_id = data.get("auction_id")
                if auction_id:
                    if auction_id not in auction_ws_manager.auction_subscribers:
                        auction_ws_manager.auction_subscribers[auction_id] = set()
                    auction_ws_manager.auction_subscribers[auction_id].add(websocket)
                    await websocket.send_json({
                        "type": "subscribed",
                        "auction_id": auction_id
                    })
                    
    except WebSocketDisconnect:
        auction_ws_manager.disconnect(websocket)
        logger.info("WebSocket disconnected from global feed")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        auction_ws_manager.disconnect(websocket)


@router.get("/ws/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics."""
    auction_stats = {}
    for auction_id, subscribers in auction_ws_manager.auction_subscribers.items():
        auction_stats[auction_id] = len(subscribers)
    
    return {
        "total_global_subscribers": len(auction_ws_manager.global_subscribers),
        "total_user_connections": len(auction_ws_manager.user_connections),
        "auction_subscribers": auction_stats
    }
