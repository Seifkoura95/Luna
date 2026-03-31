"""
Auctions API endpoints with auto-bid and notification support
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import uuid
import logging
import asyncio
from datetime import datetime, timezone

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs
from models.auctions import PlaceBidRequest, AuctionSubscribeRequest
from routes.shared import send_push_notification_to_token
from services.websocket_manager import auction_ws_manager

router = APIRouter(prefix="/auctions", tags=["Auctions"])
logger = logging.getLogger(__name__)


@router.get("")
async def get_auctions(venue_id: Optional[str] = None, status: Optional[str] = None):
    """Get all auctions with optional filters"""
    query = {}
    if venue_id:
        query["venue_id"] = venue_id
    if status:
        query["status"] = status
    auctions = await db.auctions.find(query).sort("start_time", 1).to_list(50)
    return clean_mongo_docs(auctions)


@router.get("/{auction_id}")
async def get_auction_detail(auction_id: str):
    """Get detailed auction info with bid history"""
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    bids = await db.bids.find({"auction_id": auction_id}).sort("timestamp", -1).to_list(20)
    
    auction_data = clean_mongo_doc(auction)
    auction_data["bid_history"] = clean_mongo_docs(bids)
    auction_data["total_bids"] = len(bids)
    
    return auction_data


@router.post("/bid")
async def place_bid(request: Request, bid_request: PlaceBidRequest):
    """Place a bid on an auction with optional auto-bid"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    auction = await db.auctions.find_one({"id": bid_request.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    if auction["status"] != "active":
        raise HTTPException(status_code=400, detail="Auction not active")
    
    max_limit = auction.get("max_bid_limit", 10000)
    if bid_request.amount > max_limit:
        raise HTTPException(status_code=400, detail=f"Bid cannot exceed ${max_limit}")
    
    min_bid = auction["current_bid"] + auction.get("min_increment", 5)
    if bid_request.amount < min_bid:
        raise HTTPException(status_code=400, detail=f"Bid must be at least ${min_bid}")
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    previous_winner_id = auction.get("winner_id")
    min_increment = auction.get("min_increment", 5)
    
    final_bid_amount = bid_request.amount
    final_winner_id = user["user_id"]
    final_winner_name = user["name"]
    
    # Auto-bid war logic
    if previous_winner_id and previous_winner_id != user["user_id"]:
        prev_auto_bid = await db.bids.find_one(
            {"auction_id": bid_request.auction_id, "user_id": previous_winner_id, "max_bid": {"$exists": True, "$ne": None}},
            sort=[("timestamp", -1)]
        )
        
        if prev_auto_bid and prev_auto_bid.get("max_bid"):
            prev_max = prev_auto_bid["max_bid"]
            new_bidder_max = bid_request.max_bid if bid_request.max_bid else bid_request.amount
            
            current_amount = bid_request.amount
            current_leader = user["user_id"]
            current_leader_name = user["name"]
            
            while True:
                counter_bid = current_amount + min_increment
                
                if counter_bid <= prev_max:
                    prev_user = await db.users.find_one({"user_id": previous_winner_id})
                    
                    await db.bids.insert_one({
                        "id": str(uuid.uuid4()),
                        "auction_id": bid_request.auction_id,
                        "user_id": previous_winner_id,
                        "user_name": prev_user["name"] if prev_user else "Auto-bidder",
                        "amount": counter_bid,
                        "max_bid": prev_max,
                        "is_auto_bid": True,
                        "timestamp": datetime.now(timezone.utc)
                    })
                    
                    current_amount = counter_bid
                    current_leader = previous_winner_id
                    current_leader_name = prev_user["name"] if prev_user else "Auto-bidder"
                    
                    if new_bidder_max:
                        next_counter = current_amount + min_increment
                        if next_counter <= new_bidder_max:
                            await db.bids.insert_one({
                                "id": str(uuid.uuid4()),
                                "auction_id": bid_request.auction_id,
                                "user_id": user["user_id"],
                                "user_name": user["name"],
                                "amount": next_counter,
                                "max_bid": new_bidder_max,
                                "is_auto_bid": True,
                                "timestamp": datetime.now(timezone.utc)
                            })
                            current_amount = next_counter
                            current_leader = user["user_id"]
                            current_leader_name = user["name"]
                        else:
                            break
                    else:
                        break
                else:
                    # Notify previous bidder their max was exceeded
                    await db.auction_notifications.insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": previous_winner_id,
                        "auction_id": bid_request.auction_id,
                        "auction_title": auction["title"],
                        "type": "auto_bid_exhausted",
                        "message": f"Your auto-bid limit of ${prev_max} was exceeded on {auction['title']}. Current bid: ${current_amount}",
                        "read": False,
                        "created_at": datetime.now(timezone.utc)
                    })
                    
                    prev_user = await db.users.find_one({"user_id": previous_winner_id})
                    if prev_user and prev_user.get("push_tokens"):
                        for token in prev_user.get("push_tokens", []):
                            try:
                                await send_push_notification_to_token(
                                    token,
                                    title="Auto-Bid Limit Reached",
                                    body=f"Your ${prev_max} limit on {auction['title']} was exceeded. Bid ${current_amount + min_increment}+ to stay ahead!",
                                    data={"type": "auto_bid_exhausted", "auction_id": bid_request.auction_id}
                                )
                            except Exception as e:
                                logger.error(f"Failed to send auto-bid exhausted notification: {e}")
                    break
            
            final_bid_amount = current_amount
            final_winner_id = current_leader
            final_winner_name = current_leader_name
    
    # Update auction
    await db.auctions.update_one(
        {"id": bid_request.auction_id},
        {"$set": {
            "current_bid": final_bid_amount,
            "winner_id": final_winner_id,
            "winner_name": final_winner_name,
            "last_bid_time": datetime.now(timezone.utc)
        }}
    )
    
    # Broadcast bid update via WebSocket
    asyncio.create_task(auction_ws_manager.broadcast_bid(
        auction_id=bid_request.auction_id,
        bid_data={
            "amount": final_bid_amount,
            "bidder_name": final_winner_name,
            "bid_count": auction.get("bid_count", 0) + 1
        }
    ))
    
    # Send outbid notification via WebSocket if previous winner exists
    if previous_winner_id and previous_winner_id != final_winner_id:
        asyncio.create_task(auction_ws_manager.broadcast_outbid(
            auction_id=bid_request.auction_id,
            outbid_user_id=previous_winner_id,
            new_high_bid=final_bid_amount,
            new_bidder_name=final_winner_name
        ))
    
    # Record original bid if not already recorded
    if final_winner_id == user["user_id"] and final_bid_amount == bid_request.amount:
        await db.bids.insert_one({
            "id": str(uuid.uuid4()),
            "auction_id": bid_request.auction_id,
            "user_id": user["user_id"],
            "user_name": user["name"],
            "amount": bid_request.amount,
            "max_bid": bid_request.max_bid,
            "notify_outbid": bid_request.notify_outbid,
            "timestamp": datetime.now(timezone.utc)
        })
    
    # Store notification preference
    if bid_request.notify_outbid:
        await db.auction_notification_preferences.update_one(
            {"user_id": user["user_id"], "auction_id": bid_request.auction_id},
            {"$set": {
                "user_id": user["user_id"],
                "auction_id": bid_request.auction_id,
                "notify_outbid": True,
                "max_bid": bid_request.max_bid,
                "updated_at": datetime.now(timezone.utc)
            }},
            upsert=True
        )
    
    # Notify outbid user
    if previous_winner_id and previous_winner_id != final_winner_id:
        prev_user_pref = await db.auction_notification_preferences.find_one({
            "user_id": previous_winner_id,
            "auction_id": bid_request.auction_id
        })
        
        should_notify = prev_user_pref.get("notify_outbid", True) if prev_user_pref else True
        
        if should_notify:
            await db.auction_notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": previous_winner_id,
                "auction_id": bid_request.auction_id,
                "auction_title": auction["title"],
                "type": "outbid",
                "message": f"You've been outbid on {auction['title']}! Current bid: ${final_bid_amount}",
                "new_bid": final_bid_amount,
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })
            
            prev_user = await db.users.find_one({"user_id": previous_winner_id})
            if prev_user and prev_user.get("push_tokens"):
                for token in prev_user.get("push_tokens", []):
                    try:
                        await send_push_notification_to_token(
                            token,
                            title="You've Been Outbid!",
                            body=f"Someone bid ${final_bid_amount} on {auction['title']}. Bid now to stay ahead!",
                            data={
                                "type": "outbid",
                                "auction_id": bid_request.auction_id,
                                "new_bid": final_bid_amount
                            }
                        )
                        logger.info(f"Sent outbid push notification to {previous_winner_id}")
                    except Exception as e:
                        logger.error(f"Failed to send push notification: {e}")
    
    updated_auction = await db.auctions.find_one({"id": bid_request.auction_id})
    
    return {
        "message": "Bid placed successfully!",
        "auction": clean_mongo_doc(updated_auction),
        "auto_bid_active": bid_request.max_bid is not None,
        "your_max_bid": bid_request.max_bid,
        "final_amount": final_bid_amount,
        "you_are_winning": final_winner_id == user["user_id"]
    }


