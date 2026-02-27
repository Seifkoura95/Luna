"""
Rewards and Redemptions API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import uuid
import secrets
import hmac
import hashlib
from datetime import datetime, timezone, timedelta

from database import db
from config import QR_SECRET
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs
from luna_venues_config import LUNA_VENUES

router = APIRouter(tags=["Rewards"])


def generate_qr_code(redemption_id: str, user_id: str) -> str:
    """Generate a secure one-time use QR code"""
    timestamp = int(datetime.now(timezone.utc).timestamp())
    data = f"{redemption_id}:{user_id}:{timestamp}"
    signature = hmac.new(QR_SECRET.encode(), data.encode(), hashlib.sha256).hexdigest()[:12]
    return f"LUNA-{redemption_id[:8].upper()}-{signature.upper()}"


def verify_qr_code(qr_code: str, redemption_id: str) -> bool:
    """Verify QR code is valid"""
    if not qr_code.startswith("LUNA-"):
        return False
    parts = qr_code.split("-")
    if len(parts) != 3:
        return False
    return parts[1].lower() == redemption_id[:8].lower()


@router.get("/rewards")
async def get_rewards(category: Optional[str] = None, venue_id: Optional[str] = None):
    """Get available rewards"""
    query = {"is_active": True}
    if category:
        query["category"] = category
    rewards = await db.rewards.find(query).to_list(100)
    if venue_id:
        rewards = [r for r in rewards if r.get("venue_restriction") is None or r.get("venue_restriction") == venue_id]
    return clean_mongo_docs(rewards)


@router.post("/rewards/redeem")
async def redeem_reward(request: Request, reward_id: str, venue_id: Optional[str] = None):
    """Redeem a reward using points"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    reward = await db.rewards.find_one({"id": reward_id})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if reward.get("venue_restriction") and reward["venue_restriction"] != venue_id:
        raise HTTPException(status_code=400, detail="Reward not available at this venue")
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if user["points_balance"] < reward["points_cost"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"points_balance": -reward["points_cost"]}}
    )
    
    redemption = {
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "reward_id": reward_id,
        "reward_name": reward["name"],
        "points_spent": reward["points_cost"],
        "venue_redeemed": venue_id,
        "validation_code": secrets.token_hex(4).upper(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=24)
    }
    await db.redemptions.insert_one(redemption)
    
    new_user = await db.users.find_one({"user_id": user["user_id"]})
    return {
        "message": "Reward redeemed successfully!",
        "redemption": clean_mongo_doc(redemption),
        "new_balance": new_user["points_balance"]
    }


@router.post("/rewards/redeem-with-qr")
async def redeem_reward_with_qr(request: Request, reward_id: str, venue_id: Optional[str] = None):
    """Redeem reward and get a QR code for redemption"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    reward = await db.rewards.find_one({"id": reward_id})
    if not reward:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if reward.get("venue_restriction") and reward["venue_restriction"] != venue_id:
        raise HTTPException(status_code=400, detail="Reward not available at this venue")
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if user["points_balance"] < reward["points_cost"]:
        raise HTTPException(status_code=400, detail="Insufficient points")
    
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"points_balance": -reward["points_cost"]}}
    )
    
    redemption_id = str(uuid.uuid4())
    qr_code = generate_qr_code(redemption_id, user["user_id"])
    
    redemption = {
        "id": redemption_id,
        "user_id": user["user_id"],
        "reward_id": reward_id,
        "reward_name": reward["name"],
        "reward_description": reward.get("description", ""),
        "reward_category": reward.get("category", "general"),
        "points_spent": reward["points_cost"],
        "venue_id": venue_id,
        "qr_code": qr_code,
        "status": "pending",
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=48)
    }
    
    await db.redemptions.insert_one(redemption)
    
    await db.points_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "amount": -reward["points_cost"],
        "type": "reward_redemption",
        "description": f"Redeemed: {reward['name']}",
        "reward_id": reward_id,
        "redemption_id": redemption_id,
        "created_at": datetime.now(timezone.utc)
    })
    
    new_user = await db.users.find_one({"user_id": user["user_id"]})
    
    return {
        "success": True,
        "message": "Reward redeemed! Show QR code at venue.",
        "redemption": clean_mongo_doc(redemption),
        "qr_code": qr_code,
        "new_balance": new_user["points_balance"]
    }


@router.get("/redemptions/my")
async def get_my_redemptions(request: Request, status: Optional[str] = None):
    """Get user's redemptions with QR codes"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    query = {"user_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    redemptions = await db.redemptions.find(query).sort("created_at", -1).to_list(50)
    return clean_mongo_docs(redemptions)


@router.get("/redemptions/{redemption_id}")
async def get_redemption(request: Request, redemption_id: str):
    """Get a specific redemption with QR code"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    redemption = await db.redemptions.find_one({
        "id": redemption_id,
        "user_id": current_user["user_id"]
    })
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    
    return clean_mongo_doc(redemption)


@router.get("/checkin/qr")
async def generate_checkin_qr(request: Request, venue_id: str):
    """Generate QR code for venue check-in"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=400, detail="Invalid venue")
    
    timestamp = int(datetime.now(timezone.utc).timestamp())
    expiry = timestamp + 60
    payload = f"{current_user['user_id']}:{venue_id}:{timestamp}:{expiry}"
    signature = hmac.new(QR_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    qr_data = f"{payload}:{signature}"
    
    return {
        "qr_data": qr_data,
        "user_id": current_user["user_id"],
        "venue_id": venue_id,
        "venue_name": LUNA_VENUES[venue_id]["name"],
        "generated_at": timestamp,
        "expires_at": expiry
    }
