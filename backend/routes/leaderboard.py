"""
Leaderboard Routes - Rankings, stats, and point-earning strategies
"""
from fastapi import APIRouter, Header, HTTPException
from datetime import datetime, timezone, timedelta
from typing import Optional, List
import logging

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])
logger = logging.getLogger(__name__)


# Point-earning strategies and tips
POINT_STRATEGIES = [
    {
        "id": "weekend_combo",
        "title": "Weekend Warrior Combo",
        "description": "Visit any venue on Friday + Saturday = 150 bonus points",
        "potential_points": 150,
        "difficulty": "easy",
        "icon": "calendar",
        "category": "missions",
        "tip": "Check in at different venues each night for variety bonuses"
    },
    {
        "id": "auction_snipe",
        "title": "Auction Snipe Strategy",
        "description": "Win auctions in the last 30 seconds for best value. Use saved points to bid on VIP experiences",
        "potential_points": 500,
        "difficulty": "medium",
        "icon": "flame",
        "category": "auctions",
        "tip": "Set a max bid and wait until final moments to place it"
    },
    {
        "id": "referral_chain",
        "title": "Referral Chain",
        "description": "Refer 5 friends who each spend $50+ = 750 points total",
        "potential_points": 750,
        "difficulty": "medium",
        "icon": "people",
        "category": "referrals",
        "tip": "Share your code before big events when friends are planning nights out"
    },
    {
        "id": "birthday_stack",
        "title": "Birthday Point Stack",
        "description": "Claim all birthday rewards + visit during birthday week with 2x multiplier",
        "potential_points": 500,
        "difficulty": "easy",
        "icon": "gift",
        "category": "birthday",
        "tip": "Make sure your birthday is set in profile to unlock these rewards"
    },
    {
        "id": "mission_sweep",
        "title": "Mission Sweep",
        "description": "Complete all 8 active missions in one week",
        "potential_points": 690,
        "difficulty": "hard",
        "icon": "trophy",
        "category": "missions",
        "tip": "Review missions on Monday and plan your week around completing them all"
    },
    {
        "id": "tier_upgrade",
        "title": "Tier Upgrade Bonus",
        "description": "Upgrade to Eclipse/Aurora tier for permanent point multipliers (1.5x - 2x)",
        "potential_points": "Ongoing 50-100% bonus",
        "difficulty": "medium",
        "icon": "trending-up",
        "category": "subscription",
        "tip": "Higher tiers pay for themselves if you visit 2+ times per month"
    },
    {
        "id": "early_bird",
        "title": "Early Bird Check-in",
        "description": "Check in before 10PM for bonus points at participating venues",
        "potential_points": 50,
        "difficulty": "easy",
        "icon": "time",
        "category": "check-in",
        "tip": "Arrive early, get your points, then enjoy skip-the-line benefits later"
    },
    {
        "id": "social_boost",
        "title": "Social Media Boost",
        "description": "Tag venue on Instagram + Leave a review = 75 combined points",
        "potential_points": 75,
        "difficulty": "easy",
        "icon": "share-social",
        "category": "missions",
        "tip": "Take a great photo early in the night when you look your best!"
    },
    {
        "id": "crew_bonus",
        "title": "Crew Night Bonus",
        "description": "Organize a crew of 4+ friends = Squad bonus points for everyone",
        "potential_points": 100,
        "difficulty": "medium",
        "icon": "people-circle",
        "category": "social",
        "tip": "Use the Crew Plan feature to coordinate and all check in together"
    },
    {
        "id": "vip_table_points",
        "title": "VIP Table Points",
        "description": "Book a VIP table = Points on minimum spend + booking bonus",
        "potential_points": 300,
        "difficulty": "medium",
        "icon": "wine",
        "category": "bookings",
        "tip": "Split with friends to reduce cost while everyone earns points"
    }
]


