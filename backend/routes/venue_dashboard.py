"""
Venue Staff/Dashboard and Analytics API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import uuid
import bcrypt
from datetime import datetime, timezone, timedelta

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs
from luna_venues_config import LUNA_VENUES
from models.venue import ScanQRRequest, VenueStaffRegister

router = APIRouter(prefix="/venue", tags=["Venue Dashboard"])


@router.post("/register-staff")
async def register_venue_staff(request: Request, staff: VenueStaffRegister):
    """Register venue staff - requires admin or venue_manager"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.users.find_one({"email": staff.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if staff.role not in ["venue_staff", "venue_manager"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    hashed_password = bcrypt.hashpw(staff.password.encode('utf-8'), bcrypt.gensalt())
    staff_user = {
        "user_id": str(uuid.uuid4()),
        "email": staff.email.lower(),
        "hashed_password": hashed_password.decode('utf-8'),
        "name": staff.name,
        "role": staff.role,
        "venue_id": staff.venue_id,
        "is_venue_staff": True,
        "points_balance": 0,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(staff_user)
    
    return {
        "success": True,
        "message": f"Staff account created for {staff.name}",
        "user_id": staff_user["user_id"]
    }


@router.post("/scan-qr")
async def venue_scan_qr(request: Request, scan_req: ScanQRRequest):
    """Venue scans and validates a QR code - marks as redeemed"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to scan QR codes")
    
    redemption = await db.redemptions.find_one({"qr_code": scan_req.qr_code})
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Invalid QR code")
    
    if redemption["status"] == "redeemed":
        raise HTTPException(status_code=400, detail="QR code already used")
    
    if redemption["status"] == "expired":
        raise HTTPException(status_code=400, detail="QR code has expired")
    
    if redemption.get("expires_at") and redemption["expires_at"] < datetime.now(timezone.utc):
        await db.redemptions.update_one(
            {"id": redemption["id"]},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="QR code has expired")
    
    await db.redemptions.update_one(
        {"id": redemption["id"]},
        {"$set": {
            "status": "redeemed",
            "redeemed_at": datetime.now(timezone.utc),
            "redeemed_by": current_user["user_id"],
            "redeemed_venue": scan_req.venue_id
        }}
    )
    
    customer = await db.users.find_one({"user_id": redemption["user_id"]})
    
    return {
        "success": True,
        "message": "Reward redeemed successfully!",
        "reward_name": redemption["reward_name"],
        "customer_name": customer.get("name", "Unknown") if customer else "Unknown",
        "points_spent": redemption["points_spent"],
        "redeemed_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/dashboard")
async def get_venue_dashboard(request: Request):
    """Get venue dashboard data"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)
    
    redemption_query = {}
    if not is_admin and venue_id:
        redemption_query["redeemed_venue"] = venue_id
    
    total_redemptions = await db.redemptions.count_documents({**redemption_query, "status": "redeemed"})
    today_redemptions = await db.redemptions.count_documents({**redemption_query, "status": "redeemed", "redeemed_at": {"$gte": today}})
    week_redemptions = await db.redemptions.count_documents({**redemption_query, "status": "redeemed", "redeemed_at": {"$gte": week_ago}})
    
    recent_redemptions = await db.redemptions.find({**redemption_query, "status": "redeemed"}).sort("redeemed_at", -1).limit(20).to_list(20)
    
    for r in recent_redemptions:
        customer = await db.users.find_one({"user_id": r["user_id"]})
        r["customer_name"] = customer.get("name", "Unknown") if customer else "Unknown"
    
    pending_count = await db.redemptions.count_documents({"status": "pending"})
    
    visitor_query = {"redeemed_venue": venue_id} if venue_id and not is_admin else {}
    unique_visitors = await db.redemptions.distinct("user_id", visitor_query)
    
    return {
        "stats": {
            "total_redemptions": total_redemptions,
            "today_redemptions": today_redemptions,
            "week_redemptions": week_redemptions,
            "pending_redemptions": pending_count,
            "unique_visitors": len(unique_visitors)
        },
        "recent_redemptions": clean_mongo_docs(recent_redemptions),
        "venue_id": venue_id,
        "is_admin": is_admin
    }


@router.get("/redemptions")
async def get_venue_redemptions(
    request: Request,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get redemptions for venue dashboard"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if user.get("role") != "admin" and user.get("venue_id"):
        query["redeemed_venue"] = user["venue_id"]
    if status:
        query["status"] = status
    
    total = await db.redemptions.count_documents(query)
    redemptions = await db.redemptions.find(query).sort("created_at", -1).skip(offset).limit(limit).to_list(limit)
    
    for r in redemptions:
        customer = await db.users.find_one({"user_id": r["user_id"]})
        r["customer_name"] = customer.get("name", "Unknown") if customer else "Unknown"
    
    return {
        "total": total,
        "redemptions": clean_mongo_docs(redemptions)
    }


@router.get("/analytics")
async def get_venue_analytics(request: Request, period: str = "week"):
    """Get detailed analytics for venue"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "day":
        start_date = today
    elif period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=7)
    
    query = {"redeemed_at": {"$gte": start_date}, "status": "redeemed"}
    if not is_admin and venue_id:
        query["redeemed_venue"] = venue_id
    
    redemptions = await db.redemptions.find(query).to_list(1000)
    
    daily_stats = {}
    for r in redemptions:
        day = r["redeemed_at"].strftime("%Y-%m-%d")
        if day not in daily_stats:
            daily_stats[day] = {"count": 0, "points": 0}
        daily_stats[day]["count"] += 1
        daily_stats[day]["points"] += r.get("points_spent", 0)
    
    reward_counts = {}
    for r in redemptions:
        name = r.get("reward_name", "Unknown")
        reward_counts[name] = reward_counts.get(name, 0) + 1
    
    top_rewards = sorted(reward_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "period": period,
        "daily_stats": daily_stats,
        "top_rewards": [{"name": name, "count": count} for name, count in top_rewards],
        "total_redemptions": len(redemptions),
        "total_points_redeemed": sum(r.get("points_spent", 0) for r in redemptions)
    }


@router.get("/analytics/revenue")
async def get_venue_revenue_analytics(request: Request, period: str = "month"):
    """Get revenue analytics for venue"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    elif period == "year":
        start_date = today - timedelta(days=365)
    else:
        start_date = today - timedelta(days=30)
    
    spending_query = {"created_at": {"$gte": start_date}}
    if not is_admin and venue_id:
        spending_query["venue_id"] = venue_id
    
    spending_records = await db.spending.find(spending_query).to_list(10000)
    
    total_revenue = sum(s.get("amount", 0) for s in spending_records)
    category_revenue = {}
    for s in spending_records:
        category = s.get("category", "general")
        category_revenue[category] = category_revenue.get(category, 0) + s.get("amount", 0)
    
    daily_revenue = {}
    for s in spending_records:
        day = s["created_at"].strftime("%Y-%m-%d")
        if day not in daily_revenue:
            daily_revenue[day] = 0
        daily_revenue[day] += s.get("amount", 0)
    
    booking_query = {"created_at": {"$gte": start_date}}
    if not is_admin and venue_id:
        booking_query["venue_id"] = venue_id
    
    bookings = await db.bookings.find(booking_query).to_list(1000)
    booking_revenue = sum(b.get("deposit_amount", 0) for b in bookings)
    
    return {
        "period": period,
        "total_revenue": total_revenue,
        "booking_revenue": booking_revenue,
        "combined_revenue": total_revenue + booking_revenue,
        "category_breakdown": category_revenue,
        "daily_revenue": daily_revenue,
        "average_spend_per_customer": total_revenue / len(spending_records) if spending_records else 0,
        "total_transactions": len(spending_records)
    }


@router.get("/analytics/auctions")
async def get_venue_auction_analytics(request: Request, period: str = "month"):
    """Get auction analytics for venue"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    today = datetime.now(timezone.utc)
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=30)
    
    auction_query = {}
    if not is_admin and venue_id:
        auction_query["venue_id"] = venue_id
    
    auctions = await db.auctions.find(auction_query).to_list(1000)
    
    live_auctions = [a for a in auctions if a.get("status") == "active"]
    ended_auctions = [a for a in auctions if a.get("status") in ["ended", "completed"]]
    
    total_bids = 0
    total_bid_amount = 0
    for auction in auctions:
        bids = auction.get("bids", [])
        total_bids += len(bids)
        total_bid_amount += sum(b.get("amount", 0) for b in bids)
    
    live_auctions_formatted = []
    for auction in live_auctions[:10]:
        end_time = auction.get("end_time")
        time_left = "Ended"
        delta_seconds = 0
        if end_time:
            if end_time.tzinfo is None:
                end_time = end_time.replace(tzinfo=timezone.utc)
            delta = end_time - today
            delta_seconds = delta.total_seconds()
            if delta_seconds > 0:
                hours = int(delta_seconds // 3600)
                minutes = int((delta_seconds % 3600) // 60)
                time_left = f"{hours}h {minutes}m" if hours > 0 else f"{minutes}m"
        
        live_auctions_formatted.append({
            "id": auction.get("id"),
            "item": auction.get("title", "Unknown Item"),
            "currentBid": auction.get("current_bid", auction.get("starting_bid", 0)),
            "bids": len(auction.get("bids", [])),
            "timeLeft": time_left,
            "status": "live" if delta_seconds > 3600 else "ending"
        })
    
    return {
        "period": period,
        "live_auctions_count": len(live_auctions),
        "total_auctions": len(auctions),
        "total_bids": total_bids,
        "total_bid_amount": total_bid_amount,
        "conversion_rate": round((len(ended_auctions) / len(auctions) * 100) if auctions else 0, 1),
        "live_auctions": live_auctions_formatted
    }


@router.get("/analytics/points")
async def get_venue_points_analytics(request: Request, period: str = "month"):
    """Get points analytics for venue"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    venue_id = user.get("venue_id")
    is_admin = user.get("role") == "admin"
    
    today = datetime.now(timezone.utc)
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today - timedelta(days=30)
    else:
        start_date = today - timedelta(days=30)
    
    points_query = {"created_at": {"$gte": start_date}}
    if not is_admin and venue_id:
        points_query["venue_id"] = venue_id
    
    transactions = await db.points_transactions.find(points_query).to_list(10000)
    
    points_issued = sum(t.get("total_points", 0) for t in transactions if t.get("type") == "earn")
    points_redeemed = sum(abs(t.get("total_points", 0)) for t in transactions if t.get("type") == "redeem")
    
    redemption_rate = round((points_redeemed / points_issued * 100) if points_issued > 0 else 0, 1)
    
    user_points = {}
    for t in transactions:
        if t.get("type") == "earn":
            user_id = t.get("user_id")
            user_points[user_id] = user_points.get(user_id, 0) + t.get("total_points", 0)
    
    top_earners = sorted(user_points.items(), key=lambda x: x[1], reverse=True)[:10]
    
    top_earners_formatted = []
    for uid, points in top_earners:
        u = await db.users.find_one({"user_id": uid})
        if u:
            top_earners_formatted.append({
                "user_id": uid,
                "name": u.get("name", "Unknown"),
                "points": points,
                "tier": u.get("subscription_tier", "lunar"),
                "avatar": u.get("avatar_url", f"https://ui-avatars.com/api/?name={u.get('name', 'U')}&background=E31837&color=fff")
            })
    
    return {
        "period": period,
        "points_issued": points_issued,
        "points_redeemed": points_redeemed,
        "points_expired": 0,
        "redemption_rate": redemption_rate,
        "top_earners": top_earners_formatted
    }
