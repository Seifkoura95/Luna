"""
Perks Verification & Redemption System
Handles: Entry verification, Guest tracking, Drink redemption, Discount application
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import logging

from database import db
from config import SUBSCRIPTION_TIERS
from utils.auth import get_current_user

router = APIRouter(prefix="/perks", tags=["Perks"])
logger = logging.getLogger(__name__)


# ====== PYDANTIC MODELS ======

class EntryVerifyRequest(BaseModel):
    user_id: str
    venue_id: str
    event_id: Optional[str] = None

class EntryLogRequest(BaseModel):
    user_id: str
    venue_id: str
    entry_type: str  # free_member, paid, guest, comp
    event_id: Optional[str] = None
    notes: Optional[str] = None

class GuestEntryRequest(BaseModel):
    member_user_id: str
    venue_id: str
    guest_name: Optional[str] = None

class DrinkRedeemRequest(BaseModel):
    user_id: str
    venue_id: str
    drink_type: str  # house_wine, house_beer, soft_drink, cocktail

class DiscountApplyRequest(BaseModel):
    user_id: str
    venue_id: str
    bill_amount: float
    items_description: Optional[str] = None


# ====== HELPER FUNCTIONS ======

async def get_user_tier(user_id: str) -> dict:
    """Get user's subscription tier and benefits"""
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check for active subscription
    subscription = await db.subscriptions.find_one({
        "user_id": user_id,
        "status": "active"
    })
    
    tier_id = subscription.get("tier_id") if subscription else user.get("tier", "bronze")
    tier_id = tier_id.lower() if tier_id else "bronze"
    
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS["bronze"])
    return {
        "user": user,
        "tier_id": tier_id,
        "tier": tier,
        "benefits": tier.get("benefits", {})
    }


def parse_time(time_str: str) -> int:
    """Convert '10pm' or '11pm' to hour (22 or 23)"""
    if time_str == "all_night":
        return 24  # Always valid
    time_str = time_str.lower().strip()
    if "pm" in time_str:
        hour = int(time_str.replace("pm", ""))
        return hour + 12 if hour != 12 else 12
    elif "am" in time_str:
        hour = int(time_str.replace("am", ""))
        return hour if hour != 12 else 0
    return 22  # Default to 10pm


def is_weeknight() -> bool:
    """Check if today is Sunday-Thursday (weeknight)"""
    day = datetime.now().weekday()
    return day in [0, 1, 2, 3, 6]  # Mon=0, Sun=6


def is_saturday() -> bool:
    """Check if today is Saturday"""
    return datetime.now().weekday() == 5