@router.get("/{auction_id}/bids")
async def get_auction_bids(auction_id: str):
    """Get bid history for an auction"""
    bids = await db.bids.find({"auction_id": auction_id}).sort("timestamp", -1).to_list(50)
    return clean_mongo_docs(bids)


@router.post("/subscribe")
async def subscribe_to_auction(request: Request, sub_request: AuctionSubscribeRequest):
    """Subscribe to auction notifications"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.auction_subscribers.update_one(
        {"user_id": current_user["user_id"], "auction_id": sub_request.auction_id},
        {"$set": {
            "user_id": current_user["user_id"],
            "auction_id": sub_request.auction_id,
            "subscribed_at": datetime.now(timezone.utc)
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Subscribed to auction notifications"}


@router.get("/notifications")
async def get_auction_notifications(request: Request):
    """Get auction notifications for current user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    notifications = await db.auction_notifications.find({
        "user_id": current_user["user_id"]
    }).sort("created_at", -1).to_list(50)
    
    return clean_mongo_docs(notifications)


@router.post("/notifications/mark-read")
async def mark_auction_notifications_read(request: Request, notification_ids: Optional[list] = None):
    """Mark auction notifications as read"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    query = {"user_id": current_user["user_id"]}
    if notification_ids:
        query["id"] = {"$in": notification_ids}
    
    result = await db.auction_notifications.update_many(
        query,
        {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
    )
    
    return {
        "success": True,
        "marked_count": result.modified_count
    }
