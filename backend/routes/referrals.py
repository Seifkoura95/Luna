"""
Referral System API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
import uuid
import secrets
import logging
from datetime import datetime, timezone

from database import db
from config import REFERRAL_POINTS_REWARD
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs
from routes.shared import create_notification

router = APIRouter(prefix="/referral", tags=["Referrals"])
logger = logging.getLogger(__name__)


async def complete_referral(referred_user_id: str):
    """Complete a referral and award points to the referrer."""
    referral = await db.referrals.find_one({
        "referred_user_id": referred_user_id,
        "status": "pending"
    })
    
    if not referral:
        return None
    
    await db.referrals.update_one(
        {"_id": referral["_id"]},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc)
        }}
    )
    
    from utils.points_guard import can_earn_points
    if await can_earn_points(referral["referrer_user_id"]):
        await db.users.update_one(
            {"user_id": referral["referrer_user_id"]},
            {"$inc": {"points_balance": REFERRAL_POINTS_REWARD}}
        )
    
    await create_notification(
        user_id=referral["referrer_user_id"],
        notification_type="referral",
        title="Referral Bonus!",
        message=f"Your friend just joined Luna! You earned {REFERRAL_POINTS_REWARD} points.",
        data={
            "points_earned": REFERRAL_POINTS_REWARD,
            "referral_id": referral["id"]
        },
        priority="high"
    )
    
    logger.info(f"Referral completed: {referral['referrer_user_id']} earned {REFERRAL_POINTS_REWARD} points")
    return referral


@router.get("/code")
async def get_referral_code(request: Request):
    """Get or generate user's unique referral code"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("referral_code"):
        referral_code = user["referral_code"]
    else:
        name_part = (user.get("name", "LUNA")[:4]).upper().replace(" ", "")
        random_part = secrets.token_hex(3).upper()
        referral_code = f"{name_part}{random_part}"
        
        await db.users.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": {"referral_code": referral_code}}
        )
    
    successful_referrals = await db.referrals.count_documents({
        "referrer_user_id": current_user["user_id"],
        "status": "completed"
    })
    
    pending_referrals = await db.referrals.count_documents({
        "referrer_user_id": current_user["user_id"],
        "status": "pending"
    })
    
    total_points_earned = successful_referrals * REFERRAL_POINTS_REWARD
    
    return {
        "referral_code": referral_code,
        "referral_link": f"https://lunagroup.app/join?ref={referral_code}",
        "stats": {
            "successful_referrals": successful_referrals,
            "pending_referrals": pending_referrals,
            "total_points_earned": total_points_earned,
            "points_per_referral": REFERRAL_POINTS_REWARD
        }
    }


@router.get("/history")
async def get_referral_history(request: Request):
    """Get user's referral history"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    referrals = await db.referrals.find({
        "referrer_user_id": current_user["user_id"]
    }).sort("created_at", -1).to_list(50)
    
    return {
        "referrals": clean_mongo_docs(referrals),
        "total": len(referrals)
    }


@router.post("/apply")
async def apply_referral_code(referral_code: str, request: Request):
    """Apply a referral code for a new user"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    existing = await db.referrals.find_one({
        "referred_user_id": current_user["user_id"]
    })
    if existing:
        raise HTTPException(status_code=400, detail="You have already used a referral code")
    
    referrer = await db.users.find_one({"referral_code": referral_code.upper()})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referrer["user_id"] == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="You cannot use your own referral code")
    
    referral = {
        "id": str(uuid.uuid4())[:8],
        "referrer_user_id": referrer["user_id"],
        "referrer_name": referrer.get("name", "Luna Member"),
        "referred_user_id": current_user["user_id"],
        "referral_code": referral_code.upper(),
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.referrals.insert_one(referral)
    
    return {
        "success": True,
        "message": f"Referral code applied! {referrer.get('name', 'Your friend')} will receive {REFERRAL_POINTS_REWARD} points once you're verified.",
        "referral": clean_mongo_doc(referral)
    }


@router.post("/verify/{user_id}")
async def verify_and_complete_referral(user_id: str, request: Request):
    """Admin endpoint to verify a user and complete their referral"""
    auth_header = request.headers.get("authorization")
    get_current_user(auth_header)  # Validate auth
    
    result = await complete_referral(user_id)
    
    if result:
        return {
            "success": True,
            "message": f"Referral completed! {result['referrer_name']} earned {REFERRAL_POINTS_REWARD} points.",
            "referral": clean_mongo_doc(result)
        }
    else:
        return {
            "success": False,
            "message": "No pending referral found for this user"
        }
