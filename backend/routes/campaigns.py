"""
Push Notification Campaigns - Full CRUD for Lovable Dashboard Management
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum
import uuid
import logging

from database import db
from utils.auth import get_current_user

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])
logger = logging.getLogger(__name__)


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENDING = "sending"
    SENT = "sent"
    CANCELLED = "cancelled"


class CampaignType(str, Enum):
    PUSH = "push"
    EMAIL = "email"
    SMS = "sms"
    IN_APP = "in_app"


class TargetAudience(str, Enum):
    ALL = "all"
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    INACTIVE = "inactive"
    BIRTHDAY = "birthday"
    HIGH_SPENDERS = "high_spenders"
    NEW_USERS = "new_users"
    CUSTOM = "custom"


class CampaignCreate(BaseModel):
    name: str
    title: str
    body: str
    campaign_type: str = "push"
    target_audience: str = "all"
    target_venue: Optional[str] = None
    scheduled_at: Optional[str] = None  # ISO format
    deep_link: Optional[str] = None
    image_url: Optional[str] = None
    data: Optional[dict] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None
    campaign_type: Optional[str] = None
    target_audience: Optional[str] = None
    target_venue: Optional[str] = None
    scheduled_at: Optional[str] = None
    deep_link: Optional[str] = None
    image_url: Optional[str] = None
    data: Optional[dict] = None
    status: Optional[str] = None


async def require_admin(request: Request):
    """Helper to verify admin access"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_data = get_current_user(auth_header)
    user = await db.users.find_one({"user_id": user_data.get("user_id")})
    if not user or user.get("role") not in ["admin", "staff", "manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def get_target_users(target_audience: str, target_venue: Optional[str] = None) -> List[dict]:
    """Get users matching the target audience criteria"""
    query = {}
    
    if target_audience == "all":
        pass  # No filter
    elif target_audience in ["bronze", "silver", "gold"]:
        query["$or"] = [
            {"subscription_tier": target_audience},
            {"tier": target_audience}
        ]
    elif target_audience == "inactive":
        # Users who haven't been active in 30 days
        thirty_days_ago = datetime.now(timezone.utc).replace(day=datetime.now().day - 30)
        query["last_active"] = {"$lt": thirty_days_ago}
    elif target_audience == "birthday":
        # Users with birthday this month
        current_month = datetime.now().month
        query["birth_month"] = current_month
    elif target_audience == "high_spenders":
        query["total_spend"] = {"$gte": 500}
    elif target_audience == "new_users":
        seven_days_ago = datetime.now(timezone.utc).replace(day=datetime.now().day - 7)
        query["created_at"] = {"$gte": seven_days_ago}
    
    if target_venue:
        query["favorite_venue"] = target_venue
    
    users = await db.users.find(query, {"_id": 0, "user_id": 1, "email": 1, "name": 1, "push_token": 1}).to_list(10000)
    return users


# ====== CRUD ENDPOINTS ======

@router.get("")
async def list_campaigns(
    request: Request,
    status: Optional[str] = None,
    campaign_type: Optional[str] = None,
    limit: int = 50
):
    """List all campaigns with optional filtering"""
    await require_admin(request)
    
    query = {}
    if status:
        query["status"] = status
    if campaign_type:
        query["campaign_type"] = campaign_type
    
    campaigns = await db.campaigns.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    
    return {
        "campaigns": campaigns,
        "total": len(campaigns)
    }


# ====== TEMPLATES - Must be before /{campaign_id} ======

@router.get("/templates")
async def get_campaign_templates(request: Request):
    """Get pre-built campaign templates"""
    await require_admin(request)
    
    templates = [
        {
            "id": "weekend_special",
            "name": "Weekend Special",
            "title": "🎉 This Weekend at Luna!",
            "body": "Don't miss our exclusive weekend events. VIP entry available!",
            "target_audience": "all",
            "deep_link": "/events"
        },
        {
            "id": "happy_hour",
            "name": "Happy Hour Alert",
            "title": "🍸 Happy Hour Starting Now!",
            "body": "Join us for happy hour specials. 2-for-1 drinks until 8pm!",
            "target_audience": "all",
            "deep_link": "/venues"
        },
        {
            "id": "points_reminder",
            "name": "Points Expiring",
            "title": "⏰ Your Points Are Expiring!",
            "body": "You have points expiring soon. Redeem them before it's too late!",
            "target_audience": "bronze",
            "deep_link": "/wallet"
        },
        {
            "id": "vip_exclusive",
            "name": "VIP Exclusive Event",
            "title": "👑 Exclusive VIP Event",
            "body": "You're invited to an exclusive Gold member event this weekend.",
            "target_audience": "gold",
            "deep_link": "/events"
        },
        {
            "id": "win_back",
            "name": "We Miss You",
            "title": "We Miss You! 💜",
            "body": "It's been a while! Come back and enjoy 2x points on your next visit.",
            "target_audience": "inactive",
            "deep_link": "/venues"
        },
        {
            "id": "birthday",
            "name": "Birthday Celebration",
            "title": "🎂 Happy Birthday!",
            "body": "Celebrate your birthday with us! Free entry + birthday surprise waiting.",
            "target_audience": "birthday",
            "deep_link": "/profile"
        },
        {
            "id": "new_auction",
            "name": "New Auction Alert",
            "title": "🔥 Hot New Auction!",
            "body": "A new VIP booth auction just dropped. Place your bid now!",
            "target_audience": "silver",
            "deep_link": "/auctions"
        }
    ]
    
    return {"templates": templates}


@router.get("/{campaign_id}")
async def get_campaign(request: Request, campaign_id: str):
    """Get a single campaign by ID"""
    await require_admin(request)
    
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {"campaign": campaign}


@router.post("")
async def create_campaign(request: Request, campaign: CampaignCreate):
    """Create a new push notification campaign"""
    admin = await require_admin(request)
    
    # Get estimated audience size
    target_users = await get_target_users(campaign.target_audience, campaign.target_venue)
    
    campaign_data = {
        "id": f"campaign_{uuid.uuid4().hex[:8]}",
        "name": campaign.name,
        "title": campaign.title,
        "body": campaign.body,
        "campaign_type": campaign.campaign_type,
        "target_audience": campaign.target_audience,
        "target_venue": campaign.target_venue,
        "scheduled_at": campaign.scheduled_at,
        "deep_link": campaign.deep_link,
        "image_url": campaign.image_url,
        "data": campaign.data or {},
        "status": "scheduled" if campaign.scheduled_at else "draft",
        "estimated_reach": len(target_users),
        "sent_count": 0,
        "opened_count": 0,
        "clicked_count": 0,
        "created_by": admin.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.campaigns.insert_one(campaign_data)
    logger.info(f"Created campaign: {campaign_data['id']} - {campaign.name}")
    
    return {
        "success": True,
        "campaign": {k: v for k, v in campaign_data.items() if k != "_id"},
        "estimated_reach": len(target_users)
    }


@router.put("/{campaign_id}")
async def update_campaign(request: Request, campaign_id: str, campaign: CampaignUpdate):
    """Update an existing campaign"""
    await require_admin(request)
    
    existing = await db.campaigns.find_one({"id": campaign_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if existing.get("status") == "sent":
        raise HTTPException(status_code=400, detail="Cannot edit a sent campaign")
    
    update_data = {k: v for k, v in campaign.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    # Recalculate estimated reach if audience changed
    if "target_audience" in update_data or "target_venue" in update_data:
        target_users = await get_target_users(
            update_data.get("target_audience", existing.get("target_audience")),
            update_data.get("target_venue", existing.get("target_venue"))
        )
        update_data["estimated_reach"] = len(target_users)
    
    await db.campaigns.update_one({"id": campaign_id}, {"$set": update_data})
    
    updated = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    return {"success": True, "campaign": updated}


@router.delete("/{campaign_id}")
async def delete_campaign(request: Request, campaign_id: str):
    """Delete a campaign"""
    await require_admin(request)
    
    existing = await db.campaigns.find_one({"id": campaign_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if existing.get("status") == "sending":
        raise HTTPException(status_code=400, detail="Cannot delete a campaign that is currently sending")
    
    await db.campaigns.delete_one({"id": campaign_id})
    
    return {"success": True, "message": f"Campaign {campaign_id} deleted"}


@router.post("/{campaign_id}/send")
async def send_campaign(request: Request, campaign_id: str):
    """Immediately send a campaign"""
    await require_admin(request)
    
    campaign = await db.campaigns.find_one({"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.get("status") == "sent":
        raise HTTPException(status_code=400, detail="Campaign already sent")
    
    # Get target users
    target_users = await get_target_users(
        campaign.get("target_audience", "all"),
        campaign.get("target_venue")
    )
    
    # Update status to sending
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "sending",
            "send_started_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # In production, this would send actual push notifications
    # For now, we'll simulate sending
    sent_count = 0
    for user in target_users:
        if user.get("push_token"):
            # Record the notification
            await db.notification_logs.insert_one({
                "id": f"notif_{uuid.uuid4().hex[:8]}",
                "campaign_id": campaign_id,
                "user_id": user.get("user_id"),
                "title": campaign.get("title"),
                "body": campaign.get("body"),
                "status": "sent",
                "sent_at": datetime.now(timezone.utc).isoformat()
            })
            sent_count += 1
    
    # Update campaign as sent
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "sent",
            "sent_count": sent_count,
            "sent_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    logger.info(f"Campaign {campaign_id} sent to {sent_count} users")
    
    return {
        "success": True,
        "message": f"Campaign sent to {sent_count} users",
        "sent_count": sent_count,
        "total_targeted": len(target_users)
    }


@router.post("/{campaign_id}/duplicate")
async def duplicate_campaign(request: Request, campaign_id: str):
    """Duplicate a campaign as a new draft"""
    admin = await require_admin(request)
    
    original = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    new_campaign = {
        **original,
        "id": f"campaign_{uuid.uuid4().hex[:8]}",
        "name": f"{original['name']} (Copy)",
        "status": "draft",
        "sent_count": 0,
        "opened_count": 0,
        "clicked_count": 0,
        "created_by": admin.get("user_id"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "scheduled_at": None,
        "sent_at": None
    }
    
    await db.campaigns.insert_one(new_campaign)
    
    return {
        "success": True,
        "campaign": {k: v for k, v in new_campaign.items() if k != "_id"}
    }


@router.post("/{campaign_id}/cancel")
async def cancel_campaign(request: Request, campaign_id: str):
    """Cancel a scheduled campaign"""
    await require_admin(request)
    
    campaign = await db.campaigns.find_one({"id": campaign_id})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if campaign.get("status") not in ["draft", "scheduled"]:
        raise HTTPException(status_code=400, detail="Can only cancel draft or scheduled campaigns")
    
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Campaign cancelled"}


@router.get("/{campaign_id}/stats")
async def get_campaign_stats(request: Request, campaign_id: str):
    """Get detailed statistics for a campaign"""
    await require_admin(request)
    
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get notification logs for this campaign
    logs = await db.notification_logs.find({"campaign_id": campaign_id}).to_list(10000)
    
    sent = len([l for l in logs if l.get("status") == "sent"])
    opened = len([l for l in logs if l.get("opened_at")])
    clicked = len([l for l in logs if l.get("clicked_at")])
    
    return {
        "campaign_id": campaign_id,
        "status": campaign.get("status"),
        "estimated_reach": campaign.get("estimated_reach", 0),
        "sent_count": sent,
        "opened_count": opened,
        "clicked_count": clicked,
        "open_rate": (opened / sent * 100) if sent > 0 else 0,
        "click_rate": (clicked / sent * 100) if sent > 0 else 0,
        "sent_at": campaign.get("sent_at")
    }


# ====== AUDIENCE PREVIEW ======

@router.post("/preview-audience")
async def preview_audience(
    request: Request,
    target_audience: str = "all",
    target_venue: Optional[str] = None
):
    """Preview the estimated audience for targeting criteria"""
    await require_admin(request)
    
    users = await get_target_users(target_audience, target_venue)
    
    return {
        "estimated_reach": len(users),
        "audience_breakdown": {
            "with_push_token": len([u for u in users if u.get("push_token")]),
            "without_push_token": len([u for u in users if not u.get("push_token")])
        }
    }
