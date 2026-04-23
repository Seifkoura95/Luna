"""
Venue Admin — Auctions
=======================
Full auction CRUD + image upload/serve for the Venue/Lovable admin portal.

All routes are mounted at `/api/venue-admin` (prefix), same as before, so
URL compatibility with mobile + Lovable is preserved.
"""
from __future__ import annotations

import base64
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs
from luna_venues_config import LUNA_VENUES

router = APIRouter(prefix="/venue-admin", tags=["Venue Admin — Auctions"])
logger = logging.getLogger(__name__)


AUCTION_IMAGE_DIR = Path(__file__).parent.parent / "uploads" / "auctions"
AUCTION_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_AUCTION_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_AUCTION_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB


# ====== MODELS ======

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


# ====== HELPER ======

async def _require_venue_role(request: Request, manager_only: bool = False) -> dict:
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    allowed = ["venue_manager", "admin"] if manager_only else ["venue_staff", "venue_manager", "admin"]
    if not user or user.get("role") not in allowed:
        raise HTTPException(status_code=403, detail="Not authorized")
    return user


# ====== IMAGE UPLOAD + SERVE ======
# NOTE: These static paths MUST stay above `/auctions/{auction_id}` so FastAPI
# doesn't match "upload-image" or "image/..." as an auction_id.

@router.post("/auctions/upload-image")
async def upload_auction_image(request: Request):
    """Upload an image for an auction.

    Accepts:
      - `multipart/form-data` with field name `file` (recommended from Lovable)
      - `application/json` with `{"image": "data:image/...;base64,..."}`

    Returns the URL to store on `auctions.image_url`.
    """
    user = await _require_venue_role(request)
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
    """Serve an uploaded auction image. Public (no auth)."""
    if "/" in filename or ".." in filename or filename.startswith(".") or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    filepath = AUCTION_IMAGE_DIR / filename
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Image not found")
    ext = filepath.suffix.lower().lstrip(".")
    media_type = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(
        ext, "application/octet-stream"
    )
    return FileResponse(str(filepath), media_type=media_type)


# ====== AUCTION CRUD ======

@router.get("/auctions")
async def get_all_auctions(
    request: Request,
    status: Optional[str] = None,
    venue_id: Optional[str] = None,
    limit: int = 50,
):
    user = await _require_venue_role(request)

    query: dict = {}
    if status:
        query["status"] = status
    if venue_id:
        query["venue_id"] = venue_id
    elif user.get("role") != "admin" and user.get("venue_id"):
        query["venue_id"] = user["venue_id"]

    auctions = await db.auctions.find(query).sort("created_at", -1).to_list(limit)
    for auction in auctions:
        auction["total_bids"] = await db.bids.count_documents({"auction_id": auction["id"]})
    return clean_mongo_docs(auctions)


@router.post("/auctions")
async def create_auction(request: Request, auction_req: CreateAuctionRequest):
    current_user_record = await _require_venue_role(request)
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
        "created_by": current_user_record["user_id"],
        "created_at": now,
        "updated_at": now,
    }
    await db.auctions.insert_one(auction)
    logger.info("Auction %s created by %s", auction_id, current_user_record["user_id"])

    return {
        "success": True,
        "message": f"Auction '{auction_req.title}' created successfully!",
        "auction": clean_mongo_doc(auction),
    }


@router.get("/auctions/{auction_id}")
async def get_auction_details(request: Request, auction_id: str):
    await _require_venue_role(request)
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    bids = await db.bids.find({"auction_id": auction_id}).sort("timestamp", -1).to_list(50)
    auction_data = clean_mongo_doc(auction)
    auction_data["bids"] = clean_mongo_docs(bids)
    auction_data["total_bids"] = len(bids)
    return auction_data


@router.put("/auctions/{auction_id}")
async def update_auction(request: Request, auction_id: str, update_req: UpdateAuctionRequest):
    await _require_venue_role(request)
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")

    update_data: dict = {"updated_at": datetime.now(timezone.utc)}
    if update_req.title is not None:
        update_data["title"] = update_req.title
    if update_req.description is not None:
        update_data["description"] = update_req.description
    if update_req.image_url is not None:
        update_data["image_url"] = update_req.image_url
    if update_req.starting_bid is not None:
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
            update_data["end_time"] = auction.get("start_time", datetime.now(timezone.utc)) + timedelta(
                hours=update_req.duration_hours
            )

    await db.auctions.update_one({"id": auction_id}, {"$set": update_data})
    updated = await db.auctions.find_one({"id": auction_id})
    return {
        "success": True,
        "message": "Auction updated successfully!",
        "auction": clean_mongo_doc(updated),
    }


@router.post("/auctions/{auction_id}/publish")
async def publish_auction(request: Request, auction_id: str):
    user = await _require_venue_role(request)
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
            "updated_at": now,
        }},
    )
    logger.info("Auction %s published by %s", auction_id, user["user_id"])
    return {"success": True, "message": "Auction is now live!"}


@router.post("/auctions/{auction_id}/unpublish")
async def unpublish_auction(request: Request, auction_id: str):
    await _require_venue_role(request)
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    bid_count = await db.bids.count_documents({"auction_id": auction_id})
    if bid_count > 0:
        raise HTTPException(status_code=400, detail="Cannot unpublish auction with existing bids")
    await db.auctions.update_one(
        {"id": auction_id},
        {"$set": {
            "status": "draft",
            "start_time": None,
            "end_time": None,
            "updated_at": datetime.now(timezone.utc),
        }},
    )
    return {"success": True, "message": "Auction unpublished"}


@router.delete("/auctions/{auction_id}")
async def delete_auction(request: Request, auction_id: str):
    user = await _require_venue_role(request, manager_only=True)
    auction = await db.auctions.find_one({"id": auction_id})
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    bid_count = await db.bids.count_documents({"auction_id": auction_id})
    if bid_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete auction with existing bids. End it instead.")
    await db.auctions.delete_one({"id": auction_id})
    logger.info("Auction %s deleted by %s", auction_id, user["user_id"])
    return {"success": True, "message": "Auction deleted"}
