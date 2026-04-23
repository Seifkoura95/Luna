"""
Venue Portal Management API endpoints
Full auction CRUD and comprehensive user analytics for venue dashboard
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from typing import Optional, List
import uuid
import base64
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs
from luna_venues_config import LUNA_VENUES

router = APIRouter(prefix="/venue-admin", tags=["Venue Admin"])
logger = logging.getLogger(__name__)


AUCTION_IMAGE_DIR = Path(__file__).parent.parent / "uploads" / "auctions"
AUCTION_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_AUCTION_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_AUCTION_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB


# ====== AUCTION MANAGEMENT MODELS ======

class CreateAuctionRequest(BaseModel):
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    starting_bid: float
    min_increment: float = 5
    max_bid_limit: Optional[float] = 10000
    duration_hours: int = 24
    venue_id: str
    category: Optional[str] = "vip_experience"
    terms: Optional[str] = None
    publish_immediately: bool = False


class UpdateAuctionRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    starting_bid: Optional[float] = None
    min_increment: Optional[float] = None
    max_bid_limit: Optional[float] = None
    duration_hours: Optional[int] = None
    venue_id: Optional[str] = None
    category: Optional[str] = None
    terms: Optional[str] = None
    status: Optional[str] = None  # draft, active, paused, ended


# ====== AUCTION CRUD ENDPOINTS ======


@router.post("/auctions/upload-image")
async def upload_auction_image(request: Request):
    """Upload an image for an auction.

    Accepts:
      - `multipart/form-data` with field name `file` (recommended from Lovable)
      - `application/json` with `{"image": "data:image/...;base64,..."}`

    Returns: `{"image_url": "https://<api>/api/venue-admin/auctions/image/<id>"}`
    which is the value you should store on the auction's `image_url` field
    (either by passing it to `POST /api/venue-admin/auctions` on create or to
    `PUT /api/venue-admin/auctions/{id}` on edit).
    """
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    content_type = request.headers.get("content-type", "")

    image_bytes: Optional[bytes] = None
    mime_type: Optional[str] = None

    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file") or form.get("image")
        if not file:
            raise HTTPException(status_code=400, detail="No file uploaded (field name must be 'file')")
        mime_type = getattr(file, "content_type", None)
        image_bytes = await file.read()
    elif "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON body")
        raw = body.get("image") or body.get("data_url")
        if not raw:
            raise HTTPException(status_code=400, detail="Missing 'image' field (base64 or data URL)")
        if raw.startswith("data:"):
            header, encoded = raw.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0]
        else:
            encoded = raw
            mime_type = body.get("mime_type") or "image/jpeg"
        try:
            image_bytes = base64.b64decode(encoded)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 payload")
    else:
        raise HTTPException(
            status_code=400,
            detail="Content-Type must be multipart/form-data or application/json",
        )

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image payload")
    if mime_type not in ALLOWED_AUCTION_MIME:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {mime_type}. Use JPG, PNG or WebP.")
    if len(image_bytes) > MAX_AUCTION_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large. Max 8 MB.")

    image_id = uuid.uuid4().hex[:16]
    ext = ALLOWED_AUCTION_MIME[mime_type]
    filename = f"{image_id}{ext}"
    filepath = AUCTION_IMAGE_DIR / filename
    with open(filepath, "wb") as f:
        f.write(image_bytes)

    import os
    base_url = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
    relative_path = f"/api/venue-admin/auctions/image/{filename}"
    public_url = f"{base_url}{relative_path}" if base_url else relative_path

    return {
        "image_id": image_id,
        "filename": filename,
        "image_url": public_url,
        "relative_url": relative_path,
        "size_bytes": len(image_bytes),
        "mime_type": mime_type,
        "uploaded_by": user.get("user_id"),
    }


@router.get("/auctions/image/{filename}")
async def serve_auction_image(filename: str):
    """Serve an uploaded auction image. Public (no auth) so the mobile app + Lovable preview can render it."""
    # Basic path traversal guard
    if "/" in filename or ".." in filename or filename.startswith("."):
        raise HTTPException(status_code=400, detail="Invalid filename")
    filepath = AUCTION_IMAGE_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    ext = filepath.suffix.lower()
    media_type = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(
        ext.lstrip("."), "application/octet-stream"
    )
    return FileResponse(str(filepath), media_type=media_type)


@router.get("/auctions")
async def get_all_auctions(
    request: Request,
    status: Optional[str] = None,
    venue_id: Optional[str] = None,
    limit: int = 50
):
    """Get all auctions for venue management"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if status:
        query["status"] = status
    if venue_id:
        query["venue_id"] = venue_id
    elif user.get("role") != "admin" and user.get("venue_id"):
        query["venue_id"] = user["venue_id"]
    
    auctions = await db.auctions.find(query).sort("created_at", -1).to_list(limit)
    
    # Enrich with bid counts
    for auction in auctions:
        bid_count = await db.bids.count_documents({"auction_id": auction["id"]})
        auction["total_bids"] = bid_count
    
    return clean_mongo_docs(auctions)


