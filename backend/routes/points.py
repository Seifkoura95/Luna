"""
Points System API endpoints
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import uuid
from datetime import datetime, timezone

from database import db
from config import SUBSCRIPTION_TIERS, POINTS_PER_DOLLAR
from utils.auth import get_current_user
from utils.mongo import clean_mongo_docs
from models.user import RecordSpendingRequest

router = APIRouter(prefix="/points", tags=["Points"])


async def award_points(user_id: str, amount_spent: float, source: str, source_id: str):
    """Award points to a user based on spending"""
    subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active"
    })
    
    tier_id = subscription.get("tier_id", "lunar") if subscription else "lunar"
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS["lunar"])
    multiplier = tier["benefits"]["points_multiplier"]
    
    base_points = int(amount_spent * POINTS_PER_DOLLAR)
    bonus_points = int(base_points * (multiplier - 1))
    total_points = base_points + bonus_points
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"points_balance": total_points}}
    )
    
    await db.points_transactions.insert_one({
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "type": "earn",
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "source": source,
        "source_id": source_id,
        "amount_spent": amount_spent,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier
    }


@router.get("/balance")
async def get_points_balance(request: Request):
    """Get user's points balance and tier info"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription = await db.subscriptions.find_one({
        "user_id": current_user["user_id"],
        "status": "active"
    })
    
    tier_id = subscription.get("tier_id", "lunar") if subscription else "lunar"
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS["lunar"])
    
    return {
        "points_balance": user.get("points_balance", 0),
        "tier_id": tier_id,
        "tier_name": tier["name"],
        "multiplier": tier["benefits"]["points_multiplier"],
        "next_tier_points": tier.get("next_tier_points", None)
    }


@router.get("/history")
async def get_points_history(request: Request, limit: int = 50):
    """Get user's points transaction history"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    transactions = await db.points_transactions.find({
        "user_id": current_user["user_id"]
    }).sort("created_at", -1).to_list(limit)
    
    return clean_mongo_docs(transactions)


@router.post("/record-spending")
async def record_spending(request: Request, spending_req: RecordSpendingRequest):
    """Record spending and award points (venue staff endpoint)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or user.get("role") not in ["venue_staff", "venue_manager", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    target_user = await db.users.find_one({"user_id": spending_req.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    spending_id = str(uuid.uuid4())[:8]
    await db.spending.insert_one({
        "id": spending_id,
        "user_id": spending_req.user_id,
        "venue_id": spending_req.venue_id,
        "amount": spending_req.amount,
        "category": spending_req.category,
        "recorded_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc)
    })
    
    points_result = await award_points(
        user_id=spending_req.user_id,
        amount_spent=spending_req.amount,
        source="spending",
        source_id=spending_id
    )
    
    return {
        "success": True,
        "message": f"Points awarded to {target_user.get('name', 'user')}",
        **points_result
    }


@router.post("/simulate-purchase")
async def simulate_purchase(request: Request, amount: float, venue_id: Optional[str] = None):
    """Simulate a purchase and award points (for testing)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    spending_id = str(uuid.uuid4())[:8]
    await db.spending.insert_one({
        "id": spending_id,
        "user_id": current_user["user_id"],
        "venue_id": venue_id or "eclipse",
        "amount": amount,
        "category": "food_drink",
        "simulated": True,
        "created_at": datetime.now(timezone.utc)
    })
    
    points_result = await award_points(
        user_id=current_user["user_id"],
        amount_spent=amount,
        source="purchase_simulation",
        source_id=spending_id
    )
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    return {
        "success": True,
        "message": f"Purchase simulated! You earned {points_result['total_points']} points",
        "new_balance": user.get("points_balance", 0),
        **points_result
    }
