"""
Geofence Routes - Location-based push notifications
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import math
import logging

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs

router = APIRouter(prefix="/geofences", tags=["geofences"])
logger = logging.getLogger(__name__)


# ============ Models ============

class GeofenceCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    radius: float = 200  # meters
    notification_title: str
    notification_body: str
    venue_id: Optional[str] = None
    is_active: bool = True


class GeofenceUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None
    notification_title: Optional[str] = None
    notification_body: Optional[str] = None
    venue_id: Optional[str] = None
    is_active: Optional[bool] = None


class GeofenceTrigger(BaseModel):
    geofence_id: str
    latitude: float
    longitude: float


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float


# ============ Helper Functions ============

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the distance between two points on Earth using Haversine formula.
    Returns distance in meters.
    """
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


async def has_triggered_today(user_id: str, geofence_id: str) -> bool:
    """Check if user has already triggered this geofence today"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    trigger = await db.geofence_triggers.find_one({
        "user_id": user_id,
        "geofence_id": geofence_id,
        "triggered_at": {"$gte": today_start}
    })
    
    return trigger is not None


async def send_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo"""
    import httpx
    
    message = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://exp.host/--/api/v2/push/send",
            json=message,
            headers={"Content-Type": "application/json"}
        )
        return response.json()


# ============ Public Endpoints ============

@router.get("")
async def get_active_geofences(authorization: str = Header(None)):
    """Get all active geofence zones for the mobile app"""
    get_current_user(authorization)  # Validate auth
    
    geofences = await db.geofences.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"geofences": geofences}


# Cluster notification messages — sent when multiple venues are nearby
CLUSTER_MESSAGES = {
    "brisbane_cbd": {
        "title": "Big night ahead",
        "body": "There's a lot happening tonight. Open the app to see what's on.",
        "action": "open_home",
    },
    "gold_coast_surfers": {
        "title": "The coast is buzzing tonight",
        "body": "Check your app — there's something for everyone tonight.",
        "action": "open_home",
    },
    "gold_coast_mermaid": {
        "title": "Good food, good night",
        "body": "Juju has your favourite dishes and a great atmosphere tonight. Check it out.",
        "action": "open_home",
    },
    "brisbane_south": {
        "title": "Fire-grilled perfection awaits",
        "body": "Ember & Ash has premium cuts and cocktails ready. Check your app for tonight's menu.",
        "action": "open_home",
    },
}


async def has_triggered_cluster_today(user_id: str, cluster: str) -> bool:
    """Check if user has already received a notification for this cluster today"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    trigger = await db.geofence_triggers.find_one({
        "user_id": user_id,
        "cluster": cluster,
        "triggered_at": {"$gte": today_start}
    })
    return trigger is not None


@router.post("/check-location")
async def check_location(
    location: LocationUpdate,
    authorization: str = Header(None)
):
    """
    Check if user is within any geofence zones.
    If multiple venues in the same cluster are nearby, send ONE generic notification.
    Otherwise send the venue-specific message.
    """
    user = get_current_user(authorization)
    user_id = user.get("user_id")
    
    user_record = await db.users.find_one({"user_id": user_id})
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user_record.get("notification_preferences", {})
    if prefs.get("location_alerts", True) is False:
        return {"triggered": [], "message": "Location notifications disabled"}
    
    geofences = await db.geofences.find({"is_active": True}).to_list(100)
    
    # Find all geofences the user is within
    nearby = []
    for gf in geofences:
        distance = haversine_distance(
            location.latitude, location.longitude,
            gf.get("latitude"), gf.get("longitude")
        )
        if distance <= gf.get("radius", 1000):
            nearby.append({**gf, "_distance": distance})
    
    if not nearby:
        return {"triggered": [], "notifications_sent": 0, "message": "Not in any geofence zones"}
    
    # Group by cluster
    clusters = {}
    for gf in nearby:
        cluster = gf.get("cluster", gf.get("id"))
        if cluster not in clusters:
            clusters[cluster] = []
        clusters[cluster].append(gf)
    
    triggered_zones = []
    notifications_sent = 0
    push_token = user_record.get("push_token")
    
    for cluster, venues in clusters.items():
        # Skip if already notified for this cluster today
        if await has_triggered_cluster_today(user_id, cluster):
            continue
        
        if len(venues) > 1:
            # Multiple venues in cluster — send ONE generic notification
            cluster_msg = CLUSTER_MESSAGES.get(cluster, {
                "title": "Big night ahead",
                "body": "There's a lot happening tonight. Open the app to see what's on.",
                "action": "open_home",
            })
            title = cluster_msg["title"]
            body = cluster_msg["body"]
            data = {"type": "geofence", "action": "open_home", "cluster": cluster}
        else:
            # Single venue — send venue-specific notification
            venue = venues[0]
            title = venue.get("notification_title", "Big night ahead")
            body = venue.get("notification_body", "Open the app to see what's on.")
            data = {"type": "geofence", "venue_id": venue.get("venue_id"), "action": "open_venue"}
        
        # Record the trigger (per cluster, not per venue)
        await db.geofence_triggers.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "cluster": cluster,
            "geofence_ids": [v.get("id") for v in venues],
            "venue_ids": [v.get("venue_id") for v in venues],
            "distance": round(min(v["_distance"] for v in venues), 2),
            "user_latitude": location.latitude,
            "user_longitude": location.longitude,
            "notification_title": title,
            "notification_body": body,
            "triggered_at": datetime.now(timezone.utc)
        })
        
        triggered_zones.extend([{"id": v.get("id"), "name": v.get("name"), "distance": round(v["_distance"], 2)} for v in venues])
        
        # Send ONE push per cluster
        if push_token:
            try:
                await send_push_notification(push_token, title, body, data)
                notifications_sent += 1
                logger.info(f"Geofence push: cluster={cluster}, venues={len(venues)}, user={user_id}")
            except Exception as e:
                logger.error(f"Geofence push failed: {e}")
    
    return {
        "triggered": triggered_zones,
        "notifications_sent": notifications_sent,
        "message": f"Entered {len(triggered_zones)} zone(s), {notifications_sent} notification(s) sent"
    }


@router.get("/my-triggers")
async def get_my_triggers(
    limit: int = 20,
    authorization: str = Header(None)
):
    """Get user's recent geofence trigger history"""
    user = get_current_user(authorization)
    
    triggers = await db.geofence_triggers.find(
        {"user_id": user.get("user_id")},
        {"_id": 0}
    ).sort("triggered_at", -1).limit(limit).to_list(limit)
    
    return {"triggers": triggers}


