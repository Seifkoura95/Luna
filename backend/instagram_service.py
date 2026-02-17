"""
Instagram Integration Service for Luna Group VIP App

This service handles:
1. Fetching posts from Luna Group official Instagram accounts
2. Fetching posts with Luna Group hashtags
3. Caching and serving Instagram content to the app

IMPORTANT: This service requires Instagram Graph API credentials.
Until credentials are provided, the service operates in DEMO mode with placeholder content.
"""

import os
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Instagram API Configuration
INSTAGRAM_ACCESS_TOKEN = os.environ.get('INSTAGRAM_ACCESS_TOKEN', '')
INSTAGRAM_APP_ID = os.environ.get('INSTAGRAM_APP_ID', '')
INSTAGRAM_APP_SECRET = os.environ.get('INSTAGRAM_APP_SECRET', '')

# Demo mode - set to False when API credentials are configured
INSTAGRAM_DEMO_MODE = not bool(INSTAGRAM_ACCESS_TOKEN)

# Instagram Graph API Base URL
INSTAGRAM_API_BASE = "https://graph.instagram.com/v18.0"
INSTAGRAM_GRAPH_API = "https://graph.facebook.com/v18.0"

# Luna Group Instagram configuration
LUNA_INSTAGRAM_ACCOUNTS = {
    "eclipsebrisbane": {
        "name": "Eclipse Brisbane",
        "url": "https://www.instagram.com/eclipsebrisbane/",
        "username": "eclipsebrisbane"
    },
    "sucasabrisbane": {
        "name": "Su Casa Brisbane",
        "url": "https://www.instagram.com/sucasabrisbane",
        "username": "sucasabrisbane"
    },
    "nightmarketbrisbane": {
        "name": "Night Market Brisbane",
        "url": "https://www.instagram.com/nightmarketbrisbane",
        "username": "nightmarketbrisbane"
    },
    "jujumermaidbeach": {
        "name": "Juju Mermaid Beach",
        "url": "https://www.instagram.com/jujumermaidbeach/",
        "username": "jujumermaidbeach"
    },
    "eclipse.afterdark": {
        "name": "Eclipse After Dark",
        "url": "https://www.instagram.com/eclipse.afterdark/",
        "username": "eclipse.afterdark"
    },
    "sucasa.gc": {
        "name": "Su Casa Gold Coast",
        "url": "https://www.instagram.com/sucasa.gc/",
        "username": "sucasa.gc"
    },
    "lunagrouphospitality": {
        "name": "Luna Group Hospitality",
        "url": "https://www.instagram.com/lunagrouphospitality/",
        "username": "lunagrouphospitality"
    }
}

# Luna Group hashtags to track
LUNA_HASHTAGS = [
    "eclipsebrisbane",
    "nightmarket",
    "nightmarketbrisbane",
    "Afterdarkbrisbane",
    "sucasabrisbane",
    "sucasagoldcoast",
    "sucasagc",
    "juju"
]


class InstagramPost(BaseModel):
    """Model for an Instagram post"""
    id: str
    media_type: str  # IMAGE, VIDEO, CAROUSEL_ALBUM
    media_url: str
    thumbnail_url: Optional[str] = None
    permalink: str
    caption: Optional[str] = None
    timestamp: str
    username: str
    like_count: Optional[int] = None
    comments_count: Optional[int] = None


