"""
Birthday Club Routes - Special birthday rewards and celebrations
"""
from fastapi import APIRouter, Header, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import logging

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/birthday", tags=["birthday"])
logger = logging.getLogger(__name__)


# Birthday reward configuration
BIRTHDAY_REWARDS = {
    "free_entry": {
        "id": "birthday_free_entry",
        "name": "Birthday Free Entry",
        "description": "Free entry to any Luna Group venue on your birthday week",
        "type": "entry",
        "value": 1,
        "icon": "ticket"
    },
    "free_drink": {
        "id": "birthday_free_drink", 
        "name": "Birthday Drink",
        "description": "Complimentary drink on us - Happy Birthday!",
        "type": "drink",
        "value": 1,
        "icon": "wine"
    },
    "bonus_points": {
        "id": "birthday_bonus_points",
        "name": "Birthday Bonus Points",
        "description": "250 bonus Luna Points for your special day",
        "type": "points",
        "value": 250,
        "icon": "star"
    },
    "double_points": {
        "id": "birthday_double_points",
        "name": "Birthday Double Points",
        "description": "Earn 2x points on all purchases during your birthday week",
        "type": "multiplier",
        "value": 2,
        "duration_days": 7,
        "icon": "sparkles"
    }
}


def is_birthday_week(date_of_birth: str) -> bool:
    """Check if user's birthday is within this week (3 days before or after)"""
    if not date_of_birth:
        return False
    
    try:
        # Parse DOB (format: YYYY-MM-DD)
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
        today = datetime.now(timezone.utc)
        
        # Create this year's birthday
        this_year_birthday = dob.replace(year=today.year)
        
        # Check if within 3 days before or after
        delta = abs((today.date() - this_year_birthday.date()).days)
        return delta <= 3
    except:
        return False


def is_birthday_today(date_of_birth: str) -> bool:
    """Check if today is the user's birthday"""
    if not date_of_birth:
        return False
    
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
        today = datetime.now(timezone.utc)
        return dob.month == today.month and dob.day == today.day
    except:
        return False


def get_days_until_birthday(date_of_birth: str) -> int:
    """Get number of days until next birthday"""
    if not date_of_birth:
        return -1
    
    try:
        dob = datetime.strptime(date_of_birth, "%Y-%m-%d")
        today = datetime.now(timezone.utc).date()
        
        # This year's birthday
        this_year_birthday = dob.replace(year=today.year).date()
        
        if this_year_birthday < today:
            # Birthday has passed, calculate for next year
            next_birthday = dob.replace(year=today.year + 1).date()
        else:
            next_birthday = this_year_birthday
        
        return (next_birthday - today).days
    except:
        return -1


@router.get("/status")
async def get_birthday_status(authorization: str = Header(None)):
    """Get user's birthday status and available rewards"""
    user = get_current_user(authorization)
    user_id = user.get("user_id")
    
    # Get full user record
    user_record = await db.users.find_one({"user_id": user_id})
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")
    
    date_of_birth = user_record.get("date_of_birth")
    
    if not date_of_birth:
        return {
            "has_birthday_set": False,
            "message": "Set your birthday in your profile to unlock Birthday Club rewards!",
            "is_birthday_today": False,
            "is_birthday_week": False,
            "days_until_birthday": None,
            "available_rewards": [],
            "claimed_rewards": []
        }
    
    # Check birthday status
    birthday_today = is_birthday_today(date_of_birth)
    birthday_week = is_birthday_week(date_of_birth)
    days_until = get_days_until_birthday(date_of_birth)
    
    # Get claimed rewards for this year
    current_year = datetime.now(timezone.utc).year
    claimed = await db.birthday_rewards.find({
        "user_id": user_id,
        "year": current_year
    }, {"_id": 0}).to_list(10)
    
    claimed_ids = [r.get("reward_id") for r in claimed]
    
    # Determine available rewards
    available_rewards = []
    if birthday_week or birthday_today:
        for reward_id, reward in BIRTHDAY_REWARDS.items():
            reward_copy = reward.copy()
            reward_copy["claimed"] = reward["id"] in claimed_ids
            available_rewards.append(reward_copy)
    
    return {
        "has_birthday_set": True,
        "date_of_birth": date_of_birth,
        "is_birthday_today": birthday_today,
        "is_birthday_week": birthday_week,
        "days_until_birthday": days_until,
        "available_rewards": available_rewards,
        "claimed_rewards": claimed,
        "message": "Happy Birthday! 🎂" if birthday_today else (
            "It's your birthday week! Claim your rewards!" if birthday_week else
            f"Your birthday is in {days_until} days!"
        )
    }


