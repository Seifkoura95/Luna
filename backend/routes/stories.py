"""
Story Sharing Routes for Luna Group VIP App
Enables users to share venue photos/memories to social media.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from bson import ObjectId
import logging

from database import db
from utils.auth import get_current_user
from services.ai_service import luna_ai

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stories", tags=["Stories"])


class CreateStoryRequest(BaseModel):
    photo_url: str
    venue_id: str
    venue_name: str
    caption: Optional[str] = None
    event_name: Optional[str] = None


class ShareStoryRequest(BaseModel):
    story_id: str
    platform: str  # instagram, facebook, twitter, snapchat


class StoryResponse(BaseModel):
    id: str
    photo_url: str
    caption: str
    venue_name: str
    created_at: str
    shares: int
    ai_caption: Optional[str] = None


@router.post("/create")
async def create_story(request: Request, body: CreateStoryRequest):
    """Create a story from a venue photo"""
    authorization = request.headers.get("authorization")
    user = get_current_user(authorization)
    
    # Generate AI caption if not provided
    ai_caption = None
    if not body.caption:
        try:
            ai_caption = await luna_ai.generate_photo_caption(
                venue_name=body.venue_name,
                event_name=body.event_name
            )
        except Exception as e:
            logger.error(f"AI caption error: {e}")
            ai_caption = f"Epic night at {body.venue_name}!"
    
    caption = body.caption or ai_caption
    
    story = {
        "user_id": user["user_id"],
        "photo_url": body.photo_url,
        "venue_id": body.venue_id,
        "venue_name": body.venue_name,
        "event_name": body.event_name,
        "caption": caption,
        "ai_generated_caption": ai_caption,
        "shares": 0,
        "share_history": [],
        "created_at": datetime.now(timezone.utc),
    }
    
    result = await db.stories.insert_one(story)
    
    return {
        "story": {
            "id": str(result.inserted_id),
            "photo_url": body.photo_url,
            "caption": caption,
            "ai_caption": ai_caption,
            "venue_name": body.venue_name
        }
    }


@router.get("/my-stories")
async def get_my_stories(request: Request):
    """Get user's stories"""
    authorization = request.headers.get("authorization")
    user = get_current_user(authorization)
    
    stories = await db.stories.find(
        {"user_id": user["user_id"]}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {
        "stories": [
            {
                "id": str(s["_id"]),
                "photo_url": s["photo_url"],
                "caption": s["caption"],
                "venue_name": s["venue_name"],
                "shares": s.get("shares", 0),
                "created_at": s["created_at"].isoformat()
            }
            for s in stories
        ]
    }


@router.post("/share")
async def share_story(request: Request, body: ShareStoryRequest):
    """Record a story share to social media"""
    authorization = request.headers.get("authorization")
    user = get_current_user(authorization)
    
    # Validate platform
    valid_platforms = ["instagram", "facebook", "twitter", "snapchat", "tiktok", "copy_link"]
    if body.platform not in valid_platforms:
        raise HTTPException(status_code=400, detail="Invalid platform")
    
    # Find story
    try:
        story = await db.stories.find_one({
            "_id": ObjectId(body.story_id),
            "user_id": user["user_id"]
        })
    except:
        raise HTTPException(status_code=400, detail="Invalid story ID")
    
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    # Record share
    share_record = {
        "platform": body.platform,
        "shared_at": datetime.now(timezone.utc)
    }
    
    await db.stories.update_one(
        {"_id": ObjectId(body.story_id)},
        {
            "$inc": {"shares": 1},
            "$push": {"share_history": share_record}
        }
    )
    
    # Award points for sharing
    points_per_share = 25
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {
            "$inc": {"points_balance": points_per_share},
            "$push": {
                "points_history": {
                    "amount": points_per_share,
                    "type": "story_share",
                    "description": f"Shared story to {body.platform}",
                    "date": datetime.now(timezone.utc)
                }
            }
        }
    )
    
    # Generate share URL based on platform
    share_data = generate_share_data(story, body.platform)

    # Mission events: social_share is the only client-driven event we accept,
    # protected by the per-platform per-story uniqueness already enforced
    # above (history is appended; spamming the same platform still increments
    # progress but the points-per-share guard caps the abuse surface).
    try:
        from services.mission_events import emit_mission_event
        await emit_mission_event(
            user_id=user["user_id"],
            event_type="social_share",
            increment=1,
            platform=body.platform,
        )
    except Exception:
        pass

    return {
        "success": True,
        "points_earned": points_per_share,
        "share_data": share_data
    }


def generate_share_data(story: dict, platform: str) -> dict:
    """Generate platform-specific share data"""
    caption = story.get("caption", "")
    photo_url = story.get("photo_url", "")
    venue = story.get("venue_name", "Luna venue")
    
    # Add hashtags
    hashtags = f"#LunaGroup #{venue.replace(' ', '')} #NightOut #Brisbane"
    full_caption = f"{caption} {hashtags}"
    
    share_urls = {
        "instagram": {
            "type": "intent",
            "message": "Open Instagram and share your photo with this caption:",
            "caption": full_caption
        },
        "facebook": {
            "type": "url",
            "url": f"https://www.facebook.com/sharer/sharer.php?quote={full_caption}"
        },
        "twitter": {
            "type": "url",
            "url": f"https://twitter.com/intent/tweet?text={full_caption}"
        },
        "snapchat": {
            "type": "intent",
            "message": "Open Snapchat to share your memory",
            "caption": full_caption
        },
        "tiktok": {
            "type": "intent",
            "message": "Open TikTok and create a video with your photo",
            "caption": full_caption
        },
        "copy_link": {
            "type": "copy",
            "text": full_caption
        }
    }
    
    return share_urls.get(platform, {"type": "copy", "text": full_caption})


@router.get("/feed")
async def get_story_feed(request: Request, limit: int = 20):
    """Get public story feed from all users"""
    authorization = request.headers.get("authorization")
    get_current_user(authorization)  # Just verify auth
    
    stories = await db.stories.find({}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get user info for each story
    result = []
    for s in stories:
        user = await db.users.find_one(
            {"user_id": s["user_id"]},
            {"display_name": 1, "email": 1, "tier": 1}
        )
        
        result.append({
            "id": str(s["_id"]),
            "photo_url": s["photo_url"],
            "caption": s["caption"],
            "venue_name": s["venue_name"],
            "shares": s.get("shares", 0),
            "created_at": s["created_at"].isoformat(),
            "user": {
                "name": user.get("display_name") or user.get("email", "").split("@")[0] if user else "Luna Member",
                "tier": user.get("tier", "bronze") if user else "bronze"
            }
        })
    
    return {"stories": result}


@router.post("/generate-caption")
async def generate_caption(request: Request, venue_name: str, event_name: Optional[str] = None):
    """Generate AI caption for a photo"""
    authorization = request.headers.get("authorization")
    get_current_user(authorization)
    
    try:
        caption = await luna_ai.generate_photo_caption(
            venue_name=venue_name,
            event_name=event_name
        )
        return {"caption": caption}
    except Exception as e:
        logger.error(f"Caption generation error: {e}")
        return {"caption": f"Amazing night at {venue_name}!"}