@router.get("")
async def get_leaderboard(
    period: str = "all_time",
    category: str = "points",
    limit: int = 50,
    authorization: str = Header(None)
):
    """
    Get the leaderboard rankings
    
    period: all_time, monthly, weekly
    category: points, visits, spend
    """
    user = get_current_user(authorization)
    current_user_id = user.get("user_id")
    
    # Build date filter
    date_filter = {}
    now = datetime.now(timezone.utc)
    
    if period == "weekly":
        start_date = now - timedelta(days=7)
        date_filter = {"last_visit": {"$gte": start_date}}
    elif period == "monthly":
        start_date = now - timedelta(days=30)
        date_filter = {"last_visit": {"$gte": start_date}}
    
    # Determine sort field
    sort_field = "points_balance"
    if category == "visits":
        sort_field = "total_visits"
    elif category == "spend":
        sort_field = "total_spend"
    
    # Get top users
    pipeline = [
        {"$match": {"role": {"$ne": "admin"}, **date_filter}},
        {"$sort": {sort_field: -1}},
        {"$limit": limit},
        {"$project": {
            "_id": 0,
            "user_id": 1,
            "name": 1,
            "picture": 1,
            "tier": 1,
            "subscription_tier": 1,
            "points_balance": 1,
            "total_visits": 1,
            "total_spend": 1
        }}
    ]
    
    leaders = await db.users.aggregate(pipeline).to_list(limit)
    
    # Add rank to each user
    for i, leader in enumerate(leaders):
        leader["rank"] = i + 1
        leader["is_current_user"] = leader.get("user_id") == current_user_id
        # Mask name for privacy (show first name + last initial)
        name = leader.get("name", "Anonymous")
        parts = name.split()
        if len(parts) > 1:
            leader["display_name"] = f"{parts[0]} {parts[-1][0]}."
        else:
            leader["display_name"] = parts[0] if parts else "Anonymous"
    
    # Get current user's rank if not in top
    current_user_rank = None
    current_user_data = None
    
    user_in_top = any(l.get("is_current_user") for l in leaders)
    
    if not user_in_top:
        # Count users with higher score
        current_user_record = await db.users.find_one({"user_id": current_user_id})
        if current_user_record:
            current_score = current_user_record.get(sort_field, 0)
            rank = await db.users.count_documents({
                sort_field: {"$gt": current_score},
                "role": {"$ne": "admin"}
            }) + 1
            
            current_user_rank = rank
            current_user_data = {
                "user_id": current_user_id,
                "name": current_user_record.get("name"),
                "display_name": current_user_record.get("name", "You"),
                "picture": current_user_record.get("picture"),
                "tier": current_user_record.get("tier"),
                "subscription_tier": current_user_record.get("subscription_tier"),
                "points_balance": current_user_record.get("points_balance", 0),
                "total_visits": current_user_record.get("total_visits", 0),
                "total_spend": current_user_record.get("total_spend", 0),
                "rank": rank,
                "is_current_user": True
            }
    
    # Calculate gap to first place
    gap_to_first = 0
    first_place_score = 0
    current_user_score = 0
    
    if leaders:
        first_place_score = leaders[0].get(sort_field, 0)
    
    current_record = await db.users.find_one({"user_id": current_user_id})
    if current_record:
        current_user_score = current_record.get(sort_field, 0)
        gap_to_first = first_place_score - current_user_score
    
    # Get total participants
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    
    return {
        "period": period,
        "category": category,
        "leaders": leaders,
        "current_user": current_user_data if not user_in_top else None,
        "current_user_rank": current_user_rank,
        "gap_to_first": max(0, gap_to_first),
        "first_place_score": first_place_score,
        "current_user_score": current_user_score,
        "total_participants": total_users,
        "sort_field": sort_field
    }


@router.get("/my-stats")
async def get_my_stats(authorization: str = Header(None)):
    """Get detailed stats for current user"""
    user = get_current_user(authorization)
    user_id = user.get("user_id")
    
    # Get user record
    user_record = await db.users.find_one({"user_id": user_id})
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get rankings in different categories
    points_rank = await db.users.count_documents({
        "points_balance": {"$gt": user_record.get("points_balance", 0)},
        "role": {"$ne": "admin"}
    }) + 1
    
    visits_rank = await db.users.count_documents({
        "total_visits": {"$gt": user_record.get("total_visits", 0)},
        "role": {"$ne": "admin"}
    }) + 1
    
    spend_rank = await db.users.count_documents({
        "total_spend": {"$gt": user_record.get("total_spend", 0)},
        "role": {"$ne": "admin"}
    }) + 1
    
    total_users = await db.users.count_documents({"role": {"$ne": "admin"}})
    
    # Get recent activity
    recent_points = await db.points_transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Calculate percentile
    points_percentile = round((1 - (points_rank / total_users)) * 100, 1) if total_users > 0 else 0
    
    return {
        "points_balance": user_record.get("points_balance", 0),
        "total_visits": user_record.get("total_visits", 0),
        "total_spend": user_record.get("total_spend", 0),
        "rankings": {
            "points": {"rank": points_rank, "total": total_users},
            "visits": {"rank": visits_rank, "total": total_users},
            "spend": {"rank": spend_rank, "total": total_users}
        },
        "percentile": points_percentile,
        "tier": user_record.get("tier"),
        "subscription_tier": user_record.get("subscription_tier"),
        "recent_points": recent_points
    }