@router.post("/claim/{reward_id}")
async def claim_birthday_reward(reward_id: str, authorization: str = Header(None)):
    """Claim a birthday reward"""
    user = get_current_user(authorization)
    user_id = user.get("user_id")
    
    # Validate reward exists
    if reward_id not in BIRTHDAY_REWARDS:
        raise HTTPException(status_code=400, detail="Invalid reward")
    
    reward = BIRTHDAY_REWARDS[reward_id]
    
    # Get user record
    user_record = await db.users.find_one({"user_id": user_id})
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")
    
    date_of_birth = user_record.get("date_of_birth")
    
    # Check if it's birthday week
    if not is_birthday_week(date_of_birth) and not is_birthday_today(date_of_birth):
        raise HTTPException(status_code=400, detail="Birthday rewards are only available during your birthday week")
    
    # Check if already claimed this year
    current_year = datetime.now(timezone.utc).year
    existing = await db.birthday_rewards.find_one({
        "user_id": user_id,
        "reward_id": reward["id"],
        "year": current_year
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="You've already claimed this reward this year")
    
    # Generate unique QR code for redeemable rewards
    qr_code = None
    if reward["type"] in ["entry", "drink"]:
        qr_code = f"LUNA-BDAY-{reward_id.upper()}-{user_id[:8]}-{uuid.uuid4().hex[:8].upper()}"
    
    # Create the reward claim
    claim_record = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "reward_id": reward["id"],
        "reward_name": reward["name"],
        "reward_type": reward["type"],
        "reward_value": reward["value"],
        "year": current_year,
        "claimed_at": datetime.now(timezone.utc),
        "redeemed": False,
        "redeemed_at": None,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
        "qr_code": qr_code
    }
    
    await db.birthday_rewards.insert_one(claim_record)
    
    # If it's bonus points, dispatch via unified points service
    if reward["type"] == "points":
        from services.points_service import award_points as _award_points
        await _award_points(
            user_id=user_id,
            event_type="birthday",
            points_override=reward["value"],
            reason=f"Birthday bonus: {reward['name']}",
        )
    
    # For entry and drink rewards, add to wallet as a ticket/pass
    if reward["type"] in ["entry", "drink"]:
        wallet_item = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "type": "birthday_reward",
            "reward_type": reward["type"],
            "title": reward["name"],
            "description": reward["description"],
            "qr_code": qr_code,
            "status": "active",
            "one_time_use": True,
            "redeemed": False,
            "redeemed_at": None,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
            "created_at": datetime.now(timezone.utc),
            "birthday_reward_id": claim_record["id"],
            "venue_name": "Any Luna Group Venue",
            "icon": reward.get("icon", "gift")
        }
        await db.wallet_passes.insert_one(wallet_item)
    
    # Remove _id for response
    claim_record.pop("_id", None)

    logger.info(f"User {user_id} claimed birthday reward: {reward['name']}")

    # Branded birthday email via Resend (fire-and-forget, never blocks claim response)
    if user.get("email"):
        try:
            import asyncio as _asyncio
            from utils.email_service import send_birthday_reward_email
            _asyncio.create_task(send_birthday_reward_email(
                user["email"], user.get("name", ""), reward["name"]
            ))
        except Exception as e:
            logger.error(f"Failed to queue birthday email: {e}")

    return {
        "success": True,
        "message": f"🎉 {reward['name']} claimed! {reward['description']}",
        "reward": claim_record,
        "qr_code": qr_code,
        "added_to_wallet": reward["type"] in ["entry", "drink"]
    }


@router.get("/my-rewards")
async def get_my_birthday_rewards(authorization: str = Header(None)):
    """Get user's birthday rewards history"""
    user = get_current_user(authorization)
    user_id = user.get("user_id")
    
    rewards = await db.birthday_rewards.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("claimed_at", -1).to_list(50)
    
    return {"rewards": rewards}


