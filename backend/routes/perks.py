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



# ====== 8. QUICK AWARD — FAST POINTS FOR BUSY NIGHTS ======

class QuickAwardRequest(BaseModel):
    """Streamlined award: scan QR → enter $ → done"""
    user_id: str
    amount_spent: float
    venue_id: str
    category: str = "general"  # food, drinks, entry, booth, bottle_service, merchandise
    receipt_ref: Optional[str] = None  # SwiftPOS receipt/docket number

SPENDING_CATEGORIES = [
    {"id": "food", "label": "Food", "icon": "restaurant"},
    {"id": "drinks", "label": "Drinks", "icon": "wine"},
    {"id": "entry", "label": "Entry Fee", "icon": "enter"},
    {"id": "booth", "label": "Booth / Table", "icon": "people"},
    {"id": "bottle_service", "label": "Bottle Service", "icon": "wine"},
    {"id": "merchandise", "label": "Merchandise", "icon": "gift"},
    {"id": "general", "label": "Other", "icon": "card"},
]


@router.post("/quick-award")
async def quick_award_points(request: Request, data: QuickAwardRequest):
    """
    Fast points award: staff scans member QR → enters $ amount → points auto-calculated.
    Designed for speed during busy service. Logs full audit trail.
    """
    staff = await require_staff(request)

    if data.amount_spent <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than $0")
    if data.amount_spent > 50000:
        raise HTTPException(status_code=400, detail="Amount exceeds single-transaction limit ($50,000)")

    # Look up member
    member = await db.users.find_one({"user_id": data.user_id}, {"_id": 0, "password": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Calculate points with tier multiplier
    tier_id = member.get("tier", "bronze").lower()
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
    multiplier = tier.get("points_multiplier", 1.0)

    base_points = int(data.amount_spent)  # 1 point per $1
    bonus_points = int(base_points * (multiplier - 1))
    total_points = base_points + bonus_points

    # Credit points
    await db.users.update_one(
        {"user_id": data.user_id},
        {"$inc": {"points_balance": total_points}}
    )

    # Full audit trail
    txn_id = f"qa_{uuid.uuid4().hex[:8]}"
    txn = {
        "id": txn_id,
        "type": "quick_award",
        "user_id": data.user_id,
        "member_name": member.get("name", member.get("email", "")),
        "amount_spent": data.amount_spent,
        "venue_id": data.venue_id,
        "category": data.category,
        "receipt_ref": data.receipt_ref,
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "tier_id": tier_id,
        "staff_user_id": staff.get("user_id"),
        "staff_name": staff.get("name", staff.get("email", "")),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_transactions.insert_one(txn)

    # Also log to loyalty_transactions for member's history
    await db.loyalty_transactions.insert_one({
        "id": txn_id,
        "user_id": data.user_id,
        "type": "earn",
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "tier_id": tier_id,
        "amount_spent": data.amount_spent,
        "venue_id": data.venue_id,
        "category": data.category,
        "description": f"${data.amount_spent:.2f} spend ({data.category})",
        "awarded_by": staff.get("user_id"),
        "source": "staff_quick_award",
        "created_at": datetime.now(timezone.utc),
    })

    updated = await db.users.find_one({"user_id": data.user_id}, {"_id": 0, "points_balance": 1})

    return {
        "success": True,
        "transaction_id": txn_id,
        "member_name": member.get("name", member.get("email", "")),
        "amount_spent": data.amount_spent,
        "category": data.category,
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "tier": tier.get("name", "Bronze"),
        "new_balance": updated.get("points_balance", 0) if updated else 0,
    }


@router.get("/spending-categories")
async def get_spending_categories():
    """Return the list of spending categories for the staff award UI"""
    return {"categories": SPENDING_CATEGORIES}


# ====== 9. REWARD QR VALIDATION — Staff scans customer's reward QR ======

class ValidateRewardQRRequest(BaseModel):
    qr_code: str
    venue_id: str


@router.post("/validate-reward")
async def validate_reward_qr(request: Request, data: ValidateRewardQRRequest):
    """
    Staff scans a customer's reward redemption QR code.
    Validates it, marks as used, returns reward details.
    """
    staff = await require_staff(request)

    # Find the redemption by QR code
    redemption = await db.redemptions.find_one({"qr_code": data.qr_code})
    if not redemption:
        raise HTTPException(status_code=404, detail="Invalid QR code — no matching redemption found")

    if redemption.get("status") == "used":
        raise HTTPException(status_code=400, detail=f"Already redeemed at {redemption.get('used_at_venue', 'unknown')} on {str(redemption.get('used_at', ''))[:10]}")

    if redemption.get("status") == "expired":
        raise HTTPException(status_code=400, detail="This reward has expired")

    # Check expiry (handle naive datetimes stored by legacy writes)
    expires_at = redemption.get("expires_at")
    if expires_at and isinstance(expires_at, datetime):
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            await db.redemptions.update_one({"qr_code": data.qr_code}, {"$set": {"status": "expired"}})
            raise HTTPException(status_code=400, detail="This reward has expired")

    # Mark as used
    await db.redemptions.update_one(
        {"qr_code": data.qr_code},
        {"$set": {
            "status": "used",
            "used_at": datetime.now(timezone.utc).isoformat(),
            "used_at_venue": data.venue_id,
            "validated_by": staff.get("user_id"),
            "validated_by_name": staff.get("name", staff.get("email", "")),
        }}
    )

    # Get member info
    member = await db.users.find_one({"user_id": redemption.get("user_id")}, {"_id": 0, "name": 1, "email": 1, "tier": 1})

    return {
        "success": True,
        "valid": True,
        "reward_name": redemption.get("reward_name", "Reward"),
        "reward_description": redemption.get("reward_description", ""),
        "points_spent": redemption.get("points_spent", 0),
        "member_name": member.get("name", member.get("email", "")) if member else "Unknown",
        "member_tier": member.get("tier", "bronze"),
        "message": f"Reward validated: {redemption.get('reward_name', 'Reward')} for {member.get('name', 'member') if member else 'member'}",
    }


# ====== 10. STAFF TRANSACTION LOG ======

@router.get("/staff/transactions")
async def get_staff_transactions(
    request: Request,
    venue_id: Optional[str] = None,
    limit: int = 50,
):
    """Get staff transaction log (all quick awards, entries, redemptions at a venue)"""
    staff = await require_staff(request)

    query = {}
    if venue_id:
        query["venue_id"] = venue_id

    txns = await db.staff_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)

    return {"transactions": txns, "total": len(txns)}


@router.get("/staff/transactions/summary")
async def get_staff_transaction_summary(
    request: Request,
    venue_id: Optional[str] = None,
    period: str = "today",
):
    """Get summary stats for staff transactions (today / week / month)"""
    staff = await require_staff(request)

    now = datetime.now(timezone.utc)
    if period == "today":
        cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    elif period == "week":
        cutoff = (now - timedelta(days=7)).isoformat()
    elif period == "month":
        cutoff = (now - timedelta(days=30)).isoformat()
    else:
        cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    query: dict = {"created_at": {"$gte": cutoff}}
    if venue_id:
        query["venue_id"] = venue_id

    txns = await db.staff_transactions.find(query, {"_id": 0}).to_list(500)

    total_revenue = sum(t.get("amount_spent", 0) for t in txns)
    total_points = sum(t.get("total_points", 0) for t in txns)
    unique_members = len(set(t.get("user_id") for t in txns))

    # Group by category
    by_category: dict = {}
    for t in txns:
        cat = t.get("category", "general")
        if cat not in by_category:
            by_category[cat] = {"count": 0, "revenue": 0, "points": 0}
        by_category[cat]["count"] += 1
        by_category[cat]["revenue"] += t.get("amount_spent", 0)
        by_category[cat]["points"] += t.get("total_points", 0)

    # Group by staff
    by_staff: dict = {}
    for t in txns:
        sid = t.get("staff_user_id", "unknown")
        sname = t.get("staff_name", "Unknown")
        if sid not in by_staff:
            by_staff[sid] = {"name": sname, "count": 0, "revenue": 0}
        by_staff[sid]["count"] += 1
        by_staff[sid]["revenue"] += t.get("amount_spent", 0)

    return {
        "period": period,
        "total_transactions": len(txns),
        "total_revenue": round(total_revenue, 2),
        "total_points_awarded": total_points,
        "unique_members_served": unique_members,
        "by_category": by_category,
        "by_staff": list(by_staff.values()),
    }


# ====== 11. SWIFTPOS INTEGRATION READINESS ======

class SwiftPOSSaleWebhook(BaseModel):
    """
    Payload expected from SwiftPOS POS API or middleware webhook.
    When a sale completes at the POS, this data is sent to our API
    to auto-award loyalty points without staff intervention.
    """
    terminal_id: str
    receipt_number: str
    member_key: Optional[str] = None  # SwiftPOS member number (if scanned)
    member_email: Optional[str] = None  # Alternative lookup
    venue_id: str
    total_amount: float
    items: Optional[List[dict]] = None  # [{name, qty, price, category}]
    payment_method: Optional[str] = None  # cash, card, etc.
    timestamp: Optional[str] = None


@router.post("/swiftpos/sale")
async def handle_swiftpos_sale(request: Request, data: SwiftPOSSaleWebhook):
    """
    SwiftPOS Sale Webhook — auto-awards points when a sale is completed at the POS.
    
    Integration options:
    1. SwiftPOS POS API (port 33300) → middleware → this endpoint
    2. SwiftPOS Web API → direct POST to this endpoint  
    3. Manual trigger from SwiftPOS Back Office via HTTP call
    
    The endpoint looks up the member by member_key or email,
    calculates tier-adjusted points, and credits them immediately.
    """
    # Authenticate the webhook (in production, use API key or IP whitelist)
    # For now, require staff auth header OR a special webhook key
    auth_header = request.headers.get("Authorization")
    webhook_key = request.headers.get("X-SwiftPOS-Key")

    if webhook_key:
        # Validate webhook key (stored in env)
        import os
        expected_key = os.environ.get("SWIFTPOS_WEBHOOK_KEY", "")
        if not expected_key or webhook_key != expected_key:
            raise HTTPException(status_code=401, detail="Invalid webhook key")
    elif auth_header:
        await require_staff(request)
    else:
        raise HTTPException(status_code=401, detail="Authentication required (staff token or X-SwiftPOS-Key header)")

    # Find the member
    member = None
    if data.member_key:
        member = await db.users.find_one(
            {"swiftpos_member_key": data.member_key},
            {"_id": 0, "password": 0}
        )
    if not member and data.member_email:
        member = await db.users.find_one(
            {"email": data.member_email.lower().strip()},
            {"_id": 0, "password": 0}
        )

    if not member:
        # Log the unmatched sale for later reconciliation
        await db.swiftpos_unmatched_sales.insert_one({
            "terminal_id": data.terminal_id,
            "receipt_number": data.receipt_number,
            "member_key": data.member_key,
            "member_email": data.member_email,
            "venue_id": data.venue_id,
            "total_amount": data.total_amount,
            "status": "unmatched",
            "received_at": datetime.now(timezone.utc).isoformat(),
        })
        return {
            "success": False,
            "matched": False,
            "message": "Member not found — sale logged for reconciliation",
            "receipt_number": data.receipt_number,
        }

    # Calculate points
    tier_id = member.get("tier", "bronze").lower()
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
    multiplier = tier.get("points_multiplier", 1.0)

    base_points = int(data.total_amount)
    bonus_points = int(base_points * (multiplier - 1))
    total_points = base_points + bonus_points

    # Credit points
    await db.users.update_one(
        {"user_id": member["user_id"]},
        {"$inc": {"points_balance": total_points}}
    )

    # Audit trail
    txn_id = f"spos_{uuid.uuid4().hex[:8]}"
    txn = {
        "id": txn_id,
        "type": "swiftpos_sale",
        "user_id": member["user_id"],
        "member_name": member.get("name", member.get("email", "")),
        "terminal_id": data.terminal_id,
        "receipt_number": data.receipt_number,
        "amount_spent": data.total_amount,
        "venue_id": data.venue_id,
        "payment_method": data.payment_method,
        "base_points": base_points,
        "bonus_points": bonus_points,
        "total_points": total_points,
        "multiplier": multiplier,
        "tier_id": tier_id,
        "items": data.items,
        "source": "swiftpos_webhook",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.staff_transactions.insert_one(txn)
    await db.loyalty_transactions.insert_one({
        **{k: v for k, v in txn.items() if k != "_id"},
        "description": f"POS sale ${data.total_amount:.2f} (receipt {data.receipt_number})",
        "created_at": datetime.now(timezone.utc),
    })

    updated = await db.users.find_one({"user_id": member["user_id"]}, {"_id": 0, "points_balance": 1})

    return {
        "success": True,
        "matched": True,
        "transaction_id": txn_id,
        "member_name": member.get("name", ""),
        "receipt_number": data.receipt_number,
        "amount": data.total_amount,
        "total_points": total_points,
        "multiplier": multiplier,
        "new_balance": updated.get("points_balance", 0) if updated else 0,
    }


@router.get("/swiftpos/unmatched")
async def get_unmatched_sales(request: Request, limit: int = 50):
    """Get sales that couldn't be matched to a Luna member (for manual reconciliation)"""
    await require_staff(request)
    sales = await db.swiftpos_unmatched_sales.find(
        {"status": "unmatched"}, {"_id": 0}
    ).sort("received_at", -1).limit(limit).to_list(limit)
    return {"sales": sales, "total": len(sales)}


@router.post("/swiftpos/match/{receipt_number}")
async def match_swiftpos_sale(request: Request, receipt_number: str, user_id: str):
    """Manually match an unmatched SwiftPOS sale to a Luna member"""
    staff = await require_staff(request)

    sale = await db.swiftpos_unmatched_sales.find_one(
        {"receipt_number": receipt_number, "status": "unmatched"}
    )
    if not sale:
        raise HTTPException(status_code=404, detail="Unmatched sale not found")

    member = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password": 0})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Award points
    tier_id = member.get("tier", "bronze").lower()
    tier = SUBSCRIPTION_TIERS.get(tier_id, SUBSCRIPTION_TIERS.get("bronze", {}))
    multiplier = tier.get("points_multiplier", 1.0)
    amount = sale.get("total_amount", 0)
    base_points = int(amount)
    total_points = int(base_points * multiplier)

    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"points_balance": total_points}}
    )

    # Mark as matched
    await db.swiftpos_unmatched_sales.update_one(
        {"receipt_number": receipt_number},
        {"$set": {
            "status": "matched",
            "matched_user_id": user_id,
            "matched_by": staff.get("user_id"),
            "matched_at": datetime.now(timezone.utc).isoformat(),
            "points_awarded": total_points,
        }}
    )

    return {
        "success": True,
        "message": f"Matched receipt {receipt_number} to {member.get('name', 'member')}. {total_points} points awarded.",
        "total_points": total_points,
    }
