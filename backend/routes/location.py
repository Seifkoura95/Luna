"""
Location API - Real-time location sharing for crews
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs

router = APIRouter(prefix="/location", tags=["location"])


class LocationUpdateRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    venue_id: Optional[str] = None


class LocationShareRequest(BaseModel):
    share_with_crew: bool = True
    duration_minutes: int = 60


@router.post("/update")
async def update_location(request: Request, location: LocationUpdateRequest):
    """Update user's current location"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    location_data = {
        "user_id": current_user["user_id"],
        "latitude": location.latitude,
        "longitude": location.longitude,
        "accuracy": location.accuracy,
        "venue_id": location.venue_id,
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.user_locations.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": location_data},
        upsert=True
    )
    
    return {"success": True, "message": "Location updated"}


@router.get("/me")
async def get_my_location(request: Request):
    """Get current user's last known location"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    location = await db.user_locations.find_one({"user_id": current_user["user_id"]})
    
    if not location:
        return {"location": None}
    
    return {"location": clean_mongo_doc(location)}


@router.get("/crew/{crew_id}")
async def get_crew_locations(request: Request, crew_id: str):
    """Get locations of all crew members"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Verify user is in crew
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    member_ids = [m["user_id"] for m in crew.get("members", [])]
    if current_user["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Not a crew member")
    
    # Get locations for members who are sharing
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    
    locations = await db.user_locations.find({
        "user_id": {"$in": member_ids},
        "sharing_enabled": True,
        "updated_at": {"$gte": one_hour_ago}
    }).to_list(50)
    
    # Enrich with user names
    enriched = []
    for loc in locations:
        user = await db.users.find_one({"user_id": loc["user_id"]})
        loc_data = clean_mongo_doc(loc)
        loc_data["user_name"] = user["name"] if user else "Unknown"
        enriched.append(loc_data)
    
    return enriched


@router.post("/share/{crew_id}")
async def toggle_location_sharing(request: Request, crew_id: str, share_req: LocationShareRequest):
    """Enable/disable location sharing with crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Verify user is in crew
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    member_ids = [m["user_id"] for m in crew.get("members", [])]
    if current_user["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Not a crew member")
    
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=share_req.duration_minutes)
    
    await db.user_locations.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "sharing_enabled": share_req.share_with_crew,
            "sharing_crew_id": crew_id if share_req.share_with_crew else None,
            "sharing_expires_at": expires_at if share_req.share_with_crew else None
        }},
        upsert=True
    )
    
    status = "enabled" if share_req.share_with_crew else "disabled"
    return {
        "success": True,
        "message": f"Location sharing {status}",
        "expires_at": expires_at.isoformat() if share_req.share_with_crew else None
    }


@router.delete("/share")
async def stop_location_sharing(request: Request):
    """Stop sharing location with all crews"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.user_locations.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "sharing_enabled": False,
            "sharing_crew_id": None,
            "sharing_expires_at": None
        }}
    )
    
    return {"success": True, "message": "Location sharing stopped"}


@router.get("/nearby-friends")
async def get_nearby_friends(request: Request, venue_id: Optional[str] = None):
    """Get friends who are nearby or at the same venue"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Get user's friends
    friendships = await db.friends.find({
        "$or": [
            {"user_id": current_user["user_id"], "status": "accepted"},
            {"friend_id": current_user["user_id"], "status": "accepted"}
        ]
    }).to_list(100)
    
    friend_ids = []
    for f in friendships:
        if f["user_id"] == current_user["user_id"]:
            friend_ids.append(f["friend_id"])
        else:
            friend_ids.append(f["user_id"])
    
    # Get recent locations
    thirty_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=30)
    
    query = {
        "user_id": {"$in": friend_ids},
        "sharing_enabled": True,
        "updated_at": {"$gte": thirty_mins_ago}
    }
    
    if venue_id:
        query["venue_id"] = venue_id
    
    locations = await db.user_locations.find(query).to_list(50)
    
    # Enrich with user data
    enriched = []
    for loc in locations:
        user = await db.users.find_one({"user_id": loc["user_id"]})
        if user:
            enriched.append({
                "user_id": loc["user_id"],
                "name": user["name"],
                "venue_id": loc.get("venue_id"),
                "updated_at": loc["updated_at"]
            })
    
    return enriched
