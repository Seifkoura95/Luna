"""
Crews API - Group planning and social features
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime, timezone

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs

router = APIRouter(prefix="/crews", tags=["crews"])


class CreateCrewRequest(BaseModel):
    name: str
    event_id: Optional[str] = None


class InviteToCrewRequest(BaseModel):
    crew_id: str
    email: Optional[str] = None
    user_id: Optional[str] = None


class BoothBidRequest(BaseModel):
    crew_id: str
    auction_id: str
    bid_amount: float


@router.post("/create")
async def create_crew(request: Request, crew_req: CreateCrewRequest):
    """Create a new crew for group planning"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    crew_id = str(uuid.uuid4())[:8].upper()
    
    crew = {
        "id": crew_id,
        "name": crew_req.name,
        "owner_id": current_user["user_id"],
        "owner_name": user["name"] if user else "Unknown",
        "event_id": crew_req.event_id,
        "members": [{
            "user_id": current_user["user_id"],
            "name": user["name"] if user else "Unknown",
            "role": "owner",
            "status": "confirmed",
            "joined_at": datetime.now(timezone.utc)
        }],
        "shared_booth_bid": None,
        "split_payments": [],
        "invite_code": f"CREW-{crew_id}",
        "created_at": datetime.now(timezone.utc),
        "status": "active"
    }
    
    await db.crews.insert_one(crew)
    return {"success": True, "crew": clean_mongo_doc(crew)}


@router.get("")
async def get_user_crews(request: Request):
    """Get all crews the user is part of"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crews = await db.crews.find({
        "$or": [
            {"owner_id": current_user["user_id"]},
            {"members.user_id": current_user["user_id"]}
        ]
    }).sort("created_at", -1).to_list(50)
    
    return clean_mongo_docs(crews)


@router.get("/{crew_id}")
async def get_crew_detail(request: Request, crew_id: str):
    """Get detailed crew info"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    # Get event details if linked
    event = None
    if crew.get("event_id"):
        event = await db.events.find_one({"id": crew["event_id"]})
    
    crew_data = clean_mongo_doc(crew)
    crew_data["event"] = clean_mongo_doc(event) if event else None
    
    return crew_data


@router.post("/invite")
async def invite_to_crew(request: Request, invite_req: InviteToCrewRequest):
    """Invite someone to join a crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew = await db.crews.find_one({"id": invite_req.crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    # Find invitee
    invitee = None
    if invite_req.user_id:
        invitee = await db.users.find_one({"user_id": invite_req.user_id})
    elif invite_req.email:
        invitee = await db.users.find_one({"email": invite_req.email})
    
    if not invitee:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already member
    member_ids = [m["user_id"] for m in crew.get("members", [])]
    if invitee["user_id"] in member_ids:
        raise HTTPException(status_code=400, detail="User is already a member")
    
    # Add as pending member
    new_member = {
        "user_id": invitee["user_id"],
        "name": invitee["name"],
        "role": "member",
        "status": "pending",
        "invited_at": datetime.now(timezone.utc),
        "invited_by": current_user["user_id"]
    }
    
    await db.crews.update_one(
        {"id": invite_req.crew_id},
        {"$push": {"members": new_member}}
    )
    
    # Create notification for invitee
    await db.notifications.insert_one({
        "id": str(uuid.uuid4())[:8],
        "user_id": invitee["user_id"],
        "type": "crew_invite",
        "title": "Crew Invitation",
        "message": f"You've been invited to join {crew['name']}",
        "data": {"crew_id": invite_req.crew_id},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"success": True, "message": f"Invitation sent to {invitee['name']}"}


@router.post("/{crew_id}/join")
async def join_crew(request: Request, crew_id: str):
    """Accept crew invitation and join"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    # Update member status
    result = await db.crews.update_one(
        {"id": crew_id, "members.user_id": current_user["user_id"]},
        {"$set": {
            "members.$.status": "confirmed",
            "members.$.joined_at": datetime.now(timezone.utc)
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Not invited to this crew")
    
    return {"success": True, "message": "Successfully joined the crew"}


@router.post("/booth-bid")
async def submit_crew_booth_bid(request: Request, bid_req: BoothBidRequest):
    """Submit a collective booth bid as a crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew = await db.crews.find_one({"id": bid_req.crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    # Verify user is crew owner or member
    member_ids = [m["user_id"] for m in crew.get("members", [])]
    if current_user["user_id"] not in member_ids:
        raise HTTPException(status_code=403, detail="Not a crew member")
    
    # Update crew with booth bid
    await db.crews.update_one(
        {"id": bid_req.crew_id},
        {"$set": {
            "shared_booth_bid": {
                "auction_id": bid_req.auction_id,
                "bid_amount": bid_req.bid_amount,
                "submitted_by": current_user["user_id"],
                "submitted_at": datetime.now(timezone.utc)
            }
        }}
    )
    
    return {"success": True, "message": "Crew booth bid submitted"}


@router.delete("/{crew_id}/leave")
async def leave_crew(request: Request, crew_id: str):
    """Leave a crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    if crew["owner_id"] == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Owner cannot leave. Transfer ownership first.")
    
    await db.crews.update_one(
        {"id": crew_id},
        {"$pull": {"members": {"user_id": current_user["user_id"]}}}
    )
    
    return {"success": True, "message": "Left the crew"}


@router.get("/{crew_id}/split-status")
async def get_split_status(request: Request, crew_id: str):
    """Get payment split status for a crew"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    crew = await db.crews.find_one({"id": crew_id})
    if not crew:
        raise HTTPException(status_code=404, detail="Crew not found")
    
    members = crew.get("members", [])
    confirmed_members = [m for m in members if m.get("status") == "confirmed"]
    
    split_info = {
        "crew_id": crew_id,
        "total_members": len(confirmed_members),
        "split_payments": crew.get("split_payments", []),
        "booth_bid": crew.get("shared_booth_bid")
    }
    
    if crew.get("shared_booth_bid"):
        split_amount = crew["shared_booth_bid"]["bid_amount"] / len(confirmed_members)
        split_info["per_person_amount"] = round(split_amount, 2)
    
    return split_info