async def require_staff(request: Request) -> dict:
    """Verify staff/admin access"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_data = get_current_user(auth_header)
    user = await db.users.find_one({"user_id": user_data.get("user_id")})
    if not user or user.get("role") not in ["admin", "staff", "manager"]:
        raise HTTPException(status_code=403, detail="Staff access required")
    return user


# ====== 1. ENTRY VERIFICATION ======

@router.post("/entry/verify")
async def verify_entry(request: Request, data: EntryVerifyRequest):
    """
    Verify if a member is eligible for free entry.
    Called when staff scans member QR at venue entrance.
    """
    await require_staff(request)
    
    user_tier = await get_user_tier(data.user_id)
    user = user_tier["user"]
    tier = user_tier["tier"]
    benefits = user_tier["benefits"]
    tier_id = user_tier["tier_id"]
    
    current_hour = datetime.now().hour
    cutoff_time = benefits.get("free_entry_before_time", "10pm")
    cutoff_hour = parse_time(cutoff_time)
    
    # Check if it's a ticketed event
    is_ticketed = False
    if data.event_id:
        event = await db.events.find_one({"id": data.event_id})
        is_ticketed = event.get("is_ticketed", False) if event else False
    
    # Determine eligibility
    eligible = False
    reason = ""
    entry_type = "paid"
    
    if is_ticketed:
        reason = "Ticketed event - ticket required"
        entry_type = "ticketed"
    elif cutoff_time == "all_night" or benefits.get("free_entries_per_month", 0) == 999:
        eligible = True
        reason = f"Unlimited free entry ({tier['name']} member)"
        entry_type = "free_member"
    elif current_hour < cutoff_hour:
        eligible = True
        reason = f"Free entry before {cutoff_time} ({tier['name']} member)"
        entry_type = "free_member"
    else:
        reason = f"Entry fee applies (after {cutoff_time})"
        entry_type = "paid"
    
    # Check for skip the line
    skip_line = benefits.get("skip_the_line", False)
    
    # Check guest eligibility
    guest_allowed = benefits.get("guest_entry", 0) > 0
    guest_remaining = 0
    if guest_allowed:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        guest_used = await db.guest_entries.count_documents({
            "member_user_id": data.user_id,
            "entry_date": today
        })
        guest_remaining = benefits.get("guest_entry", 0) - guest_used
    
    return {
        "eligible_for_free_entry": eligible,
        "entry_type": entry_type,
        "reason": reason,
        "member": {
            "name": user.get("name", user.get("email", "Unknown")),
            "tier": tier["name"],
            "tier_color": tier["color"],
            "points_balance": user.get("points_balance", 0)
        },
        "skip_the_line": skip_line,
        "guest_entry": {
            "allowed": guest_allowed,
            "remaining_today": max(0, guest_remaining)
        },
        "benefits_summary": {
            "free_entry_before": cutoff_time,
            "comp_drink": benefits.get("complimentary_drink", False),
            "sky_lounge": benefits.get("sky_lounge_access", False)
        }
    }


@router.post("/entry/log")
async def log_entry(request: Request, data: EntryLogRequest):
    """Log a venue entry"""
    staff = await require_staff(request)
    
    entry = {
        "id": f"entry_{uuid.uuid4().hex[:8]}",
        "user_id": data.user_id,
        "venue_id": data.venue_id,
        "entry_type": data.entry_type,
        "event_id": data.event_id,
        "entry_time": datetime.now(timezone.utc).isoformat(),
        "entry_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "verified_by": staff.get("user_id"),
        "verified_by_name": staff.get("name", staff.get("email")),
        "notes": data.notes
    }
    
    await db.entry_logs.insert_one(entry)
    logger.info(f"Entry logged: {entry['id']} - {data.user_id} at {data.venue_id}")
    
    # Award points for check-in (10 base points)
    user_tier = await get_user_tier(data.user_id)
    multiplier = user_tier["tier"].get("points_multiplier", 1.0)
    points = int(10 * multiplier)
    
    await db.users.update_one(
        {"user_id": data.user_id},
        {"$inc": {"points_balance": points}}
    )
    
    return {
        "success": True,
        "entry": {k: v for k, v in entry.items() if k != "_id"},
        "points_awarded": points
    }


@router.get("/entry/history/{user_id}")
async def get_entry_history(request: Request, user_id: str, limit: int = 50):
    """Get entry history for a user"""
    await require_staff(request)
    
    entries = await db.entry_logs.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("entry_time", -1).to_list(limit)
    
    return {"entries": entries, "total": len(entries)}


# ====== 2. GUEST ENTRY ======

@router.post("/entry/guest")
async def log_guest_entry(request: Request, data: GuestEntryRequest):
    """Log a guest entry for a Gold member"""
    staff = await require_staff(request)
    
    # Verify member is Gold
    user_tier = await get_user_tier(data.member_user_id)
    benefits = user_tier["benefits"]
    guest_limit = benefits.get("guest_entry", 0)
    
    if guest_limit == 0:
        raise HTTPException(
            status_code=403, 
            detail=f"{user_tier['tier']['name']} members don't have guest entry privileges"
        )
    
    # Check if guest slot already used today
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.guest_entries.count_documents({
        "member_user_id": data.member_user_id,
        "entry_date": today
    })
    
    if existing >= guest_limit:
        raise HTTPException(
            status_code=400,
            detail=f"Guest entry already used today (limit: {guest_limit}/day)"
        )
    
    guest_entry = {
        "id": f"guest_{uuid.uuid4().hex[:8]}",
        "member_user_id": data.member_user_id,
        "member_name": user_tier["user"].get("name", "Unknown"),
        "guest_name": data.guest_name or "Guest",
        "venue_id": data.venue_id,
        "entry_date": today,
        "entry_time": datetime.now(timezone.utc).isoformat(),
        "verified_by": staff.get("user_id"),
        "verified_by_name": staff.get("name", staff.get("email"))
    }
    
    await db.guest_entries.insert_one(guest_entry)
    logger.info(f"Guest entry logged: {guest_entry['id']} for member {data.member_user_id}")
    
    return {
        "success": True,
        "guest_entry": {k: v for k, v in guest_entry.items() if k != "_id"},
        "remaining_today": guest_limit - existing - 1
    }


@router.get("/entry/guest/remaining/{user_id}")
async def get_guest_remaining(request: Request, user_id: str):
    """Check remaining guest slots for today"""
    user_tier = await get_user_tier(user_id)
    benefits = user_tier["benefits"]
    guest_limit = benefits.get("guest_entry", 0)
    
    if guest_limit == 0:
        return {"allowed": False, "remaining": 0, "limit": 0}
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    used = await db.guest_entries.count_documents({
        "member_user_id": user_id,
        "entry_date": today
    })
    
    return {
        "allowed": True,
        "remaining": max(0, guest_limit - used),
        "limit": guest_limit,
        "used_today": used
    }


@router.get("/entry/guest/history/{user_id}")
async def get_guest_history(request: Request, user_id: str, limit: int = 50):
    """Get guest entry history for a member"""
    await require_staff(request)
    
    entries = await db.guest_entries.find(
        {"member_user_id": user_id},
        {"_id": 0}
    ).sort("entry_time", -1).to_list(limit)
    
    return {"guest_entries": entries, "total": len(entries)}


# ====== 3. COMPLIMENTARY DRINKS ======

@router.get("/drinks/voucher/{user_id}")
async def get_drink_voucher(user_id: str, venue_id: Optional[str] = None):
    """Get user's complimentary drink voucher status"""
    user_tier = await get_user_tier(user_id)
    benefits = user_tier["benefits"]
    
    has_comp_drink = benefits.get("complimentary_drink", False)
    
    if not has_comp_drink:
        return {
            "eligible": False,
            "reason": f"{user_tier['tier']['name']} members don't have complimentary drinks",
            "upgrade_to": "Silver"
        }
    
    # Check Saturday exclusion for Silver
    excludes = benefits.get("complimentary_drink_excludes")
    if excludes == "Saturdays" and is_saturday():
        return {
            "eligible": False,
            "reason": "Complimentary drinks not available on Saturdays for Silver members",
            "available_on": "Sunday - Friday"
        }
    
    # Check if already redeemed today at this venue
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query = {"user_id": user_id, "redemption_date": today}
    if venue_id:
        query["venue_id"] = venue_id
    
    existing = await db.drink_redemptions.find_one(query)
    
    if existing:
        return {
            "eligible": False,
            "reason": f"Already redeemed at {existing.get('venue_id')} today",
            "redeemed_at": existing.get("redemption_time"),
            "drink_type": existing.get("drink_type")
        }
    
    return {
        "eligible": True,
        "tier": user_tier["tier"]["name"],
        "drink_options": ["house_wine", "house_beer", "soft_drink"],
        "valid_until": "End of night",
        "qr_code": f"LUNA-DRINK-{user_id}-{today}"
    }


