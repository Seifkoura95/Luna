"""
Shared utilities and functions used across multiple route modules.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from database import db
from luna_venues_config import LUNA_VENUES

logger = logging.getLogger(__name__)


async def send_push_notification_to_token(token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo's push API"""
    import httpx
    
    payload = {
        "to": token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 200:
                logger.info(f"Push notification sent to token: {token[:20]}...")
                return True
            else:
                logger.error(f"Push notification failed: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Push notification error: {str(e)}")
        return False


async def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send push notification to a user by their user_id"""
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        logger.warning(f"User {user_id} not found for push notification")
        return False
    
    push_token = user.get("push_token")
    if not push_token:
        logger.info(f"User {user_id} has no push token registered")
        return False
    
    return await send_push_notification_to_token(push_token, title, body, data)


async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    data: dict = None,
    priority: str = "normal",
    send_push: bool = True
):
    """Create and store a notification for a user, optionally send push"""
    notification = {
        "id": str(uuid.uuid4())[:8],
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "data": data or {},
        "priority": priority,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)
    
    # Send push notification for high priority or if explicitly requested
    if send_push and priority in ["high", "medium"]:
        await send_push_notification(user_id, title, message, data)
    
    return notification


async def notify_new_event(event: dict, venue_id: str):
    """Notify users about a new event at their favorite venue."""
    venue = LUNA_VENUES.get(venue_id, {})
    venue_name = venue.get("name", venue_id)
    
    # Find users who have bookings at this venue
    interested_users = await db.bookings.distinct(
        "user_id",
        {"venue_id": venue_id}
    )
    
    for user_id in interested_users[:100]:
        prefs = await db.notification_preferences.find_one({"user_id": user_id})
        if prefs and not prefs.get("favorite_venues", True):
            continue
        
        await create_notification(
            user_id=user_id,
            notification_type="event",
            title=f"New Event at {venue_name}!",
            message=f"{event.get('title', 'A new event')} is coming up. Get your tickets now!",
            data={
                "event_id": event.get("id"),
                "venue_id": venue_id,
                "action": "view_event"
            },
            priority="high"
        )


async def notify_event_reminder(event: dict, hours_before: int = 24):
    """Send reminder notifications for an upcoming event."""
    bookings = await db.bookings.find({
        "event_id": event.get("id"),
        "status": {"$in": ["confirmed", "pending"]}
    }).to_list(500)
    
    venue = LUNA_VENUES.get(event.get("venue_id"), {})
    venue_name = venue.get("name", "the venue")
    
    for booking in bookings:
        user_id = booking.get("user_id")
        
        prefs = await db.notification_preferences.find_one({"user_id": user_id})
        if prefs and not prefs.get("event_reminders", True):
            continue
        
        await create_notification(
            user_id=user_id,
            notification_type="event",
            title=f"Event Reminder: {event.get('title', 'Your event')}",
            message=f"Your event at {venue_name} starts in {hours_before} hours. Don't forget!",
            data={
                "event_id": event.get("id"),
                "venue_id": event.get("venue_id"),
                "action": "view_ticket"
            },
            priority="high"
        )


async def notify_auction_update(auction: dict, notification_type: str, message: str):
    """Notify users subscribed to an auction about updates."""
    subscribers = await db.auction_subscribers.find({
        "auction_id": auction.get("id")
    }).to_list(100)
    
    for sub in subscribers:
        user_id = sub.get("user_id")
        
        await create_notification(
            user_id=user_id,
            notification_type="auction",
            title=f"Auction Update: {auction.get('title', 'Item')}",
            message=message,
            data={
                "auction_id": auction.get("id"),
                "type": notification_type,
                "action": "view_auction"
            },
            priority="high"
        )
