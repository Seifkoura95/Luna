"""
Instagram Integration Routes - Luna Group social media feeds
"""
from fastapi import APIRouter, Request, HTTPException
import logging

from utils.auth import get_current_user
from instagram_service import (
    instagram_service,
    get_instagram_feed,
    get_account_media,
    get_hashtag_media,
    LUNA_INSTAGRAM_ACCOUNTS,
    LUNA_HASHTAGS
)

router = APIRouter(prefix="/instagram", tags=["instagram"])
logger = logging.getLogger(__name__)


@router.get("/feed")
async def get_instagram_social_feed(request: Request, limit: int = 20):
    """Get the combined Instagram feed from Luna Group accounts and hashtags"""
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
    try:
        feed = await get_instagram_feed(limit)
        return feed
    except Exception as e:
        logger.error(f"Failed to get Instagram feed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get Instagram feed: {str(e)}")


@router.get("/account/{account}")
async def get_instagram_account_posts(request: Request, account: str, limit: int = 10):
    """Get posts from a specific Luna Group Instagram account"""
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
    if account not in LUNA_INSTAGRAM_ACCOUNTS:
        raise HTTPException(status_code=400, detail=f"Unknown account: {account}")
    
    try:
        posts = await get_account_media(account, limit)
        return {
            "account": account,
            "account_info": LUNA_INSTAGRAM_ACCOUNTS[account],
            "posts": posts,
            "total": len(posts)
        }
    except Exception as e:
        logger.error(f"Failed to get Instagram posts for {account}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/hashtag/{hashtag}")
async def get_instagram_hashtag_posts(request: Request, hashtag: str, limit: int = 10):
    """Get posts with a specific hashtag"""
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
    hashtag = hashtag.strip().lstrip('#')
    
    try:
        posts = await get_hashtag_media(hashtag, limit)
        return {
            "hashtag": hashtag,
            "posts": posts,
            "total": len(posts),
            "is_tracked": hashtag.lower() in [h.lower() for h in LUNA_HASHTAGS]
        }
    except Exception as e:
        logger.error(f"Failed to get Instagram posts for #{hashtag}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_instagram_config(request: Request):
    """Get Instagram integration configuration and status"""
    auth_header = request.headers.get("Authorization")
    get_current_user(auth_header)
    
    return instagram_service.get_configuration()