@router.post("/drinks/redeem")
async def redeem_drink(request: Request, data: DrinkRedeemRequest):
    """Redeem a complimentary drink"""
    staff = await require_staff(request)
    
    user_tier = await get_user_tier(data.user_id)
    benefits = user_tier["benefits"]
    
    if not benefits.get("complimentary_drink", False):
        raise HTTPException(
            status_code=403,
            detail=f"{user_tier['tier']['name']} members don't have complimentary drinks"
        )
    
    # Check Saturday exclusion
    excludes = benefits.get("complimentary_drink_excludes")
    if excludes == "Saturdays" and is_saturday():
        raise HTTPException(
            status_code=403,
            detail="Complimentary drinks not available on Saturdays for Silver members"
        )
    
    # Check if already redeemed today at this venue
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    existing = await db.drink_redemptions.find_one({
        "user_id": data.user_id,
        "venue_id": data.venue_id,
        "redemption_date": today
    })
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Already redeemed at this venue today at {existing.get('redemption_time')}"
        )
    
    redemption = {
        "id": f"drink_{uuid.uuid4().hex[:8]}",
        "user_id": data.user_id,
        "user_name": user_tier["user"].get("name", "Unknown"),
        "user_tier": user_tier["tier"]["name"],
        "venue_id": data.venue_id,
        "drink_type": data.drink_type,
        "redemption_date": today,
        "redemption_time": datetime.now(timezone.utc).isoformat(),
        "redeemed_by": staff.get("user_id"),
        "redeemed_by_name": staff.get("name", staff.get("email"))
    }
    
    await db.drink_redemptions.insert_one(redemption)
    logger.info(f"Drink redeemed: {redemption['id']} - {data.drink_type} for {data.user_id}")
    
    return {
        "success": True,
        "redemption": {k: v for k, v in redemption.items() if k != "_id"},
        "message": f"Complimentary {data.drink_type.replace('_', ' ')} redeemed"
    }


