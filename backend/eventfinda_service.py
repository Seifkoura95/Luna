"""
Eventfinda Integration Service for Luna Group VIP App

This service handles:
1. Fetching real-time events from Eventfinda API
2. Filtering events by location (Brisbane, Gold Coast)
3. Caching to respect rate limits (1 request/second)
4. Mapping Eventfinda events to Luna Group app format
"""

import os
import httpx
import logging
import base64
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from functools import lru_cache
import asyncio

logger = logging.getLogger(__name__)

# Eventfinda API Configuration
EVENTFINDA_USERNAME = os.environ.get('EVENTFINDA_USERNAME', 'lunagrouployaltyapp')
EVENTFINDA_PASSWORD = os.environ.get('EVENTFINDA_PASSWORD', 'xytjdrgk6rjs')
EVENTFINDA_API_BASE = "https://api.eventfinda.com.au/v2"

# Location IDs for Brisbane and Gold Coast areas
BRISBANE_LOCATION_SLUG = "brisbane"
GOLD_COAST_LOCATION_SLUG = "gold-coast"

# Luna Group venue mappings (for filtering events at Luna venues)
# Must match venue IDs from luna_venues_config.py
LUNA_VENUES = {
    "eclipse": {
        "name": "Eclipse",
        "full_name": "Eclipse Brisbane",
        "location": "Fortitude Valley, Brisbane",
        "search_terms": ["Eclipse Brisbane", "Eclipse Fortitude Valley", "Eclipse nightclub Brisbane"],
        "keywords": ["eclipse brisbane", "eclipse fortitude"]
    },
    "after_dark": {
        "name": "After Dark",
        "full_name": "After Dark Brisbane",
        "location": "Fortitude Valley, Brisbane",
        "search_terms": ["After Dark Brisbane", "After Dark Fortitude Valley", "Afterdark Brisbane"],
        "keywords": ["after dark brisbane", "afterdark brisbane"]
    },
    "su_casa_brisbane": {
        "name": "Su Casa Brisbane",
        "full_name": "Su Casa Brisbane",
        "location": "Fortitude Valley, Brisbane",
        "search_terms": ["Su Casa Brisbane", "Su Casa Fortitude Valley", "Sucasa Brisbane"],
        "keywords": ["su casa brisbane", "sucasa brisbane"]
    },
    "su_casa_gold_coast": {
        "name": "Su Casa Gold Coast",
        "full_name": "Su Casa Gold Coast",
        "location": "Surfers Paradise, Gold Coast",
        "search_terms": ["Su Casa Gold Coast", "Su Casa Surfers Paradise", "Sucasa Gold Coast"],
        "keywords": ["su casa gold coast", "sucasa gold coast", "su casa surfers"]
    },
    "juju": {
        "name": "Juju",
        "full_name": "Juju Mermaid Beach",
        "location": "Mermaid Beach, Gold Coast",
        "search_terms": ["Juju Mermaid Beach", "Juju Gold Coast", "Juju restaurant"],
        "keywords": ["juju mermaid", "juju gold coast"]
    },
    "night_market": {
        "name": "Night Market",
        "full_name": "Night Market Brisbane",
        "location": "Fortitude Valley, Brisbane",
        "search_terms": ["Night Market Brisbane", "Night Market Fortitude Valley"],
        "keywords": ["night market brisbane", "nightmarket brisbane"]
    },
    "ember_and_ash": {
        "name": "Ember & Ash",
        "full_name": "Ember & Ash Brisbane",
        "location": "Brisbane CBD",
        "search_terms": ["Ember and Ash Brisbane", "Ember & Ash Brisbane"],
        "keywords": ["ember and ash", "ember ash brisbane"]
    }
}

# All search terms for Luna Group venues
LUNA_VENUE_SEARCH_TERMS = []
for venue in LUNA_VENUES.values():
    LUNA_VENUE_SEARCH_TERMS.extend(venue["search_terms"])

# Event categories relevant to Luna Group (nightlife, music, entertainment)
RELEVANT_CATEGORIES = [
    "concerts-gig-guide",
    "festivals",
    "nightlife",
    "dj",
    "club-nights",
    "parties",
    "entertainment",
    "music"
]