# ============ Admin Endpoints ============

@router.get("/admin/all")
async def get_all_geofences(authorization: str = Header(None)):
    """Get all geofences (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    geofences = await db.geofences.find({}, {"_id": 0}).to_list(100)
    return {"geofences": geofences, "total": len(geofences)}


@router.post("/admin/create")
async def create_geofence(
    geofence: GeofenceCreate,
    authorization: str = Header(None)
):
    """Create a new geofence zone (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    geofence_id = str(uuid.uuid4())[:8].upper()
    
    geofence_doc = {
        "id": f"GEO_{geofence_id}",
        "name": geofence.name,
        "latitude": geofence.latitude,
        "longitude": geofence.longitude,
        "radius": geofence.radius,
        "notification_title": geofence.notification_title,
        "notification_body": geofence.notification_body,
        "venue_id": geofence.venue_id,
        "is_active": geofence.is_active,
        "created_by": user.get("user_id"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.geofences.insert_one(geofence_doc)
    
    # Remove _id for response
    geofence_doc.pop("_id", None)
    
    return {
        "success": True,
        "message": f"Geofence '{geofence.name}' created successfully",
        "geofence": clean_mongo_doc(geofence_doc)
    }


@router.put("/admin/{geofence_id}")
async def update_geofence(
    geofence_id: str,
    updates: GeofenceUpdate,
    authorization: str = Header(None)
):
    """Update a geofence zone (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.geofences.find_one({"id": geofence_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.geofences.update_one(
        {"id": geofence_id},
        {"$set": update_data}
    )
    
    updated = await db.geofences.find_one({"id": geofence_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": "Geofence updated successfully",
        "geofence": clean_mongo_doc(updated)
    }


@router.delete("/admin/{geofence_id}")
async def delete_geofence(
    geofence_id: str,
    authorization: str = Header(None)
):
    """Delete a geofence zone (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.geofences.find_one({"id": geofence_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    await db.geofences.delete_one({"id": geofence_id})
    
    # Also delete associated triggers
    await db.geofence_triggers.delete_many({"geofence_id": geofence_id})
    
    return {
        "success": True,
        "message": f"Geofence '{existing.get('name')}' deleted successfully"
    }


@router.get("/admin/analytics")
async def get_geofence_analytics(
    period: str = "week",
    authorization: str = Header(None)
):
    """Get geofence trigger analytics (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(weeks=1)
    
    # Get trigger counts by geofence
    pipeline = [
        {"$match": {"triggered_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$geofence_id",
            "geofence_name": {"$first": "$geofence_name"},
            "count": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"}
        }},
        {"$project": {
            "geofence_id": "$_id",
            "geofence_name": 1,
            "trigger_count": "$count",
            "unique_users": {"$size": "$unique_users"},
            "_id": 0
        }},
        {"$sort": {"trigger_count": -1}}
    ]
    
    stats = await db.geofence_triggers.aggregate(pipeline).to_list(100)
    
    # Total triggers
    total_triggers = await db.geofence_triggers.count_documents({"triggered_at": {"$gte": start_date}})
    
    # Total unique users
    unique_users_list = await db.geofence_triggers.distinct("user_id", {"triggered_at": {"$gte": start_date}})
    unique_users = len(unique_users_list)
    
    return {
        "period": period,
        "total_triggers": total_triggers,
        "unique_users": unique_users,
        "by_geofence": stats
    }


# ============ Seed Default Geofences ============

async def seed_default_geofences():
    """Create default geofences for Luna Group venues with 1km radius"""
    # Always reseed to update messages and radius
    await db.geofences.delete_many({})
    
    default_geofences = [
        {
            "id": "GEO_ECLIPSE",
            "name": "Eclipse Brisbane",
            "latitude": -27.4572,
            "longitude": 153.0347,
            "radius": 1000,
            "notification_title": "Your table is waiting",
            "notification_body": "Eclipse has something special on tonight. Open the app to see what's happening.",
            "venue_id": "eclipse",
            "cluster": "brisbane_cbd",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_AFTERDARK",
            "name": "After Dark Brisbane",
            "latitude": -27.4580,
            "longitude": 153.0345,
            "radius": 1000,
            "notification_title": "Tonight's lineup just dropped",
            "notification_body": "After Dark has a stacked night ahead. Check your app for the details.",
            "venue_id": "after_dark",
            "cluster": "brisbane_cbd",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_SUCASA_BNE",
            "name": "Su Casa Brisbane",
            "latitude": -27.4572,
            "longitude": 153.0347,
            "radius": 1000,
            "notification_title": "Rooftop weather is perfect right now",
            "notification_body": "Su Casa has a vibe tonight. Tap to see what's on and skip the line.",
            "venue_id": "su_casa_brisbane",
            "cluster": "brisbane_cbd",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_NIGHTMARKET",
            "name": "Night Market Brisbane",
            "latitude": -27.4575,
            "longitude": 153.0350,
            "radius": 1000,
            "notification_title": "The woks are firing tonight",
            "notification_body": "Night Market has new dishes and late-night energy. Open the app for tonight's specials.",
            "venue_id": "night_market",
            "cluster": "brisbane_cbd",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_EMBERASH",
            "name": "Ember & Ash",
            "latitude": -27.4698,
            "longitude": 153.0251,
            "radius": 1000,
            "notification_title": "Fire-grilled perfection awaits",
            "notification_body": "Ember & Ash has premium cuts and cocktails ready. Check your app for tonight's menu.",
            "venue_id": "ember_ash",
            "cluster": "brisbane_south",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_SUCASA_GC",
            "name": "Su Casa Gold Coast",
            "latitude": -28.0033,
            "longitude": 153.4300,
            "radius": 1000,
            "notification_title": "Coast vibes are calling",
            "notification_body": "Something good is happening tonight. Open the app and see what's on.",
            "venue_id": "su_casa_gold_coast",
            "cluster": "gold_coast_surfers",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_JUJU",
            "name": "Juju Mermaid Beach",
            "latitude": -28.0450,
            "longitude": 153.4380,
            "radius": 1000,
            "notification_title": "Good food, good night",
            "notification_body": "Juju has your favourite dishes and a great atmosphere tonight. Check it out.",
            "venue_id": "juju",
            "cluster": "gold_coast_mermaid",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_BAVARIAN",
            "name": "The Bavarian Gold Coast",
            "latitude": -28.0028,
            "longitude": 153.4298,
            "radius": 1000,
            "notification_title": "Pretzels and steins on tap",
            "notification_body": "The Bavarian has a great night ahead. Open the app to see what's happening.",
            "venue_id": "bavarian",
            "cluster": "gold_coast_surfers",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
    ]
    
    await db.geofences.insert_many(default_geofences)
    logger.info(f"Seeded {len(default_geofences)} geofences (1km radius, clustered)")
    return {"message": f"Seeded {len(default_geofences)} geofences", "count": len(default_geofences)}


@router.post("/seed")
async def seed_geofences():
    """Seed default geofences for Luna Group venues"""
    return await seed_default_geofences()