@router.get("/drinks/history/{user_id}")
async def get_drink_history(request: Request, user_id: str, limit: int = 50):
    """Get drink redemption history for a user"""
    await require_staff(request)
    
    redemptions = await db.drink_redemptions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("redemption_time", -1).to_list(limit)
    
    return {"redemptions": redemptions, "total": len(redemptions)}


# ====== 4. RESTAURANT DISCOUNTS ======

@router.get("/discounts/eligibility/{user_id}")
async def check_discount_eligibility(user_id: str, venue_id: Optional[str] = None):
    """Check user's restaurant discount eligibility"""
    user_tier = await get_user_tier(user_id)
    benefits = user_tier["benefits"]
    tier = user_tier["tier"]
    
    discount = benefits.get("restaurant_discount", 0)
    discount_days = benefits.get("restaurant_discount_days", "weeknights")
    
    if discount == 0:
        return {
            "eligible": False,
            "discount_percent": 0,
            "reason": "No discount available for this tier"
        }
    
    # Check day restrictions
    if discount_days == "weeknights" and not is_weeknight():
        return {
            "eligible": False,
            "discount_percent": discount,
            "reason": f"{discount}% discount only available on weeknights (Sun-Thu)",
            "available_on": "Sunday - Thursday"
        }
    
    return {
        "eligible": True,
        "discount_percent": discount,
        "tier": tier["name"],
        "applies_to": "Food items only",
        "day_restriction": "Weeknights only" if discount_days == "weeknights" else "All days",
        "qr_code": f"LUNA-DISC-{user_id}-{discount}"
    }


@router.post("/discounts/apply")
async def apply_discount(request: Request, data: DiscountApplyRequest):
    """Apply and log a restaurant discount"""
    staff = await require_staff(request)
    
    user_tier = await get_user_tier(data.user_id)
    benefits = user_tier["benefits"]
    
    discount = benefits.get("restaurant_discount", 0)
    discount_days = benefits.get("restaurant_discount_days", "weeknights")
    
    if discount == 0:
        raise HTTPException(
            status_code=403,
            detail="No discount available for this tier"
        )
    
    # Check day restrictions
    if discount_days == "weeknights" and not is_weeknight():
        raise HTTPException(
            status_code=403,
            detail=f"{discount}% discount only available on weeknights (Sun-Thu)"
        )
    
    discount_amount = round(data.bill_amount * (discount / 100), 2)
    final_amount = round(data.bill_amount - discount_amount, 2)
    
    application = {
        "id": f"disc_{uuid.uuid4().hex[:8]}",
        "user_id": data.user_id,
        "user_name": user_tier["user"].get("name", "Unknown"),
        "user_tier": user_tier["tier"]["name"],
        "venue_id": data.venue_id,
        "bill_amount": data.bill_amount,
        "discount_percent": discount,
        "discount_amount": discount_amount,
        "final_amount": final_amount,
        "items_description": data.items_description,
        "applied_at": datetime.now(timezone.utc).isoformat(),
        "applied_by": staff.get("user_id"),
        "applied_by_name": staff.get("name", staff.get("email"))
    }
    
    await db.discount_applications.insert_one(application)
    
    # Award points on final amount
    multiplier = user_tier["tier"].get("points_multiplier", 1.0)
    points = int(final_amount * multiplier)
    
    await db.users.update_one(
        {"user_id": data.user_id},
        {"$inc": {"points_balance": points}}
    )
    
    logger.info(f"Discount applied: {application['id']} - ${discount_amount} off for {data.user_id}")
    
    return {
        "success": True,
        "application": {k: v for k, v in application.items() if k != "_id"},
        "points_awarded": points,
        "summary": {
            "original": f"${data.bill_amount:.2f}",
            "discount": f"-${discount_amount:.2f} ({discount}%)",
            "final": f"${final_amount:.2f}"
        }
    }