class EventfindaService:
    """Service class for Eventfinda API interactions"""
    
    def __init__(self):
        self.username = EVENTFINDA_USERNAME
        self.password = EVENTFINDA_PASSWORD
        self._cache: Dict[str, Any] = {}
        self._cache_expiry: Dict[str, datetime] = {}
        self._last_request_time: Optional[datetime] = None
        self._rate_limit_seconds = 1.0  # 1 request per second
    
    def _get_auth_header(self) -> str:
        """Generate Basic Auth header"""
        credentials = f"{self.username}:{self.password}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"
    
    def _get_cached(self, key: str) -> Optional[Any]:
        """Get cached data if not expired"""
        if key in self._cache and key in self._cache_expiry:
            if datetime.now(timezone.utc) < self._cache_expiry[key]:
                logger.debug(f"Cache hit for {key}")
                return self._cache[key]
        return None
    
    def _set_cached(self, key: str, data: Any, ttl_minutes: int = 5):
        """Cache data with TTL"""
        self._cache[key] = data
        self._cache_expiry[key] = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    
    async def _rate_limit(self):
        """Ensure we don't exceed rate limits"""
        if self._last_request_time is not None:
            now = datetime.now()
            elapsed = (now - self._last_request_time).total_seconds()
            if elapsed < self._rate_limit_seconds:
                await asyncio.sleep(self._rate_limit_seconds - elapsed)
        self._last_request_time = datetime.now()
    
    async def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make an authenticated request to Eventfinda API"""
        await self._rate_limit()
        
        url = f"{EVENTFINDA_API_BASE}{endpoint}"
        headers = {
            "Authorization": self._get_auth_header(),
            "Accept": "application/json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=headers, params=params, timeout=30.0)
                
                if response.status_code == 401:
                    logger.error("Eventfinda API authentication failed")
                    raise Exception("Eventfinda API authentication failed")
                
                if response.status_code >= 400:
                    logger.error(f"Eventfinda API error: {response.status_code} - {response.text}")
                    raise Exception(f"Eventfinda API error: {response.status_code}")
                
                return response.json()
                
            except httpx.RequestError as e:
                logger.error(f"Eventfinda API request error: {e}")
                raise
    
    def _transform_event(self, ef_event: Dict[str, Any], venue_id: Optional[str] = None) -> Dict[str, Any]:
        """Transform Eventfinda event to Luna Group app format"""
        # Get primary image
        image_url = None
        if ef_event.get("images") and ef_event["images"].get("images"):
            images = ef_event["images"]["images"]
            if images:
                # Get the largest transform (usually transformation_id 7 or 35)
                transforms = images[0].get("transforms", {}).get("transforms", [])
                for transform in transforms:
                    if transform.get("transformation_id") in [7, 35, 27]:
                        image_url = transform.get("url")
                        break
                if not image_url and transforms:
                    image_url = transforms[-1].get("url")
        
        # Check if image is a sample/placeholder image from Eventfinda
        # These don't load well and should be replaced with venue-specific images
        if image_url and "sample-images" in image_url:
            image_url = None
        
        # Default image based on venue or category if none found
        if not image_url:
            # Use venue-specific fallback images (verified working URLs)
            location_lower = (ef_event.get("location", {}).get("name", "") or "").lower()
            if "eclipse" in location_lower:
                image_url = "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?w=800"
            elif "su casa" in location_lower or "sucasa" in location_lower:
                image_url = "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800"
            elif "juju" in location_lower:
                image_url = "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800"
            elif "night market" in location_lower:
                image_url = "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800"
            elif "after dark" in location_lower:
                image_url = "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=800"
            else:
                # Generic nightclub image
                image_url = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800"
        
        # Parse dates
        datetime_start = ef_event.get("datetime_start", "")
        datetime_end = ef_event.get("datetime_end", "")
        
        # Determine venue from location or use provided venue_id
        location_name = ""
        if ef_event.get("location"):
            location_name = ef_event["location"].get("name", "")
        
        # Map to Luna venue if possible
        mapped_venue_id = venue_id
        if not mapped_venue_id:
            location_lower = location_name.lower()
            location_summary = ef_event.get("location_summary", "").lower()
            for vid, vinfo in LUNA_VENUES.items():
                for keyword in vinfo["keywords"]:
                    if keyword in location_lower or keyword in location_summary:
                        mapped_venue_id = vid
                        break
                if mapped_venue_id:
                    break
        
        # Get category
        category = "event"
        if ef_event.get("category"):
            cat_slug = ef_event["category"].get("url_slug", "")
            if "concert" in cat_slug or "music" in cat_slug or "gig" in cat_slug:
                category = "concert"
            elif "festival" in cat_slug:
                category = "festival"
            elif "club" in cat_slug or "nightlife" in cat_slug or "party" in cat_slug:
                category = "nightlife"
            elif "dj" in cat_slug:
                category = "dj_night"
        
        # Build ticket info
        tickets = []
        if ef_event.get("sessions"):
            for session in ef_event["sessions"].get("sessions", [])[:3]:
                if session.get("tickets"):
                    for ticket in session["tickets"].get("tickets", []):
                        tickets.append({
                            "type": ticket.get("name", "General"),
                            "price": ticket.get("price", 0),
                            "available": ticket.get("is_available", True)
                        })
        
        return {
            "id": f"ef_{ef_event['id']}",
            "eventfinda_id": ef_event["id"],
            "title": ef_event.get("name", "Untitled Event"),
            "description": ef_event.get("description", "").replace("&ndash;", "–").replace("&amp;", "&"),
            "date": datetime_start.split(" ")[0] if datetime_start else "",
            "time": datetime_start.split(" ")[1][:5] if " " in datetime_start else "",
            "end_time": datetime_end.split(" ")[1][:5] if " " in datetime_end else "",
            "datetime_start": datetime_start,
            "datetime_end": datetime_end,
            "venue_id": mapped_venue_id or "external",
            "venue_name": location_name or ef_event.get("location_summary", ""),
            "location": ef_event.get("location_summary", ""),
            "address": ef_event.get("address", ""),
            "image": image_url,
            "category": category,
            "is_free": ef_event.get("is_free", False),
            "is_featured": ef_event.get("is_featured", False),
            "is_cancelled": ef_event.get("is_cancelled", False),
            "restrictions": ef_event.get("restrictions", ""),
            "url": ef_event.get("url", ""),
            "tickets": tickets,
            "source": "eventfinda",
            "point": ef_event.get("point", {})
        }
    
    async def get_events(
        self,
        location: str = "brisbane",
        rows: int = 20,
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        featured_only: bool = False,
        free_only: bool = False,
        order: str = "date"
    ) -> List[Dict[str, Any]]:
        """
        Get events from Eventfinda
        
        Args:
            location: Location slug (brisbane, gold-coast)
            rows: Number of events to return (max 100)
            category: Category slug to filter by
            start_date: Start date filter (YYYY-MM-DD)
            end_date: End date filter (YYYY-MM-DD)
            featured_only: Only return featured events
            free_only: Only return free events
            order: Sort order (date, popularity, distance)
        
        Returns:
            List of events in Luna Group app format
        """
        cache_key = f"events_{location}_{rows}_{category}_{start_date}_{end_date}_{featured_only}_{free_only}_{order}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        params = {
            "rows": min(rows, 100),
            "location_slug": location,
            "order": order
        }
        
        if category:
            params["category_slug"] = category
        
        if start_date:
            params["start_date"] = start_date
        else:
            # Default to today
            params["start_date"] = datetime.now().strftime("%Y-%m-%d")
        
        if end_date:
            params["end_date"] = end_date
        
        if featured_only:
            params["featured"] = 1
        
        if free_only:
            params["free"] = 1
        
        try:
            result = await self._make_request("/events.json", params)
            events = result.get("events", [])
            
            transformed = [self._transform_event(e) for e in events]
            
            # Filter out cancelled events
            transformed = [e for e in transformed if not e.get("is_cancelled")]
            
            self._set_cached(cache_key, transformed, ttl_minutes=5)
            
            logger.info(f"Fetched {len(transformed)} events from Eventfinda for {location}")
            return transformed
            
        except Exception as e:
            logger.error(f"Failed to fetch events from Eventfinda: {e}")
            return []
    
    async def get_luna_group_events(self, limit: int = 30) -> List[Dict[str, Any]]:
        """
        Get events ONLY at Luna Group venues
        
        Filters Eventfinda events to only include those where the venue_name
        matches a Luna Group venue (Eclipse, After Dark, Su Casa, Juju, Night Market)
        """
        cache_key = f"luna_group_events_{limit}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        all_events = []
        seen_ids = set()
        
        # Luna venue keywords for filtering (lowercase for comparison)
        luna_venue_keywords = [
            "eclipse",
            "after dark", "afterdark",
            "su casa", "sucasa",
            "juju",
            "night market", "nightmarket",
            "ember & ash", "ember and ash"
        ]
        
        # Helper function to check if an event is at a Luna venue
        def is_luna_venue_event(event: Dict) -> bool:
            venue = (event.get("venue_name") or "").lower()
            location = (event.get("location") or "").lower()
            address = (event.get("address") or "").lower()
            
            for keyword in luna_venue_keywords:
                if keyword in venue or keyword in location or keyword in address:
                    return True
            return False
        
        # Helper function to get Luna venue name from event
        def get_luna_venue_name(event: Dict) -> str:
            venue = (event.get("venue_name") or "").lower()
            location = (event.get("location") or "").lower()
            
            if "eclipse" in venue or "eclipse" in location:
                return "Eclipse"
            elif "after dark" in venue or "afterdark" in venue or "after dark" in location:
                return "After Dark"
            elif "su casa" in venue or "sucasa" in venue or "su casa" in location:
                if "gold coast" in location or "surfers" in location or "broadbeach" in location:
                    return "Su Casa Gold Coast"
                return "Su Casa Brisbane"
            elif "juju" in venue or "juju" in location:
                return "Juju"
            elif "night market" in venue or "nightmarket" in venue or "night market" in location:
                return "Night Market"
            elif "ember" in venue or "ash" in venue:
                return "Ember & Ash"
            return "Luna Group"
        
        # Get events from both Brisbane and Gold Coast
        for location in ["brisbane", "gold-coast"]:
            try:
                # Get upcoming events
                events = await self.get_events(
                    location=location,
                    rows=100,  # Get more to filter
                    order="date"
                )
                
                for event in events:
                    if event["eventfinda_id"] not in seen_ids and is_luna_venue_event(event):
                        event["luna_venue"] = get_luna_venue_name(event)
                        seen_ids.add(event["eventfinda_id"])
                        all_events.append(event)
                        
            except Exception as e:
                logger.error(f"Failed to fetch events for {location}: {e}")
                continue
        
        # Also search specifically for each venue name
        for venue_id, venue_info in LUNA_VENUES.items():
            venue_name = venue_info["name"]
            try:
                # Use venue_search endpoint if available, otherwise keyword search
                location = "gold-coast" if "Gold Coast" in venue_info.get("location", "") else "brisbane"
                events = await self.search_events(
                    query=f'"{venue_name}"',  # Exact phrase search
                    location=location,
                    limit=20
                )
                
                for event in events:
                    if event["eventfinda_id"] not in seen_ids:
                        # Double check the venue matches
                        venue_check = (event.get("venue_name") or "").lower()
                        if any(kw in venue_check for kw in venue_info.get("keywords", [])):
                            event["luna_venue"] = venue_name
                            seen_ids.add(event["eventfinda_id"])
                            all_events.append(event)
                            
            except Exception as e:
                logger.error(f"Failed to search for venue {venue_name}: {e}")
                continue
        
        # Sort by date
        all_events.sort(key=lambda x: x.get("datetime_start", ""))
        
        # Limit results
        result = all_events[:limit]
        
        self._set_cached(cache_key, result, ttl_minutes=10)
        
        logger.info(f"Found {len(result)} Luna Group events")
        return result
    
    async def get_featured_events(self, location: str = "brisbane", limit: int = 5) -> List[Dict[str, Any]]:
        """Get featured/popular events"""
        events = await self.get_events(
            location=location,
            rows=limit * 2,  # Get more to filter
            order="popularity"
        )
        
        # Prioritize featured events, then most popular
        featured = [e for e in events if e.get("is_featured")]
        non_featured = [e for e in events if not e.get("is_featured")]
        
        return (featured + non_featured)[:limit]
    
    async def get_tonight_events(self, location: str = "brisbane", limit: int = 10) -> List[Dict[str, Any]]:
        """Get events happening tonight"""
        today = datetime.now().strftime("%Y-%m-%d")
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        events = await self.get_events(
            location=location,
            rows=limit,
            start_date=today,
            end_date=tomorrow,
            order="date"
        )
        
        return events
    
    async def get_weekend_events(self, location: str = "brisbane", limit: int = 20) -> List[Dict[str, Any]]:
        """Get events happening this weekend"""
        today = datetime.now()
        
        # Find next Friday
        days_until_friday = (4 - today.weekday()) % 7
        if days_until_friday == 0 and today.weekday() > 4:
            days_until_friday = 7
        
        friday = today + timedelta(days=days_until_friday)
        sunday = friday + timedelta(days=2)
        
        events = await self.get_events(
            location=location,
            rows=limit,
            start_date=friday.strftime("%Y-%m-%d"),
            end_date=sunday.strftime("%Y-%m-%d"),
            order="date"
        )
        
        return events
    
    async def get_upcoming_events(self, location: str = "brisbane", limit: int = 20) -> List[Dict[str, Any]]:
        """Get upcoming events (next 30 days)"""
        today = datetime.now()
        end_date = today + timedelta(days=30)
        
        events = await self.get_events(
            location=location,
            rows=limit,
            start_date=today.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
            order="date"
        )
        
        return events
    
    async def get_events_by_category(
        self,
        category_slug: str,
        location: str = "brisbane",
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get events filtered by category"""
        return await self.get_events(
            location=location,
            rows=limit,
            category=category_slug,
            order="date"
        )
    
    async def search_events(
        self,
        query: str,
        location: str = "brisbane",
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Search events by keyword"""
        cache_key = f"search_{query}_{location}_{limit}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        params = {
            "q": query,
            "rows": min(limit, 100),
            "location_slug": location,
            "order": "popularity"
        }
        
        try:
            result = await self._make_request("/events.json", params)
            events = result.get("events", [])
            
            transformed = [self._transform_event(e) for e in events]
            transformed = [e for e in transformed if not e.get("is_cancelled")]
            
            self._set_cached(cache_key, transformed, ttl_minutes=10)
            
            return transformed
            
        except Exception as e:
            logger.error(f"Failed to search events: {e}")
            return []
    
    async def get_event_by_id(self, event_id: int) -> Optional[Dict[str, Any]]:
        """Get a single event by Eventfinda ID"""
        cache_key = f"event_{event_id}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        try:
            result = await self._make_request(f"/events/{event_id}.json")
            
            # Single event lookup returns event directly (not in "events" array)
            # Check if result has 'id' field (direct event response)
            if result.get("id"):
                transformed = self._transform_event(result)
                self._set_cached(cache_key, transformed, ttl_minutes=15)
                return transformed
            
            # Fallback: check if wrapped in events array (for compatibility)
            if result.get("events"):
                event = result["events"][0]
                transformed = self._transform_event(event)
                self._set_cached(cache_key, transformed, ttl_minutes=15)
                return transformed
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get event {event_id}: {e}")
            return None
    
    async def get_combined_feed(self, limit: int = 30) -> Dict[str, Any]:
        """
        Get a combined feed of events from Brisbane and Gold Coast
        
        Returns:
            Dict with tonight, featured, upcoming, and all events
        """
        cache_key = f"combined_feed_{limit}"
        cached = self._get_cached(cache_key)
        if cached:
            return cached
        
        # Fetch from both locations in parallel
        brisbane_events, gc_events = await asyncio.gather(
            self.get_events(location="brisbane", rows=limit),
            self.get_events(location="gold-coast", rows=limit // 2)
        )
        
        # Combine and dedupe
        all_events = brisbane_events + gc_events
        seen_ids = set()
        unique_events = []
        for event in all_events:
            if event["eventfinda_id"] not in seen_ids:
                seen_ids.add(event["eventfinda_id"])
                unique_events.append(event)
        
        # Sort by date
        unique_events.sort(key=lambda x: x.get("datetime_start", ""))
        
        # Categorize
        today = datetime.now().strftime("%Y-%m-%d")
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        tonight_events = [e for e in unique_events if e.get("date") == today]
        tomorrow_events = [e for e in unique_events if e.get("date") == tomorrow]
        featured = [e for e in unique_events if e.get("is_featured")][:5]
        
        result = {
            "tonight": tonight_events[:10],
            "tomorrow": tomorrow_events[:10],
            "featured": featured,
            "upcoming": unique_events[:limit],
            "total_count": len(unique_events),
            "source": "eventfinda",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        self._set_cached(cache_key, result, ttl_minutes=5)
        
        return result


# Global service instance
eventfinda_service = EventfindaService()


# Convenience functions
async def get_brisbane_events(limit: int = 20) -> List[Dict[str, Any]]:
    """Get events in Brisbane"""
    return await eventfinda_service.get_events(location="brisbane", rows=limit)


async def get_gold_coast_events(limit: int = 20) -> List[Dict[str, Any]]:
    """Get events on Gold Coast"""
    return await eventfinda_service.get_events(location="gold-coast", rows=limit)


async def get_tonight(limit: int = 10) -> List[Dict[str, Any]]:
    """Get tonight's events"""
    return await eventfinda_service.get_tonight_events(limit=limit)


async def get_featured(limit: int = 5) -> List[Dict[str, Any]]:
    """Get featured events"""
    return await eventfinda_service.get_featured_events(limit=limit)


async def search(query: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Search events"""
    return await eventfinda_service.search_events(query=query, limit=limit)