@router.post("/auctions")
async def create_auction(request: Request, auction_req: CreateAuctionRequest):
    """Create a new auction"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if auction_req.venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=400, detail="Invalid venue")
    
    venue = LUNA_VENUES[auction_req.venue_id]
    auction_id = str(uuid.uuid4())[:8].upper()
    
    now = datetime.now(timezone.utc)
    end_time = now + timedelta(hours=auction_req.duration_hours) if auction_req.publish_immediately else None
    
    auction = {
        "id": auction_id,
        "title": auction_req.title,
        "description": auction_req.description,
        "image_url": auction_req.image_url or "https://images.unsplash.com/photo-1703605932451-d779dcccbfd0?w=800",
        "starting_bid": auction_req.starting_bid,
        "current_bid": auction_req.starting_bid,
        "min_increment": auction_req.min_increment,
        "max_bid_limit": auction_req.max_bid_limit,
        "duration_hours": auction_req.duration_hours,
        "venue_id": auction_req.venue_id,
        "venue_name": venue["name"],
        "category": auction_req.category,
        "terms": auction_req.terms,
        "status": "active" if auction_req.publish_immediately else "draft",
        "start_time": now if auction_req.publish_immediately else None,
        "end_time": end_time,
        "winner_id": None,
        "winner_name": None,
        "created_by": current_user["user_id"],
        "created_at": now,
        "updated_at": now
    }
    
    await db.auctions.insert_one(auction)
    logger.info(f"Auction {auction_id} created by {current_user['user_id']}")
    
    return {
        "success": True,
        "message": f"Auction '{auction_req.title}' created successfully!",
        "auction": clean_mongo_doc(auction)
    }


@router.get("/auctions/{auction_id}")
async def get_auction_details(request: Request, auction_id: str):
    """Get full auction details for editing"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Get bid history
    bids = await db.bids.find({"auction_id": auction_id}).sort("timestamp", -1).to_list(50)
    
    auction_data = clean_mongo_doc(auction)
    auction_data["bids"] = clean_mongo_docs(bids)
    auction_data["total_bids"] = len(bids)
    
    return auction_data


@router.put("/auctions/{auction_id}")
async def update_auction(request: Request, auction_id: str, update_req: UpdateAuctionRequest):
    """Update an existing auction"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Build update dict with only provided fields
    update_data = {"updated_at": datetime.now(timezone.utc)}
    
    if update_req.title is not None:
        update_data["title"] = update_req.title
    if update_req.description is not None:
        update_data["description"] = update_req.description
    if update_req.image_url is not None:
        update_data["image_url"] = update_req.image_url
    if update_req.starting_bid is not None:
        # Only allow changing starting bid if no bids yet
        if auction.get("current_bid", 0) > auction.get("starting_bid", 0):
            raise HTTPException(status_code=400, detail="Cannot change starting bid after bids placed")
        update_data["starting_bid"] = update_req.starting_bid
        update_data["current_bid"] = update_req.starting_bid
    if update_req.min_increment is not None:
        update_data["min_increment"] = update_req.min_increment
    if update_req.max_bid_limit is not None:
        update_data["max_bid_limit"] = update_req.max_bid_limit
    if update_req.venue_id is not None:
        if update_req.venue_id not in LUNA_VENUES:
            raise HTTPException(status_code=400, detail="Invalid venue")
        update_data["venue_id"] = update_req.venue_id
        update_data["venue_name"] = LUNA_VENUES[update_req.venue_id]["name"]
    if update_req.category is not None:
        update_data["category"] = update_req.category
    if update_req.terms is not None:
        update_data["terms"] = update_req.terms
    if update_req.status is not None:
        update_data["status"] = update_req.status
        if update_req.status == "active" and not auction.get("start_time"):
            update_data["start_time"] = datetime.now(timezone.utc)
            duration = update_req.duration_hours or auction.get("duration_hours", 24)
            update_data["end_time"] = datetime.now(timezone.utc) + timedelta(hours=duration)
    if update_req.duration_hours is not None:
        update_data["duration_hours"] = update_req.duration_hours
        if auction.get("status") == "active":
            update_data["end_time"] = auction.get("start_time", datetime.now(timezone.utc)) + timedelta(hours=update_req.duration_hours)
    
    await db.auctions.update_one({"id": auction_id}, {"$set": update_data})
    
    updated = await db.auctions.find_one({"id": auction_id})
    return {
        "success": True,
        "message": "Auction updated successfully!",
        "auction": clean_mongo_doc(updated)
    }


@router.post("/auctions/{auction_id}/publish")
async def publish_auction(request: Request, auction_id: str):
    """Publish a draft auction - make it live"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    if auction.get("status") == "active":
        return {"success": True, "message": "Auction is already live"}
    
    now = datetime.now(timezone.utc)
    duration = auction.get("duration_hours", 24)
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "status": "active",
            "start_time": now,
            "end_time": now + timedelta(hours=duration),
            "updated_at": now
        }}
    )
    
    logger.info(f"Auction {auction_id} published by {current_user['user_id']}")
    return {"success": True, "message": "Auction is now live!"}


