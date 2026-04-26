"""
Events API endpoints powered by Eventfinda
"""
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
import logging
from datetime import datetime, timezone, timedelta

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs
from eventfinda_service import eventfinda_service
from models.events import EventRSVP

router = APIRouter(prefix="/events", tags=["Events"])
logger = logging.getLogger(__name__)


@router.get("")
async def get_events(
    venue_id: Optional[str] = None,
    location: Optional[str] = "brisbane",
    limit: int = 20,
    category: Optional[str] = None
):
    """Get events from Eventfinda (real-time data) with database fallback"""
    try:
        events = await eventfinda_service.get_events(
            location=location,
            rows=min(limit, 50),
            category=category
        )
        
        # If Eventfinda returns events, use them
        if events and len(events) > 0:
            if venue_id:
                events = [e for e in events if e.get("venue_id") == venue_id]
            
            return {
                "events": events,
                "total": len(events),
                "source": "eventfinda",
                "location": location
            }
    except Exception as e:
        logger.warning(f"Eventfinda fetch failed: {e}")
    
    # Fallback to database events
    logger.info("Using database events as fallback")
    now = datetime.now(timezone.utc)
    query = {"event_date": {"$gte": now - timedelta(hours=6)}}  # Include events from tonight
    if venue_id:
        query["venue_id"] = venue_id
    
    db_events = await db.events.find(query).sort("event_date", 1).to_list(limit)
    return {
        "events": clean_mongo_docs(db_events),
        "total": len(db_events),
        "source": "database",
        "location": location
    }


@router.get("/featured")
async def get_featured_events(location: str = "brisbane", limit: int = 5):
    """Get featured/popular events"""
    try:
        events = await eventfinda_service.get_featured_events(location=location, limit=limit)
        return {
            "events": events,
            "total": len(events),
            "source": "eventfinda"
        }
    except Exception as e:
        logger.error(f"Failed to fetch featured events: {e}")
        return {"events": [], "total": 0, "source": "eventfinda", "error": str(e)}


@router.get("/tonight")
async def get_tonight_events(location: str = "brisbane", limit: int = 10):
    """Get events happening tonight"""
    try:
        events = await eventfinda_service.get_tonight_events(location=location, limit=limit)
        return {
            "events": events,
            "total": len(events),
            "date": datetime.now().strftime("%Y-%m-%d"),
            "source": "eventfinda"
        }
    except Exception as e:
        logger.error(f"Failed to fetch tonight's events: {e}")
        return {"events": [], "total": 0, "source": "eventfinda", "error": str(e)}


@router.get("/weekend")
async def get_weekend_events(location: str = "brisbane", limit: int = 20):
    """Get events happening this weekend"""
    try:
        events = await eventfinda_service.get_weekend_events(location=location, limit=limit)
        return {
            "events": events,
            "total": len(events),
            "source": "eventfinda"
        }
    except Exception as e:
        logger.error(f"Failed to fetch weekend events: {e}")
        return {"events": [], "total": 0, "source": "eventfinda", "error": str(e)}


@router.get("/upcoming")
async def get_upcoming_events(location: str = "brisbane", limit: int = 30):
    """Get upcoming events (next 30 days)"""
    try:
        events = await eventfinda_service.get_upcoming_events(location=location, limit=limit)
        return {
            "events": events,
            "total": len(events),
            "source": "eventfinda"
        }
    except Exception as e:
        logger.error(f"Failed to fetch upcoming events: {e}")
        return {"events": [], "total": 0, "source": "eventfinda", "error": str(e)}


