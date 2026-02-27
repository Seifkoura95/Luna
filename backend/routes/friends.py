"""
Friends & Social API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import uuid
from datetime import datetime, timezone
from pydantic import BaseModel

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_docs

router = APIRouter(prefix="/friends", tags=["Friends"])


class FriendRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None


@router.get("")
async def get_friends(request: Request):
    """Get user's friends list"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    friend_ids = user.get("friends", []) if user else []
    
    friends = []
    for friend_id in friend_ids:
        friend = await db.users.find_one({"user_id": friend_id})
        if friend:
            friends.append({
                "user_id": friend["user_id"],
                "name": friend.get("name", "Unknown"),
                "username": friend.get("username"),
                "avatar": friend.get("avatar"),
                "tier": friend.get("tier", "bronze")
            })
    
    return {"friends": friends, "count": len(friends)}


@router.post("/request")
async def send_friend_request(request: Request, friend_req: FriendRequest):
    """Send a friend request by email or username"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    target_user = None
    if friend_req.email:
        target_user = await db.users.find_one({"email": friend_req.email.lower()})
    elif friend_req.username:
        target_user = await db.users.find_one({"username": friend_req.username.lower()})
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if target_user["user_id"] == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a friend")
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if target_user["user_id"] in user.get("friends", []):
        raise HTTPException(status_code=400, detail="Already friends")
    
    existing = await db.friend_requests.find_one({
        "from_user_id": current_user["user_id"],
        "to_user_id": target_user["user_id"],
        "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already sent")
    
    friend_request_doc = {
        "id": str(uuid.uuid4())[:8],
        "from_user_id": current_user["user_id"],
        "from_name": user.get("name", "Unknown"),
        "to_user_id": target_user["user_id"],
        "to_name": target_user.get("name", "Unknown"),
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.friend_requests.insert_one(friend_request_doc)
    
    notification = {
        "id": str(uuid.uuid4())[:8],
        "user_id": target_user["user_id"],
        "type": "friend_request",
        "title": "New Friend Request",
        "body": f"{user.get('name', 'Someone')} wants to be friends",
        "data": {"request_id": friend_request_doc["id"]},
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    return {"success": True, "message": "Friend request sent", "request_id": friend_request_doc["id"]}


@router.get("/requests")
async def get_friend_requests(request: Request):
    """Get pending friend requests"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    incoming = await db.friend_requests.find({
        "to_user_id": current_user["user_id"],
        "status": "pending"
    }).to_list(50)
    
    outgoing = await db.friend_requests.find({
        "from_user_id": current_user["user_id"],
        "status": "pending"
    }).to_list(50)
    
    return {
        "incoming": clean_mongo_docs(incoming),
        "outgoing": clean_mongo_docs(outgoing)
    }


@router.post("/requests/{request_id}/accept")
async def accept_friend_request(request: Request, request_id: str):
    """Accept a friend request"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    friend_request = await db.friend_requests.find_one({
        "id": request_id,
        "to_user_id": current_user["user_id"],
        "status": "pending"
    })
    
    if not friend_request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$addToSet": {"friends": friend_request["from_user_id"]}}
    )
    await db.users.update_one(
        {"user_id": friend_request["from_user_id"]},
        {"$addToSet": {"friends": current_user["user_id"]}}
    )
    
    await db.friend_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "accepted", "accepted_at": datetime.now(timezone.utc)}}
    )
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    notification = {
        "id": str(uuid.uuid4())[:8],
        "user_id": friend_request["from_user_id"],
        "type": "friend_accepted",
        "title": "Friend Request Accepted",
        "body": f"{user.get('name', 'Someone')} accepted your friend request!",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    return {"success": True, "message": "Friend request accepted"}


@router.post("/requests/{request_id}/decline")
async def decline_friend_request(request: Request, request_id: str):
    """Decline a friend request"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.friend_requests.update_one(
        {"id": request_id, "to_user_id": current_user["user_id"], "status": "pending"},
        {"$set": {"status": "declined", "declined_at": datetime.now(timezone.utc)}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    return {"success": True, "message": "Friend request declined"}


@router.delete("/{friend_id}")
async def remove_friend(request: Request, friend_id: str):
    """Remove a friend"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$pull": {"friends": friend_id}}
    )
    await db.users.update_one(
        {"user_id": friend_id},
        {"$pull": {"friends": current_user["user_id"]}}
    )
    
    return {"success": True, "message": "Friend removed"}