@router.post("/auctions/{auction_id}/unpublish")
async def unpublish_auction(request: Request, auction_id: str):
    """Unpublish an auction - return to draft"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Check if there are bids
    bid_count = await db.bids.count_documents({"auction_id": auction_id})
    if bid_count > 0:
        raise HTTPException(status_code=400, detail="Cannot unpublish auction with existing bids")
    
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "status": "draft",
            "start_time": None,
            "end_time": None,
            "updated_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"success": True, "message": "Auction unpublished"}


@router.delete("/auctions/{auction_id}")
async def delete_auction(request: Request, auction_id: str):
    """Delete an auction"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Only managers can delete auctions")
    
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Check if there are bids
    bid_count = await db.bids.count_documents({"auction_id": auction_id})
    if bid_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete auction with existing bids. End it instead.")
    
    await db.auctions.delete_one({"id": auction_id})
    logger.info(f"Auction {auction_id} deleted by {current_user['user_id']}")
    
    return {"success": True, "message": "Auction deleted"}


# ====== USER ANALYTICS ENDPOINTS ======

@router.get("/users")
async def get_all_users(
    request: Request,
    search: Optional[str] = None,
    tier: Optional[str] = None,
    sort_by: str = "total_spend",
    limit: int = 50,
    offset: int = 0
):
    """Get all users with full analytics for venue dashboard"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Build query - exclude venue staff from user list
    query = {"role": {"$nin": ["venue_staff", "venue_manager", "admin"]}}
    
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}}
        ]
    
    if tier:
        query["subscription_tier"] = tier
    
    # Determine sort field
    sort_field = "total_spend"
    if sort_by == "visits":
        sort_field = "total_visits"
    elif sort_by == "points":
        sort_field = "points_balance"
    elif sort_by == "created":
        sort_field = "created_at"
    elif sort_by == "name":
        sort_field = "name"
    
    total = await db.users.count_documents(query)
    users = await db.users.find(
        query,
        {"hashed_password": 0, "email_verification_token": 0}
    ).sort(sort_field, -1).skip(offset).limit(limit).to_list(limit)
    
    return {
        "total": total,
        "users": clean_mongo_docs(users)
    }


@router.get("/users/{user_id}")
async def get_user_full_profile(request: Request, user_id: str):
    """Get comprehensive user profile with all analytics"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    admin = await db.users.find_one({"user_id": current_user["user_id"]})
    if not admin or admin.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = await db.users.find_one(
        {"user_id": user_id},
        {"hashed_password": 0, "email_verification_token": 0}
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get spending history
    spending = await db.spending.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    total_spend = sum(s.get("amount", 0) for s in spending)
    
    # Get spending by category
    spending_by_category = {}
    for s in spending:
        cat = s.get("category", "other")
        spending_by_category[cat] = spending_by_category.get(cat, 0) + s.get("amount", 0)
    
    # Get spending by venue
    spending_by_venue = {}
    for s in spending:
        venue = s.get("venue_id", "unknown")
        spending_by_venue[venue] = spending_by_venue.get(venue, 0) + s.get("amount", 0)
    
    # Get redemption history
    redemptions = await db.redemptions.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    
    # Get points transactions
    points_transactions = await db.points_transactions.find({"user_id": user_id}).sort("created_at", -1).to_list(100)
    points_earned = sum(t.get("total_points", 0) for t in points_transactions if t.get("type") == "earn")
    points_spent = sum(abs(t.get("total_points", 0)) for t in points_transactions if t.get("type") == "redeem")
    
    # Get visit history (from check-ins and bookings)
    bookings = await db.bookings.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    guestlist = await db.guestlist.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    
    # Get auction activity
    bids = await db.bids.find({"user_id": user_id}).sort("timestamp", -1).to_list(50)
    auctions_won = await db.auctions.count_documents({"winner_id": user_id, "status": "ended"})
    
    # Get tickets
    tickets = await db.tickets.find({"user_id": user_id}).sort("created_at", -1).to_list(50)
    
    # Get subscription info
    subscription = await db.subscriptions.find_one({"user_id": user_id, "status": "active"})
    
    # Calculate favorite venue
    venue_visits = {}
    for b in bookings:
        v = b.get("venue_id", "unknown")
        venue_visits[v] = venue_visits.get(v, 0) + 1
    for g in guestlist:
        v = g.get("venue_id", "unknown")
        venue_visits[v] = venue_visits.get(v, 0) + 1
    
    favorite_venue = max(venue_visits, key=venue_visits.get) if venue_visits else None
    
    profile = clean_mongo_doc(user)
    profile.update({
        "analytics": {
            "total_spend": total_spend,
            "spending_by_category": spending_by_category,
            "spending_by_venue": spending_by_venue,
            "total_visits": len(bookings) + len(guestlist),
            "favorite_venue": favorite_venue,
            "venue_visit_count": venue_visits,
            "points_earned": points_earned,
            "points_spent": points_spent,
            "total_redemptions": len(redemptions),
            "total_bids": len(bids),
            "auctions_won": auctions_won,
            "tickets_purchased": len(tickets)
        },
        "history": {
            "recent_spending": clean_mongo_docs(spending[:10]),
            "recent_redemptions": clean_mongo_docs(redemptions[:10]),
            "recent_bookings": clean_mongo_docs(bookings[:10]),
            "recent_bids": clean_mongo_docs(bids[:10]),
            "recent_points": clean_mongo_docs(points_transactions[:10])
        },
        "subscription": clean_mongo_doc(subscription) if subscription else None
    })
    
    return profile


@router.put("/users/{user_id}")
async def update_user_profile(request: Request, user_id: str):
    """Update user profile (admin only)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    admin = await db.users.find_one({"user_id": current_user["user_id"]})
    if not admin or admin.get("role") not in ["venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    body = await request.json()
    
    # Fields that can be updated
    allowed_fields = ["name", "phone", "date_of_birth", "age", "gender", "address", 
                      "city", "subscription_tier", "points_balance", "notes"]
    
    update_data = {"updated_at": datetime.now(timezone.utc)}
    for field in allowed_fields:
        if field in body:
            update_data[field] = body[field]
    
    # Recalculate age if DOB updated
    if "date_of_birth" in body and body["date_of_birth"]:
        try:
            dob = datetime.strptime(body["date_of_birth"], "%Y-%m-%d")
            today = datetime.now()
            update_data["age"] = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        except:
            pass
    
    await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    
    return {"success": True, "message": "User profile updated"}


@router.post("/users/{user_id}/add-points")
async def add_points_to_user(request: Request, user_id: str, points: int, reason: str = "Manual adjustment"):
    """Manually add points to a user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    admin = await db.users.find_one({"user_id": current_user["user_id"]})
    if not admin or admin.get("role") not in ["venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"points_balance": points}}
    )
    
    await db.points_transactions.insert_one({
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "type": "earn" if points > 0 else "deduct",
        "total_points": points,
        "source": "manual_adjustment",
        "description": reason,
        "adjusted_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc)
    })
    
    updated_user = await db.users.find_one({"user_id": user_id})
    
    return {
        "success": True,
        "message": f"Added {points} points to {user.get('name')}",
        "new_balance": updated_user.get("points_balance", 0)
    }