@router.get("/discounts/history/{user_id}")
async def get_discount_history(request: Request, user_id: str, limit: int = 50):
    """Get discount application history for a user"""
    await require_staff(request)
    
    applications = await db.discount_applications.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("applied_at", -1).to_list(limit)
    
    return {"applications": applications, "total": len(applications)}


# ====== 5. PERKS STATUS (USER VIEW) ======

@router.get("/status")
async def get_perks_status(request: Request):
    """Get all perk statuses for the current user"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_data = get_current_user(auth_header)
    user_id = user_data.get("user_id")
    
    user_tier = await get_user_tier(user_id)
    tier = user_tier["tier"]
    benefits = user_tier["benefits"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Check drink voucher
    drink_redeemed = await db.drink_redemptions.find_one({
        "user_id": user_id,
        "redemption_date": today
    })
    
    # Check guest usage
    guest_limit = benefits.get("guest_entry", 0)
    guest_used = 0
    if guest_limit > 0:
        guest_used = await db.guest_entries.count_documents({
            "member_user_id": user_id,
            "entry_date": today
        })
    
    # Check entries today
    entries_today = await db.entry_logs.count_documents({
        "user_id": user_id,
        "entry_date": today
    })
    
    return {
        "tier": {
            "id": user_tier["tier_id"],
            "name": tier["name"],
            "color": tier["color"]
        },
        "perks": {
            "free_entry": {
                "available": True,
                "before_time": benefits.get("free_entry_before_time", "10pm"),
                "unlimited": benefits.get("free_entries_per_month", 0) == 999
            },
            "skip_the_line": {
                "available": benefits.get("skip_the_line", False)
            },
            "comp_drink": {
                "available": benefits.get("complimentary_drink", False),
                "redeemed_today": drink_redeemed is not None,
                "redeemed_at": drink_redeemed.get("venue_id") if drink_redeemed else None,
                "excludes_saturday": benefits.get("complimentary_drink_excludes") == "Saturdays",
                "is_saturday": is_saturday()
            },
            "guest_entry": {
                "available": guest_limit > 0,
                "limit": guest_limit,
                "used_today": guest_used,
                "remaining_today": max(0, guest_limit - guest_used)
            },
            "restaurant_discount": {
                "percent": benefits.get("restaurant_discount", 0),
                "weeknights_only": benefits.get("restaurant_discount_days") == "weeknights",
                "available_today": benefits.get("restaurant_discount_days") == "all" or is_weeknight()
            },
            "sky_lounge": {
                "available": benefits.get("sky_lounge_access", False)
            },
            "priority_booking": {
                "available": benefits.get("priority_booking", False)
            },
            "vip_events": {
                "available": benefits.get("private_events_access", False)
            },
            "concierge": {
                "available": benefits.get("concierge_access", False),
                "whatsapp": benefits.get("whatsapp_concierge", False)
            }
        },
        "today_activity": {
            "entries": entries_today,
            "drinks_redeemed": 1 if drink_redeemed else 0,
            "guests_used": guest_used
        }
    }


# ====== 6. MEMBER SEARCH (STAFF) ======

@router.get("/member/search")
async def search_member(request: Request, q: str = ""):
    """Search for a member by name, email, or phone"""
    await require_staff(request)
    
    if not q or len(q) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
    
    query = {
        "$or": [
            {"email": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"user_id": q},
        ]
    }
    
    users = await db.users.find(query, {
        "_id": 0, "password": 0, "points_history": 0
    }).limit(10).to_list(10)
    
    results = []
    for u in users:
        tier_id = u.get("tier", "bronze").lower()
        tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
        results.append({
            "user_id": u.get("user_id"),
            "name": u.get("name", u.get("email", "Unknown")),
            "email": u.get("email"),
            "phone": u.get("phone", ""),
            "tier": tier.get("name", "Bronze"),
            "tier_color": tier.get("color", "#CD7F32"),
            "points_balance": u.get("points_balance", 0),
            "wallet_balance": u.get("wallet_balance", 0.0),
            "avatar": u.get("avatar"),
        })
    
    return {"members": results, "total": len(results)}


@router.get("/member/{user_id}/profile")
async def get_member_profile(request: Request, user_id: str):
    """Get full member profile for staff view"""
    await require_staff(request)
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Member not found")
    
    tier_id = user.get("tier", "bronze").lower()
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
    benefits = tier.get("benefits", {})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get today's activity
    entries_today = await db.entry_logs.count_documents({"user_id": user_id, "entry_date": today})
    drink_redeemed = await db.drink_redemptions.find_one({"user_id": user_id, "redemption_date": today})
    guest_limit = benefits.get("guest_entry", 0)
    guest_used = await db.guest_entries.count_documents({"member_user_id": user_id, "entry_date": today}) if guest_limit > 0 else 0
    
    return {
        "user_id": user.get("user_id"),
        "name": user.get("name", user.get("email", "Unknown")),
        "email": user.get("email"),
        "phone": user.get("phone", ""),
        "tier": tier.get("name", "Bronze"),
        "tier_id": tier_id,
        "tier_color": tier.get("color", "#CD7F32"),
        "points_balance": user.get("points_balance", 0),
        "wallet_balance": user.get("wallet_balance", 0.0),
        "benefits": benefits,
        "today": {
            "entries": entries_today,
            "drink_redeemed": drink_redeemed is not None,
            "guest_used": guest_used,
            "guest_remaining": max(0, guest_limit - guest_used),
            "guest_limit": guest_limit,
        }
    }


# ====== 7. ADMIN ENDPOINTS ======

@router.get("/admin/logs")
async def get_all_perk_logs(
    request: Request,
    log_type: Optional[str] = None,  # entry, guest, drink, discount
    venue_id: Optional[str] = None,
    date: Optional[str] = None,
    limit: int = 100
):
    """Get all perk logs for admin/dashboard"""
    await require_staff(request)
    
    result = {
        "entries": [],
        "guest_entries": [],
        "drink_redemptions": [],
        "discount_applications": []
    }
    
    query = {}
    if venue_id:
        query["venue_id"] = venue_id
    if date:
        query["$or"] = [
            {"entry_date": date},
            {"redemption_date": date}
        ]
    
    if not log_type or log_type == "entry":
        result["entries"] = await db.entry_logs.find(query, {"_id": 0}).sort("entry_time", -1).to_list(limit)
    
    if not log_type or log_type == "guest":
        result["guest_entries"] = await db.guest_entries.find(query, {"_id": 0}).sort("entry_time", -1).to_list(limit)
    
    if not log_type or log_type == "drink":
        result["drink_redemptions"] = await db.drink_redemptions.find(query, {"_id": 0}).sort("redemption_time", -1).to_list(limit)
    
    if not log_type or log_type == "discount":
        result["discount_applications"] = await db.discount_applications.find(query, {"_id": 0}).sort("applied_at", -1).to_list(limit)
    
    return result


@router.get("/admin/stats")
async def get_perk_stats(request: Request, days: int = 30):
    """Get perk usage statistics"""
    await require_staff(request)
    
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_str = cutoff.strftime("%Y-%m-%d")
    
    # Count various redemptions
    entries = await db.entry_logs.count_documents({"entry_date": {"$gte": cutoff_str}})
    free_entries = await db.entry_logs.count_documents({
        "entry_date": {"$gte": cutoff_str},
        "entry_type": "free_member"
    })
    guest_entries = await db.guest_entries.count_documents({"entry_date": {"$gte": cutoff_str}})
    drinks = await db.drink_redemptions.count_documents({"redemption_date": {"$gte": cutoff_str}})
    discounts = await db.discount_applications.count_documents({})
    
    # Get total discount value
    pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$discount_amount"}}}
    ]
    discount_total = await db.discount_applications.aggregate(pipeline).to_list(1)
    
    return {
        "period_days": days,
        "total_entries": entries,
        "free_member_entries": free_entries,
        "paid_entries": entries - free_entries,
        "guest_entries": guest_entries,
        "drinks_redeemed": drinks,
        "discounts_applied": discounts,
        "total_discount_value": discount_total[0]["total"] if discount_total else 0
    }
