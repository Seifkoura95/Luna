"""
Geofence Routes - Location-based push notifications
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import math

router = APIRouter(prefix="/api/geofences", tags=["geofences"])

# Import shared dependencies (will be injected from server.py)
db = None
get_current_user = None
send_push_notification = None

def init_router(database, auth_dependency, push_func):
    """Initialize router with dependencies"""
    global db, get_current_user, send_push_notification
    db = database
    get_current_user = auth_dependency
    send_push_notification = push_func


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


def has_triggered_today(user_id: str, geofence_id: str) -> bool:
    """Check if user has already triggered this geofence today"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    trigger = db.geofence_triggers.find_one({
        "user_id": user_id,
        "geofence_id": geofence_id,
        "triggered_at": {"$gte": today_start}
    })
    
    return trigger is not None


# ============ Public Endpoints ============

@router.get("")
async def get_active_geofences(user: dict = Depends(lambda: get_current_user)):
    """Get all active geofence zones for the mobile app"""
    geofences = list(db.geofences.find(
        {"is_active": True},
        {"_id": 0}
    ))
    return {"geofences": geofences}


@router.post("/check-location")
async def check_location(
    location: LocationUpdate,
    user: dict = Depends(lambda: get_current_user)
):
    """
    Check if user is within any geofence zones.
    Returns zones they've entered and sends push notifications.
    """
    user_id = user.get("user_id")
    
    # Check if user has location notifications enabled
    user_prefs = db.users.find_one({"user_id": user_id}, {"notification_preferences": 1})
    prefs = user_prefs.get("notification_preferences", {}) if user_prefs else {}
    
    # Default to enabled if not set
    if prefs.get("location_alerts", True) is False:
        return {"triggered": [], "message": "Location notifications disabled"}
    
    # Get all active geofences
    geofences = list(db.geofences.find({"is_active": True}))
    
    triggered_zones = []
    notifications_sent = []
    
    for geofence in geofences:
        geofence_id = geofence.get("id")
        
        # Calculate distance
        distance = haversine_distance(
            location.latitude,
            location.longitude,
            geofence.get("latitude"),
            geofence.get("longitude")
        )
        
        # Check if within radius
        if distance <= geofence.get("radius", 200):
            # Check if already triggered today
            if not has_triggered_today(user_id, geofence_id):
                # Record the trigger
                db.geofence_triggers.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "geofence_id": geofence_id,
                    "geofence_name": geofence.get("name"),
                    "distance": round(distance, 2),
                    "user_latitude": location.latitude,
                    "user_longitude": location.longitude,
                    "triggered_at": datetime.now(timezone.utc)
                })
                
                triggered_zones.append({
                    "id": geofence_id,
                    "name": geofence.get("name"),
                    "distance": round(distance, 2)
                })
                
                # Send push notification
                push_token = user.get("push_token")
                if push_token and send_push_notification:
                    try:
                        await send_push_notification(
                            push_token,
                            geofence.get("notification_title", "You're nearby!"),
                            geofence.get("notification_body", "Check in to earn points!"),
                            {
                                "type": "geofence",
                                "geofence_id": geofence_id,
                                "venue_id": geofence.get("venue_id"),
                                "action": "open_venue"
                            }
                        )
                        notifications_sent.append(geofence_id)
                    except Exception as e:
                        print(f"Failed to send push for geofence {geofence_id}: {e}")
    
    return {
        "triggered": triggered_zones,
        "notifications_sent": len(notifications_sent),
        "message": f"Entered {len(triggered_zones)} zone(s)" if triggered_zones else "Not in any geofence zones"
    }


@router.get("/my-triggers")
async def get_my_triggers(
    limit: int = 20,
    user: dict = Depends(lambda: get_current_user)
):
    """Get user's recent geofence trigger history"""
    triggers = list(db.geofence_triggers.find(
        {"user_id": user.get("user_id")},
        {"_id": 0}
    ).sort("triggered_at", -1).limit(limit))
    
    return {"triggers": triggers}


# ============ Admin Endpoints ============

@router.get("/admin/all")
async def get_all_geofences(user: dict = Depends(lambda: get_current_user)):
    """Get all geofences (admin only)"""
    if user.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    geofences = list(db.geofences.find({}, {"_id": 0}))
    return {"geofences": geofences, "total": len(geofences)}