@router.get("/strategies")
async def get_point_strategies(authorization: str = Header(None)):
    """Get point-earning strategies and tips"""
    user = get_current_user(authorization)
    user_id = user.get("user_id")
    
    # Get user's current status to personalize recommendations
    user_record = await db.users.find_one({"user_id": user_id})
    
    strategies = []
    for strategy in POINT_STRATEGIES:
        s = strategy.copy()
        
        # Add personalized relevance
        if user_record:
            # Highlight birthday strategy if birthday is coming up
            if strategy["category"] == "birthday" and user_record.get("date_of_birth"):
                s["highlighted"] = True
                s["highlight_reason"] = "Your birthday rewards are waiting!"
            
            # Highlight tier upgrade if on free tier
            if strategy["category"] == "subscription" and not user_record.get("subscription_tier"):
                s["highlighted"] = True
                s["highlight_reason"] = "Upgrade for permanent point boosts"
            
            # Highlight referral if they haven't referred anyone
            if strategy["category"] == "referrals":
                referral_count = await db.referrals.count_documents({"referrer_id": user_id})
                if referral_count == 0:
                    s["highlighted"] = True
                    s["highlight_reason"] = "You haven't used your referral code yet!"
        
        strategies.append(s)
    
    # Sort highlighted first
    strategies.sort(key=lambda x: (not x.get("highlighted", False), x.get("difficulty") == "hard"))
    
    return {
        "strategies": strategies,
        "quick_wins": [s for s in strategies if s.get("difficulty") == "easy"][:3],
        "high_value": [s for s in strategies if isinstance(s.get("potential_points"), int) and s["potential_points"] >= 300][:3]
    }


@router.get("/top-earners")
async def get_top_earners_this_week(authorization: str = Header(None)):
    """Get users who earned the most points this week"""
    user = get_current_user(authorization)
    
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}, "amount": {"$gt": 0}}},
        {"$group": {
            "_id": "$user_id",
            "points_earned": {"$sum": "$amount"},
            "transactions": {"$sum": 1}
        }},
        {"$sort": {"points_earned": -1}},
        {"$limit": 10}
    ]
    
    top_earners = await db.points_transactions.aggregate(pipeline).to_list(10)
    
    # Enrich with user data
    for earner in top_earners:
        user_record = await db.users.find_one({"user_id": earner["_id"]})
        if user_record:
            name = user_record.get("name", "Anonymous")
            parts = name.split()
            earner["display_name"] = f"{parts[0]} {parts[-1][0]}." if len(parts) > 1 else name
            earner["tier"] = user_record.get("subscription_tier") or user_record.get("tier")
        earner["user_id"] = earner.pop("_id")
    
    return {"top_earners": top_earners, "period": "This Week"}



@router.post("/seed-sample-users")
async def seed_sample_leaderboard_users():
    """Seed sample users for leaderboard demonstration"""
    import random
    
    sample_names = [
        "Emma Thompson", "Liam Wilson", "Olivia Chen", "Noah Martinez",
        "Ava Johnson", "Ethan Brown", "Sophia Davis", "Mason Garcia",
        "Isabella Lee", "William Anderson", "Mia Taylor", "James Thomas",
        "Charlotte White", "Benjamin Harris", "Amelia Martin", "Lucas Jackson",
        "Harper Robinson", "Henry Clark", "Evelyn Lewis", "Alexander Walker",
        "Abigail Hall", "Sebastian Young", "Emily King", "Jack Wright",
        "Ella Scott", "Owen Green", "Scarlett Baker", "Daniel Adams",
        "Grace Nelson", "Matthew Hill", "Chloe Campbell", "Aiden Mitchell",
        "Lily Roberts", "Samuel Turner", "Aria Phillips", "Joseph Evans",
        "Zoey Collins", "David Edwards", "Penelope Stewart", "Carter Sanchez"
    ]
    
    subscription_tiers = [None, None, None, "lunar", "lunar", "eclipse", "eclipse", "aurora"]
    tiers = ["bronze", "bronze", "bronze", "silver", "silver", "gold", "platinum"]
    
    created_count = 0
    
    for i, name in enumerate(sample_names):
        user_id = f"sample_user_{i+1}"
        
        # Check if already exists
        existing = await db.users.find_one({"user_id": user_id})
        if existing:
            continue
        
        # Generate random stats
        points = random.randint(500, 15000)
        visits = random.randint(3, 50)
        spend = random.randint(100, 3000)
        
        # Higher ranks for some users
        if i < 3:
            points = random.randint(12000, 18000)
            visits = random.randint(30, 60)
            spend = random.randint(2000, 5000)
        elif i < 8:
            points = random.randint(8000, 12000)
            visits = random.randint(20, 40)
            spend = random.randint(1000, 2500)
        
        user_doc = {
            "user_id": user_id,
            "email": f"{name.lower().replace(' ', '.')}@example.com",
            "name": name,
            "role": "user",
            "tier": random.choice(tiers),
            "subscription_tier": random.choice(subscription_tiers),
            "points_balance": points,
            "total_visits": visits,
            "total_spend": spend,
            "created_at": datetime.now(timezone.utc),
            "last_visit": datetime.now(timezone.utc) - timedelta(days=random.randint(0, 14))
        }
        
        await db.users.insert_one(user_doc)
        created_count += 1
    
    return {
        "success": True,
        "message": f"Created {created_count} sample users for leaderboard",
        "total_sample_users": len(sample_names)
    }
