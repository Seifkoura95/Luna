"""
Auctions API endpoints with auto-bid and notification support
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import uuid
import logging
import asyncio
from datetime import datetime, timezone, timedelta

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


# NOTE: /watchlist must be defined BEFORE /{auction_id} to avoid route conflict
@router.get("/watchlist")
async def get_watchlist(request: Request):
    """Get user's auction watchlist"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    watchlist = await db.auction_watchlist.find({
        "user_id": current_user["user_id"]
    }).to_list(50)
    
    # Enrich with current auction data
    enriched = []
    for item in watchlist:
        auction = await db.auctions.find_one({"id": item["auction_id"]})
        if auction:
            enriched.append({
                **clean_mongo_doc(item),
                "current_bid": auction.get("current_bid"),
                "status": auction.get("status"),
                "end_time": auction.get("end_time"),
                "bid_count": await db.bids.count_documents({"auction_id": item["auction_id"]})
            })
    
    return enriched


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

            # Branded outbid email via Resend (fire-and-forget, never blocks bid response)
            if prev_user and prev_user.get("email"):
                try:
                    from utils.email_service import send_auction_outbid_email
                    asyncio.create_task(send_auction_outbid_email(
                        prev_user["email"],
                        prev_user.get("name", ""),
                        auction["title"],
                        float(final_bid_amount),
                        bid_request.auction_id,
                    ))
                except Exception as e:
                    logger.error(f"Failed to queue outbid email: {e}")
    
    # Notify watchlist users about bidding activity
    asyncio.create_task(notify_watchlist_users(bid_request.auction_id, final_bid_amount, final_winner_name))
    
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


# ============ WATCHLIST FEATURE ============

class WatchlistRequest(BaseModel):
    auction_id: str
    notify_on_bid: bool = True
    notify_on_ending: bool = True
    notify_threshold: Optional[int] = 3  # Notify when X bids in 5 mins


@router.post("/watch")
async def watch_auction(request: Request, watch_request: WatchlistRequest):
    """Add auction to user's watchlist for activity notifications"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    auction = await db.auctions.find_one({"id": watch_request.auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    await db.auction_watchlist.update_one(
        {"user_id": current_user["user_id"], "auction_id": watch_request.auction_id},
        {"$set": {
            "user_id": current_user["user_id"],
            "auction_id": watch_request.auction_id,
            "auction_title": auction.get("title"),
            "venue_name": auction.get("venue_name"),
            "notify_on_bid": watch_request.notify_on_bid,
            "notify_on_ending": watch_request.notify_on_ending,
            "notify_threshold": watch_request.notify_threshold,
            "created_at": datetime.now(timezone.utc),
            "last_notified": None
        }},
        upsert=True
    )
    
    return {
        "success": True,
        "message": f"Now watching {auction.get('title')}",
        "watchlist_id": f"{current_user['user_id']}_{watch_request.auction_id}"
    }


@router.delete("/watch/{auction_id}")
async def unwatch_auction(request: Request, auction_id: str):
    """Remove auction from user's watchlist"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.auction_watchlist.delete_one({
        "user_id": current_user["user_id"],
        "auction_id": auction_id
    })
    
    return {
        "success": result.deleted_count > 0,
        "message": "Removed from watchlist" if result.deleted_count > 0 else "Not in watchlist"
    }


@router.get("/{auction_id}/activity")
async def get_auction_activity(auction_id: str):
    """Get recent bidding activity for an auction (last 30 mins)"""
    thirty_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=30)
    
    recent_bids = await db.bids.find({
        "auction_id": auction_id,
        "timestamp": {"$gte": thirty_mins_ago}
    }).sort("timestamp", -1).to_list(20)
    
    # Calculate activity metrics - handle both offset-aware and offset-naive timestamps
    five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
    
    def is_recent_bid(bid):
        ts = bid.get("timestamp")
        if ts is None:
            return False
        # Make timestamp timezone-aware if it's naive
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        return ts >= five_mins_ago
    
    bids_last_5_mins = len([b for b in recent_bids if is_recent_bid(b)])
    
    return {
        "auction_id": auction_id,
        "recent_bids": clean_mongo_docs(recent_bids),
        "bids_last_5_mins": bids_last_5_mins,
        "bids_last_30_mins": len(recent_bids),
        "is_hot": bids_last_5_mins >= 3,
        "activity_level": "hot" if bids_last_5_mins >= 5 else "active" if bids_last_5_mins >= 2 else "normal"
    }


async def notify_watchlist_users(auction_id: str, bid_amount: float, bidder_name: str):
    """Notify users watching this auction about bidding activity"""
    try:
        auction = await db.auctions.find_one({"id": auction_id})
        if not auction:
            return
        
        # Get recent bid count
        five_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
        recent_bid_count = await db.bids.count_documents({
            "auction_id": auction_id,
            "timestamp": {"$gte": five_mins_ago}
        })
        
        # Find watchers
        watchers = await db.auction_watchlist.find({
            "auction_id": auction_id,
            "notify_on_bid": True
        }).to_list(100)
        
        for watcher in watchers:
            user_id = watcher.get("user_id")
            threshold = watcher.get("notify_threshold", 3)
            last_notified = watcher.get("last_notified")
            
            # Don't spam - only notify if threshold met and not notified in last 10 mins
            ten_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=10)
            if last_notified and last_notified > ten_mins_ago:
                continue
            
            if recent_bid_count >= threshold:
                # Create notification
                await db.auction_notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "auction_id": auction_id,
                    "auction_title": auction.get("title"),
                    "type": "watchlist_activity",
                    "message": f"🔥 {recent_bid_count} bids in the last 5 minutes on {auction.get('title')}! Current bid: ${bid_amount}",
                    "new_bid": bid_amount,
                    "activity_level": "hot" if recent_bid_count >= 5 else "active",
                    "read": False,
                    "created_at": datetime.now(timezone.utc)
                })
                
                # Send push notification
                user = await db.users.find_one({"user_id": user_id})
                if user and user.get("push_tokens"):
                    for token in user.get("push_tokens", []):
                        try:
                            await send_push_notification_to_token(
                                token,
                                title=f"🔥 Hot Auction: {auction.get('title')}",
                                body=f"{recent_bid_count} bids in 5 mins! Current: ${bid_amount}. Don't miss out!",
                                data={
                                    "type": "watchlist_activity",
                                    "auction_id": auction_id,
                                    "current_bid": bid_amount
                                }
                            )
                        except Exception as e:
                            logger.error(f"Watchlist push notification failed: {e}")
                
                # Update last notified
                await db.auction_watchlist.update_one(
                    {"user_id": user_id, "auction_id": auction_id},
                    {"$set": {"last_notified": datetime.now(timezone.utc)}}
                )
                
    except Exception as e:
        logger.error(f"Watchlist notification error: {e}")
