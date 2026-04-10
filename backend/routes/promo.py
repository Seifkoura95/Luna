"""
Promo Code Routes - Manage promo codes and vouchers
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
import uuid
import logging

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/promo", tags=["promo"])
logger = logging.getLogger(__name__)

# Promo codes configuration
PROMO_CODES = {
    "LUNA50": {
        "type": "bonus_points",
        "value": 50,
        "description": "50 bonus Luna Points",
        "max_uses": 1,
        "active": True
    },
    "LUNAWEEKEND": {
        "type": "bonus_points",
        "value": 100,
        "description": "Weekend special - 100 bonus points!",
        "max_uses": 1,
        "active": True
    },
    "FREEENTRY": {
        "type": "free_entry",
        "value": 1,
        "description": "One free entry voucher",
        "venue": "any",
        "max_uses": 1,
        "active": True
    },
    "ECLIPSEFREE": {
        "type": "free_entry",
        "value": 1,
        "description": "Free entry to Eclipse",
        "venue": "eclipse",
        "max_uses": 1,
        "active": True
    },
    "FREEDRINK": {
        "type": "drink_voucher",
        "value": 1,
        "description": "One free drink voucher",
        "max_uses": 1,
        "active": True
    },
    "VIP2024": {
        "type": "combo",
        "rewards": [
            {"type": "bonus_points", "value": 75},
            {"type": "drink_voucher", "value": 2}
        ],
        "description": "VIP Special - 75 points + 2 free drinks",
        "max_uses": 1,
        "active": True
    }
}


class ApplyPromoRequest(BaseModel):
    """Request to apply a promo code"""
    code: str


@router.post("/apply")
async def apply_promo_code(request: Request, body: ApplyPromoRequest):
    """Apply a promo code to the user's account"""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    code = body.code.strip().upper()
    
    if code not in PROMO_CODES:
        raise HTTPException(status_code=400, detail="Invalid promo code")
    
    promo = PROMO_CODES[code]
    
    if not promo.get("active"):
        raise HTTPException(status_code=400, detail="This promo code has expired")
    
    existing_use = await db.promo_redemptions.find_one({
        "user_id": user_id,
        "code": code
    })
    
    if existing_use:
        raise HTTPException(status_code=400, detail="You have already used this promo code")
    
    # Process the promo code rewards
    rewards_applied = []
    points_added = 0
    vouchers_added = []
    
    if promo["type"] == "bonus_points":
        points_added = promo["value"]
        rewards_applied.append(f"+{promo['value']} Luna Points")
    
    elif promo["type"] == "free_entry":
        voucher = {
            "voucher_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "free_entry",
            "venue": promo.get("venue", "any"),
            "quantity": promo["value"],
            "source": f"promo_code:{code}",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        }
        await db.vouchers.insert_one(voucher)
        vouchers_added.append(voucher)
        rewards_applied.append(f"{promo['value']}x Free Entry Voucher")
    
    elif promo["type"] == "drink_voucher":
        voucher = {
            "voucher_id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "drink_voucher",
            "quantity": promo["value"],
            "source": f"promo_code:{code}",
            "status": "active",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        }
        await db.vouchers.insert_one(voucher)
        vouchers_added.append(voucher)
        rewards_applied.append(f"{promo['value']}x Free Drink Voucher")
    
    elif promo["type"] == "combo":
        for reward in promo.get("rewards", []):
            if reward["type"] == "bonus_points":
                points_added += reward["value"]
                rewards_applied.append(f"+{reward['value']} Luna Points")
            elif reward["type"] == "drink_voucher":
                voucher = {
                    "voucher_id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "type": "drink_voucher",
                    "quantity": reward["value"],
                    "source": f"promo_code:{code}",
                    "status": "active",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                }
                await db.vouchers.insert_one(voucher)
                vouchers_added.append(voucher)
                rewards_applied.append(f"{reward['value']}x Free Drink Voucher")
    
    # Add points if any
    if points_added > 0:
        current_points = user.get("points", 0)
        await db.users.update_one(
            {"user_id": user_id},
            {
                "$set": {"points": current_points + points_added},
                "$push": {
                    "points_history": {
                        "amount": points_added,
                        "type": "promo_code",
                        "description": f"Promo code: {code}",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
    
    # Record promo redemption
    await db.promo_redemptions.insert_one({
        "user_id": user_id,
        "code": code,
        "promo_type": promo["type"],
        "rewards_applied": rewards_applied,
        "points_added": points_added,
        "vouchers_added": len(vouchers_added),
        "redeemed_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "code": code,
        "description": promo["description"],
        "rewards_applied": rewards_applied,
        "points_added": points_added,
        "vouchers_added": len(vouchers_added),
        "new_points_balance": user.get("points", 0) + points_added
    }


@router.get("/validate/{code}")
async def validate_promo_code(request: Request, code: str):
    """Validate a promo code without applying it"""
    auth_header = request.headers.get("Authorization")
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    code = code.strip().upper()
    
    if code not in PROMO_CODES:
        return {
            "valid": False,
            "error": "Invalid promo code"
        }
    
    promo = PROMO_CODES[code]
    
    if not promo.get("active"):
        return {
            "valid": False,
            "error": "This promo code has expired"
        }
    
    existing_use = await db.promo_redemptions.find_one({
        "user_id": user_id,
        "code": code
    })
    
    if existing_use:
        return {
            "valid": False,
            "error": "You have already used this promo code"
        }
    
    return {
        "valid": True,
        "code": code,
        "type": promo["type"],
        "description": promo["description"]
    }


@router.get("/codes")
async def get_available_promo_codes():
    """Get list of available promo codes (for admin/testing)"""
    return {
        "codes": [
            {"code": code, "description": data["description"], "type": data["type"]}
            for code, data in PROMO_CODES.items()
            if data.get("active")
        ]
    }