class InstagramService:
    """Service class for Instagram API interactions"""
    
    def __init__(self):
        self.access_token = INSTAGRAM_ACCESS_TOKEN
        self.demo_mode = INSTAGRAM_DEMO_MODE
        self._cache: Dict[str, Any] = {}
        self._cache_expiry: Dict[str, datetime] = {}
    
    def _get_cached(self, key: str) -> Optional[Any]:
        """Get cached data if not expired"""
        if key in self._cache and key in self._cache_expiry:
            if datetime.now(timezone.utc) < self._cache_expiry[key]:
                return self._cache[key]
        return None
    
    def _set_cached(self, key: str, data: Any, ttl_minutes: int = 30):
        """Cache data with TTL"""
        self._cache[key] = data
        self._cache_expiry[key] = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    
    async def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make an authenticated request to Instagram API"""
        if self.demo_mode:
            raise Exception("Instagram API credentials not configured")
        
        url = f"{INSTAGRAM_API_BASE}{endpoint}"
        default_params = {"access_token": self.access_token}
        if params:
            default_params.update(params)
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, params=default_params, timeout=30.0)
                
                if response.status_code >= 400:
                    logger.error(f"Instagram API error: {response.status_code} - {response.text}")
                    raise Exception(f"Instagram API error: {response.status_code}")
                
                return response.json()
                
            except httpx.RequestError as e:
                logger.error(f"Instagram API request error: {e}")
                raise
    
    def _get_demo_posts(self, source: str, count: int = 10) -> List[Dict[str, Any]]:
        """Generate demo posts for development/demo mode"""
        demo_images = [
            "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800",  # nightclub
            "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",  # party
            "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800",  # dj
            "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800",  # celebration
            "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800",  # concert
            "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800",  # crowd
            "https://images.unsplash.com/photo-1571204829887-3b8d69e4094d?w=800",  # vip
            "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800",  # drinks
            "https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?w=800",  # restaurant
            "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800",  # food
        ]
        
        demo_captions = [
            f"Amazing vibes at {source}! 🎉 #LunaGroup",
            f"Best night ever! Thanks {source} 💜 #Brisbane",
            f"VIP experience was incredible 🥂 #{source.replace(' ', '')}",
            f"Can't wait to come back! 🔥 #NightOut",
            f"Living our best lives at {source}! ✨",
            f"The energy was unmatched 🎶 #WeekendVibes",
            f"Thank you for an amazing night! 🙏 #Luna",
            f"Celebrating in style 🍾 #{source.replace(' ', '')}",
            f"Best cocktails in town! 🍹 #LunaGroup",
            f"Friday nights done right 🌙 #Brisbane"
        ]
        
        posts = []
        for i in range(min(count, len(demo_images))):
            post_time = datetime.now(timezone.utc) - timedelta(hours=i * 6)
            posts.append({
                "id": f"demo_{source}_{i}",
                "media_type": "IMAGE",
                "media_url": demo_images[i],
                "thumbnail_url": demo_images[i],
                "permalink": f"https://instagram.com/p/demo{i}",
                "caption": demo_captions[i],
                "timestamp": post_time.isoformat(),
                "username": source.lower().replace(" ", ""),
                "like_count": 150 + (i * 23),
                "comments_count": 12 + (i * 3),
                "demo": True
            })
        
        return posts
    
    async def get_account_posts(self, account_key: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent posts from a Luna Group Instagram account
        
        Args:
            account_key: Key from LUNA_INSTAGRAM_ACCOUNTS
            limit: Maximum number of posts to return
        
        Returns:
            List of Instagram posts
        """
        cache_key = f"account_posts_{account_key}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached[:limit]
        
        if account_key not in LUNA_INSTAGRAM_ACCOUNTS:
            logger.warning(f"Unknown Instagram account: {account_key}")
            return []
        
        account = LUNA_INSTAGRAM_ACCOUNTS[account_key]
        
        # Demo mode
        if self.demo_mode:
            logger.info(f"[DEMO] Getting posts for {account['name']}")
            posts = self._get_demo_posts(account['name'], limit)
            self._set_cached(cache_key, posts, ttl_minutes=60)
            return posts
        
        # Live API mode
        try:
            # Note: This requires the account to be a Business/Creator account
            # connected to a Facebook Page with Instagram API access
            result = await self._make_request(
                f"/me/media",
                params={
                    "fields": "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count",
                    "limit": limit
                }
            )
            
            posts = []
            for item in result.get("data", []):
                posts.append({
                    "id": item.get("id"),
                    "media_type": item.get("media_type"),
                    "media_url": item.get("media_url"),
                    "thumbnail_url": item.get("thumbnail_url"),
                    "permalink": item.get("permalink"),
                    "caption": item.get("caption"),
                    "timestamp": item.get("timestamp"),
                    "username": account["username"],
                    "like_count": item.get("like_count"),
                    "comments_count": item.get("comments_count")
                })
            
            self._set_cached(cache_key, posts, ttl_minutes=30)
            return posts
            
        except Exception as e:
            logger.error(f"Failed to fetch Instagram posts for {account_key}: {e}")
            # Return demo posts as fallback
            return self._get_demo_posts(account['name'], limit)
    
    async def get_hashtag_posts(self, hashtag: str, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent posts with a specific hashtag
        
        Note: Hashtag search requires Instagram Graph API with specific permissions
        
        Args:
            hashtag: Hashtag to search (without #)
            limit: Maximum number of posts to return
        
        Returns:
            List of Instagram posts
        """
        cache_key = f"hashtag_posts_{hashtag}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached[:limit]
        
        # Demo mode
        if self.demo_mode:
            logger.info(f"[DEMO] Getting posts for #{hashtag}")
            posts = self._get_demo_posts(f"#{hashtag}", limit)
            for p in posts:
                p["hashtag"] = hashtag
            self._set_cached(cache_key, posts, ttl_minutes=60)
            return posts
        
        # Live API mode - requires hashtag search endpoint
        try:
            # First, get the hashtag ID
            hashtag_search = await self._make_request(
                "/ig_hashtag_search",
                params={"user_id": "me", "q": hashtag}
            )
            
            if not hashtag_search.get("data"):
                return []
            
            hashtag_id = hashtag_search["data"][0]["id"]
            
            # Then get recent media for that hashtag
            result = await self._make_request(
                f"/{hashtag_id}/recent_media",
                params={
                    "user_id": "me",
                    "fields": "id,media_type,media_url,permalink,caption,timestamp",
                    "limit": limit
                }
            )
            
            posts = []
            for item in result.get("data", []):
                posts.append({
                    "id": item.get("id"),
                    "media_type": item.get("media_type"),
                    "media_url": item.get("media_url"),
                    "permalink": item.get("permalink"),
                    "caption": item.get("caption"),
                    "timestamp": item.get("timestamp"),
                    "hashtag": hashtag
                })
            
            self._set_cached(cache_key, posts, ttl_minutes=30)
            return posts
            
        except Exception as e:
            logger.error(f"Failed to fetch Instagram posts for #{hashtag}: {e}")
            return self._get_demo_posts(f"#{hashtag}", limit)
    
    async def get_feed(self, limit: int = 20) -> Dict[str, Any]:
        """
        Get a combined feed from all Luna Group accounts and hashtags
        
        Returns a mixed feed of posts from official accounts and user-generated content
        """
        cache_key = "combined_feed"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        all_posts = []
        
        # Get posts from official accounts
        for account_key in LUNA_INSTAGRAM_ACCOUNTS:
            try:
                posts = await self.get_account_posts(account_key, limit=5)
                for p in posts:
                    p["source_type"] = "official"
                    p["source_account"] = account_key
                all_posts.extend(posts)
            except Exception as e:
                logger.error(f"Error fetching {account_key}: {e}")
        
        # Get posts from hashtags (user-generated content)
        for hashtag in LUNA_HASHTAGS[:4]:  # Limit to first 4 hashtags
            try:
                posts = await self.get_hashtag_posts(hashtag, limit=3)
                for p in posts:
                    p["source_type"] = "ugc"  # user-generated content
                    p["source_hashtag"] = hashtag
                all_posts.extend(posts)
            except Exception as e:
                logger.error(f"Error fetching #{hashtag}: {e}")
        
        # Sort by timestamp (newest first) and dedupe
        seen_ids = set()
        unique_posts = []
        for post in all_posts:
            if post["id"] not in seen_ids:
                seen_ids.add(post["id"])
                unique_posts.append(post)
        
        # Sort by timestamp
        unique_posts.sort(
            key=lambda x: x.get("timestamp", "2000-01-01"),
            reverse=True
        )
        
        result = {
            "posts": unique_posts[:limit],
            "total": len(unique_posts),
            "accounts": list(LUNA_INSTAGRAM_ACCOUNTS.keys()),
            "hashtags": LUNA_HASHTAGS,
            "demo_mode": self.demo_mode,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        self._set_cached(cache_key, result, ttl_minutes=15)
        return result
    
    def get_configuration(self) -> Dict[str, Any]:
        """Get current Instagram integration configuration"""
        return {
            "demo_mode": self.demo_mode,
            "configured": not self.demo_mode,
            "accounts": LUNA_INSTAGRAM_ACCOUNTS,
            "hashtags": LUNA_HASHTAGS,
            "api_connected": bool(self.access_token)
        }


# Global service instance
instagram_service = InstagramService()


# Utility functions
async def get_instagram_feed(limit: int = 20) -> Dict[str, Any]:
    """Convenience function to get the combined Instagram feed"""
    return await instagram_service.get_feed(limit)


async def get_account_media(account: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Convenience function to get media from a specific account"""
    return await instagram_service.get_account_posts(account, limit)


async def get_hashtag_media(hashtag: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Convenience function to get media from a specific hashtag"""
    return await instagram_service.get_hashtag_posts(hashtag, limit)