@router.get("/feed")
async def get_events_feed(limit: int = 30):
    """Get events feed ONLY for Luna Group venues"""
    luna_events = []
    source = "database"
    
    # Try Eventfinda first
    try:
        luna_events = await eventfinda_service.get_luna_group_events(limit=limit)
        if luna_events and len(luna_events) > 0:
            source = "eventfinda_luna_filtered"
    except Exception as e:
        logger.warning(f"Eventfinda fetch failed: {e}")
    
    # Fallback to database events if Eventfinda returns nothing
    if not luna_events or len(luna_events) == 0:
        logger.info("Using database events for feed")
        now = datetime.now(timezone.utc)
        db_events = await db.events.find(
            {"event_date": {"$gte": now - timedelta(hours=6)}}
        ).sort("event_date", 1).to_list(limit)
        
        # Convert database events to feed format
        luna_events = []
        for e in db_events:
            event_date = e.get("event_date")
            if isinstance(event_date, datetime):
                date_str = event_date.strftime("%Y-%m-%d")
            else:
                date_str = str(event_date)[:10] if event_date else ""
            
            luna_events.append({
                "id": str(e.get("id", e.get("_id", ""))),
                "title": e.get("title", ""),
                "venue_id": e.get("venue_id", ""),
                "venue_name": e.get("venue_name", ""),
                "date": date_str,
                "time": event_date.strftime("%H:%M") if isinstance(event_date, datetime) else "",
                "image_url": e.get("image_url", ""),
                "description": e.get("description", ""),
                "ticket_price": e.get("ticket_price", 0),
                "ticket_url": e.get("ticket_url", ""),
                "category": e.get("category", "event"),
                "is_featured": e.get("featured", False),
                "featured_artist": e.get("featured_artist"),
            })
        source = "database"
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tomorrow_date = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
    
    tonight_events = [e for e in luna_events if e.get("date", "")[:10] == today]
    tomorrow_events = [e for e in luna_events if e.get("date", "")[:10] == tomorrow_date]
    featured = [e for e in luna_events if e.get("is_featured")][:5]
    
    return {
        "tonight": tonight_events[:10],
        "tomorrow": tomorrow_events[:10],
        "featured": featured,
        "upcoming": luna_events[:limit],
        "total_count": len(luna_events),
        "source": source,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/search")
async def search_events_api(
    q: str,
    location: str = "brisbane",
    limit: int = 20
):
    """Search events by keyword"""
    try:
        events = await eventfinda_service.search_events(
            query=q,
            location=location,
            limit=limit
        )
        return {
            "events": events,
            "total": len(events),
            "query": q,
            "source": "eventfinda"
        }
    except Exception as e:
        logger.error(f"Failed to search events: {e}")
        return {"events": [], "total": 0, "query": q, "source": "eventfinda", "error": str(e)}


@router.get("/{event_id}")
async def get_event_detail(event_id: str):
    """Get event details by ID"""
    if event_id.startswith("ef_"):
        ef_id = int(event_id.replace("ef_", ""))
        try:
            event = await eventfinda_service.get_event_by_id(ef_id)
            if event:
                return event
        except Exception as e:
            logger.error(f"Failed to fetch Eventfinda event {ef_id}: {e}")
    
    event = await db.events.find_one({"id": event_id})
    if event:
        return clean_mongo_doc(event)
    
    raise HTTPException(status_code=404, detail="Event not found")


@router.post("/{event_id}/rsvp")
async def rsvp_to_event(event_id: str, rsvp: EventRSVP, request: Request):
    """RSVP to an event"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    existing = await db.rsvps.find_one({
        "event_id": event_id,
        "user_id": current_user["user_id"]
    })
    
    if existing:
        await db.rsvps.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "status": rsvp.status,
                "updated_at": datetime.now(timezone.utc)
            }}
        )
        return {"message": "RSVP updated", "status": rsvp.status}
    
    import uuid
    rsvp_doc = {
        "id": str(uuid.uuid4()),
        "event_id": event_id,
        "user_id": current_user["user_id"],
        "status": rsvp.status,
        "created_at": datetime.now(timezone.utc)
    }
    await db.rsvps.insert_one(rsvp_doc)

    # Mission events: event_rsvp (server-verified — RSVP doc just inserted)
    if rsvp.status in ("going", "maybe", "yes"):
        try:
            event_doc = await db.events.find_one({"id": event_id}, {"_id": 0, "venue_id": 1})
            from services.mission_events import emit_mission_event
            await emit_mission_event(
                user_id=current_user["user_id"],
                event_type="event_rsvp",
                increment=1,
                venue_id=(event_doc or {}).get("venue_id"),
            )
        except Exception:
            pass

    return {"message": "RSVP recorded", "status": rsvp.status}


@router.get("/{event_id}/rsvp")
async def get_my_rsvp(event_id: str, request: Request):
    """Get current user's RSVP status for an event"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    rsvp = await db.rsvps.find_one({
        "event_id": event_id,
        "user_id": current_user["user_id"]
    })
    
    return {
        "has_rsvp": rsvp is not None,
        "status": rsvp.get("status") if rsvp else None
    }


@router.get("/{event_id}/attendees")
async def get_event_attendees(event_id: str, request: Request):
    """Get list of attendees for an event (respects privacy settings)"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    rsvps = await db.rsvps.find({
        "event_id": event_id,
        "status": {"$in": ["going", "interested"]}
    }).to_list(100)
    
    going = []
    interested = []
    
    for rsvp in rsvps:
        user = await db.users.find_one({"user_id": rsvp["user_id"]})
        if not user:
            continue
        
        privacy = await db.privacy_settings.find_one({"user_id": rsvp["user_id"]})
        if privacy and not privacy.get("show_event_attendance", True):
            continue
        
        attendee_info = {
            "user_id": user["user_id"],
            "name": user.get("name", "Luna Member"),
            "avatar": user.get("avatar_url"),
            "tier": user.get("subscription_tier", "bronze")
        }
        
        is_friend = await db.friends.find_one({
            "$or": [
                {"user_id": current_user["user_id"], "friend_id": user["user_id"]},
                {"user_id": user["user_id"], "friend_id": current_user["user_id"]}
            ]
        })
        attendee_info["is_friend"] = is_friend is not None
        
        if rsvp["status"] == "going":
            going.append(attendee_info)
        else:
            interested.append(attendee_info)
    
    return {
        "going": going,
        "interested": interested,
        "going_count": len(going),
        "interested_count": len(interested)
    }