@router.post("/admin/create")
async def create_geofence(
    geofence: GeofenceCreate,
    user: dict = Depends(lambda: get_current_user)
):
    """Create a new geofence zone (admin only)"""
    if user.get("role") not in ["admin", "venue_manager"]:
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
    
    db.geofences.insert_one(geofence_doc)
    
    # Remove _id for response
    geofence_doc.pop("_id", None)
    
    return {
        "success": True,
        "message": f"Geofence '{geofence.name}' created successfully",
        "geofence": geofence_doc
    }


@router.put("/admin/{geofence_id}")
async def update_geofence(
    geofence_id: str,
    updates: GeofenceUpdate,
    user: dict = Depends(lambda: get_current_user)
):
    """Update a geofence zone (admin only)"""
    if user.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = db.geofences.find_one({"id": geofence_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    db.geofences.update_one(
        {"id": geofence_id},
        {"$set": update_data}
    )
    
    updated = db.geofences.find_one({"id": geofence_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": "Geofence updated successfully",
        "geofence": updated
    }


@router.delete("/admin/{geofence_id}")
async def delete_geofence(
    geofence_id: str,
    user: dict = Depends(lambda: get_current_user)
):
    """Delete a geofence zone (admin only)"""
    if user.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = db.geofences.find_one({"id": geofence_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    db.geofences.delete_one({"id": geofence_id})
    
    # Also delete associated triggers
    db.geofence_triggers.delete_many({"geofence_id": geofence_id})
    
    return {
        "success": True,
        "message": f"Geofence '{existing.get('name')}' deleted successfully"
    }


@router.get("/admin/analytics")
async def get_geofence_analytics(
    period: str = "week",
    user: dict = Depends(lambda: get_current_user)
):
    """Get geofence trigger analytics (admin only)"""
    if user.get("role") not in ["admin", "venue_manager"]:
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
    
    stats = list(db.geofence_triggers.aggregate(pipeline))
    
    # Total triggers
    total_triggers = db.geofence_triggers.count_documents({"triggered_at": {"$gte": start_date}})
    
    # Total unique users
    unique_users = len(db.geofence_triggers.distinct("user_id", {"triggered_at": {"$gte": start_date}}))
    
    return {
        "period": period,
        "total_triggers": total_triggers,
        "unique_users": unique_users,
        "by_geofence": stats
    }


# ============ Seed Default Geofences ============

def seed_default_geofences():
    """Create default geofences for Luna Group venues"""
    if db is None:
        return
    
    # Check if already seeded
    if db.geofences.count_documents({}) > 0:
        return
    
    default_geofences = [
        {
            "id": "GEO_ECLIPSE",
            "name": "Eclipse Brisbane",
            "latitude": -27.4567,
            "longitude": 153.0368,
            "radius": 200,
            "notification_title": "Welcome to Eclipse!",
            "notification_body": "Check in now to earn 2x points tonight!",
            "venue_id": "eclipse",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_AFTERDARK",
            "name": "After Dark Brisbane",
            "latitude": -27.4572,
            "longitude": 153.0372,
            "radius": 200,
            "notification_title": "After Dark awaits!",
            "notification_body": "You're near After Dark - tap to join the guestlist!",
            "venue_id": "after_dark",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_SUCASA_BNE",
            "name": "Su Casa Brisbane",
            "latitude": -27.4580,
            "longitude": 153.0365,
            "radius": 200,
            "notification_title": "Su Casa is calling!",
            "notification_body": "Rooftop vibes await - check in for bonus points!",
            "venue_id": "su_casa_brisbane",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_SUCASA_GC",
            "name": "Su Casa Gold Coast",
            "latitude": -28.0024,
            "longitude": 153.4296,
            "radius": 200,
            "notification_title": "Su Casa Gold Coast!",
            "notification_body": "You're at the coast - come party with us!",
            "venue_id": "su_casa_gold_coast",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_JUJU",
            "name": "Juju Mermaid Beach",
            "latitude": -28.0456,
            "longitude": 153.4432,
            "radius": 200,
            "notification_title": "Juju time!",
            "notification_body": "Beach vibes and good times - check in now!",
            "venue_id": "juju",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    db.geofences.insert_many(default_geofences)
    print(f"Seeded {len(default_geofences)} default geofences")