@router.post("/redeem/{reward_claim_id}")
async def redeem_birthday_reward(reward_claim_id: str, authorization: str = Header(None)):
    """Redeem a claimed birthday reward at venue"""
    user = get_current_user(authorization)
    user_id = user.get("user_id")
    
    # Find the claim
    claim = await db.birthday_rewards.find_one({
        "id": reward_claim_id,
        "user_id": user_id
    })
    
    if not claim:
        raise HTTPException(status_code=404, detail="Reward not found")
    
    if claim.get("redeemed"):
        raise HTTPException(status_code=400, detail="Reward already redeemed")
    
    exp = claim.get("expires_at")
    if exp and isinstance(exp, datetime):
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > exp:
            raise HTTPException(status_code=400, detail="Reward has expired")
    
    # Mark birthday reward as redeemed
    await db.birthday_rewards.update_one(
        {"id": reward_claim_id},
        {"$set": {
            "redeemed": True,
            "redeemed_at": datetime.now(timezone.utc)
        }}
    )
    
    # Also mark the wallet pass as redeemed (one-time use)
    await db.wallet_passes.update_one(
        {"birthday_reward_id": reward_claim_id},
        {"$set": {
            "redeemed": True,
            "redeemed_at": datetime.now(timezone.utc),
            "status": "used"
        }}
    )
    
    return {
        "success": True,
        "message": "Reward redeemed successfully! Show this to staff."
    }



@router.get("/wallet-passes")
async def get_birthday_wallet_passes(authorization: str = Header(None)):
    """Get user's birthday reward passes in wallet"""
    user = get_current_user(authorization)
    user_id = user.get("user_id")
    
    passes = await db.wallet_passes.find(
        {"user_id": user_id, "type": "birthday_reward"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    return {"passes": passes}



@router.post("/admin/trigger-reminders")
async def trigger_birthday_reminders(authorization: Optional[str] = Header(None)):
    """
    Admin endpoint to manually trigger birthday reminder job.
    Useful for testing the scheduled job.
    """
    user = get_current_user(authorization)
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    
    # Only allow admin/staff to trigger
    if not user_record or user_record.get("role") not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from services.scheduled_jobs import _send_birthday_reminders_impl
    
    try:
        await _send_birthday_reminders_impl()
        
        # Get the latest job run result
        latest_run = await db.scheduled_job_runs.find_one(
            {"job_name": "birthday_reminders"},
            sort=[("completed_at", -1)]
        )
        
        if latest_run:
            latest_run.pop("_id", None)
            return {
                "success": True,
                "message": "Birthday reminder job executed successfully",
                "results": latest_run.get("results", {})
            }
        
        return {
            "success": True,
            "message": "Birthday reminder job executed"
        }
        
    except Exception as e:
        logger.error(f"Manual birthday reminder trigger failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/upcoming")
async def get_upcoming_birthdays(authorization: Optional[str] = Header(None), days: int = 7):
    """
    Get users with upcoming birthdays (for admin dashboard).
    Returns users whose birthdays fall within the next N days.
    """
    user = get_current_user(authorization)
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    
    # Only allow admin/staff
    if not user_record or user_record.get("role") not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    today = datetime.now(timezone.utc).date()
    upcoming = []
    
    # Get all users with DOB
    all_users = await db.users.find({
        "date_of_birth": {"$exists": True, "$ne": None}
    }, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "date_of_birth": 1}).to_list(1000)
    
    for u in all_users:
        dob = u.get("date_of_birth")
        if isinstance(dob, str):
            try:
                dob_date = datetime.strptime(dob, "%Y-%m-%d").date()
            except:
                continue
        elif isinstance(dob, datetime):
            dob_date = dob.date()
        else:
            continue
        
        # Check each of the next N days
        for delta in range(days + 1):
            check_date = today + timedelta(days=delta)
            if dob_date.month == check_date.month and dob_date.day == check_date.day:
                upcoming.append({
                    "user_id": u.get("user_id"),
                    "name": u.get("name"),
                    "email": u.get("email"),
                    "birthday": dob_date.strftime("%B %d"),
                    "days_until": delta
                })
                break
    
    # Sort by days until birthday
    upcoming.sort(key=lambda x: x["days_until"])
    
    return {
        "upcoming_birthdays": upcoming,
        "total": len(upcoming),
        "days_checked": days
    }
