"""
Safety API - Emergency, SOS, and safety features
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime, timezone

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs
from luna_venues_config import LUNA_VENUES

router = APIRouter(prefix="/safety", tags=["safety"])


class IncidentReportRequest(BaseModel):
    venue_id: str
    incident_type: str
    description: str
    location_details: Optional[str] = None


class LostPropertyRequest(BaseModel):
    venue_id: str
    item_description: str
    date_lost: str
    contact_phone: Optional[str] = None


class SafetyAlertRequest(BaseModel):
    alert_type: str
    venue_id: Optional[str] = None
    crew_id: Optional[str] = None
    message: Optional[str] = None
    location: Optional[dict] = None


class EmergencyContactRequest(BaseModel):
    name: str
    phone: str
    relationship: str


@router.post("/report-incident")
async def report_incident(request: Request, report: IncidentReportRequest):
    """Report a safety incident"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    incident_id = str(uuid.uuid4())[:8].upper()
    incident = {
        "id": incident_id,
        "user_id": current_user["user_id"],
        "venue_id": report.venue_id,
        "incident_type": report.incident_type,
        "description": report.description,
        "location_details": report.location_details,
        "status": "reported",
        "created_at": datetime.now(timezone.utc),
        "reference_number": f"INC-{incident_id}"
    }
    
    await db.incidents.insert_one(incident)
    
    return {
        "success": True,
        "reference_number": incident["reference_number"],
        "message": "Incident reported. Our security team has been notified."
    }


@router.post("/lost-property")
async def report_lost_property(request: Request, report: LostPropertyRequest):
    """Report lost property"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    report_id = str(uuid.uuid4())[:8].upper()
    lost_item = {
        "id": report_id,
        "user_id": current_user["user_id"],
        "venue_id": report.venue_id,
        "item_description": report.item_description,
        "date_lost": report.date_lost,
        "contact_phone": report.contact_phone,
        "status": "submitted",
        "created_at": datetime.now(timezone.utc),
        "reference_number": f"LP-{report_id}"
    }
    
    await db.lost_property.insert_one(lost_item)
    
    return {
        "success": True,
        "reference_number": lost_item["reference_number"],
        "message": "Lost property report submitted. We'll contact you if found."
    }


@router.get("/rideshare-links")
async def get_rideshare_links(venue_id: str):
    """Get rideshare deep links for a venue"""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    
    venue = LUNA_VENUES[venue_id]
    lat = venue["coordinates"]["lat"]
    lng = venue["coordinates"]["lng"]
    
    return {
        "uber": f"uber://?action=setPickup&pickup=my_location&dropoff[latitude]={lat}&dropoff[longitude]={lng}",
        "uber_web": f"https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]={lat}&dropoff[longitude]={lng}",
        "didi": f"https://page.udache.com/ride/order?dlat={lat}&dlng={lng}",
        "venue_address": venue["address"]
    }


@router.get("/emergency-services")
async def get_emergency_services(venue_id: Optional[str] = None):
    """Get emergency services contact numbers"""
    contacts = {
        "emergency": "000",
        "police_non_emergency": "131 444",
        "lifeline": "13 11 14",
        "luna_security": "1800 LUNA 00",
        "venue_security": None
    }
    
    if venue_id and venue_id in LUNA_VENUES:
        venue = LUNA_VENUES[venue_id]
        contacts["venue_name"] = venue["name"]
        contacts["venue_address"] = venue["address"]
    
    return contacts


@router.get("/emergency-contacts")
async def get_emergency_contacts(venue_id: Optional[str] = None):
    """Get emergency contacts list for safety page"""
    contacts = [
        {"name": "Emergency Services", "number": "000", "type": "emergency"},
        {"name": "Police (Non-Emergency)", "number": "131 444", "type": "police"},
        {"name": "Lifeline Australia", "number": "13 11 14", "type": "support"},
        {"name": "Luna Security", "number": "1800 LUNA 00", "type": "security"},
    ]
    if venue_id and venue_id in LUNA_VENUES:
        venue = LUNA_VENUES[venue_id]
        contacts.append({"name": f"{venue['name']} Security", "number": venue.get("phone", "N/A"), "type": "venue"})
    return {"contacts": contacts}



@router.post("/alert")
async def send_safety_alert(request: Request, alert_req: SafetyAlertRequest):
    """Send a safety alert to crew members or venue security"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    alert_id = str(uuid.uuid4())[:8].upper()
    alert = {
        "id": alert_id,
        "user_id": current_user["user_id"],
        "alert_type": alert_req.alert_type,
        "venue_id": alert_req.venue_id,
        "crew_id": alert_req.crew_id,
        "message": alert_req.message,
        "location": alert_req.location,
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "acknowledged_by": [],
        "resolved": False
    }
    
    await db.safety_alerts.insert_one(alert)
    
    # If crew alert, notify crew members
    if alert_req.crew_id:
        crew = await db.crews.find_one({"id": alert_req.crew_id})
        if crew:
            for member in crew.get("members", []):
                if member["user_id"] != current_user["user_id"]:
                    await db.notifications.insert_one({
                        "id": str(uuid.uuid4())[:8],
                        "user_id": member["user_id"],
                        "type": "safety_alert",
                        "title": "Safety Alert",
                        "message": f"Your friend needs help! {alert_req.message or 'Check your crew.'}",
                        "data": {"alert_id": alert_id, "crew_id": alert_req.crew_id},
                        "priority": "high",
                        "read": False,
                        "created_at": datetime.now(timezone.utc)
                    })
    
    return {
        "success": True,
        "alert_id": alert_id,
        "message": "Safety alert sent"
    }


@router.get("/alerts/active")
async def get_active_alerts(request: Request):
    """Get active safety alerts for user's crews"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    # Get user's crews
    crews = await db.crews.find({
        "members.user_id": current_user["user_id"]
    }).to_list(50)
    
    crew_ids = [c["id"] for c in crews]
    
    # Get active alerts for these crews
    alerts = await db.safety_alerts.find({
        "$or": [
            {"crew_id": {"$in": crew_ids}},
            {"user_id": current_user["user_id"]}
        ],
        "resolved": False
    }).sort("created_at", -1).to_list(20)
    
    return clean_mongo_docs(alerts)


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(request: Request, alert_id: str):
    """Acknowledge a safety alert"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.safety_alerts.update_one(
        {"id": alert_id},
        {"$addToSet": {"acknowledged_by": {
            "user_id": current_user["user_id"],
            "at": datetime.now(timezone.utc)
        }}}
    )
    
    return {"success": result.modified_count > 0}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(request: Request, alert_id: str):
    """Mark a safety alert as resolved"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.safety_alerts.update_one(
        {"id": alert_id, "user_id": current_user["user_id"]},
        {"$set": {
            "resolved": True,
            "resolved_at": datetime.now(timezone.utc)
        }}
    )
    
    return {"success": result.modified_count > 0}


@router.get("/notifications")
async def get_safety_notifications(request: Request):
    """Get safety-related notifications"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    notifications = await db.notifications.find({
        "user_id": current_user["user_id"],
        "type": {"$in": ["safety_alert", "location_share", "emergency"]}
    }).sort("created_at", -1).to_list(20)
    
    return clean_mongo_docs(notifications)


@router.get("/emergency-contacts")
async def get_emergency_contacts(request: Request):
    """Get user's emergency contacts"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    contacts = await db.emergency_contacts.find({
        "user_id": current_user["user_id"]
    }).to_list(10)
    
    return clean_mongo_docs(contacts)


@router.post("/emergency-contacts")
async def add_emergency_contact(request: Request, contact: EmergencyContactRequest):
    """Add an emergency contact"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    contact_doc = {
        "id": str(uuid.uuid4())[:8],
        "user_id": current_user["user_id"],
        "name": contact.name,
        "phone": contact.phone,
        "relationship": contact.relationship,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.emergency_contacts.insert_one(contact_doc)
    
    return {"success": True, "contact": clean_mongo_doc(contact_doc)}


@router.delete("/emergency-contacts/{contact_id}")
async def delete_emergency_contact(request: Request, contact_id: str):
    """Delete an emergency contact"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    result = await db.emergency_contacts.delete_one({
        "id": contact_id,
        "user_id": current_user["user_id"]
    })
    
    return {"success": result.deleted_count > 0}


@router.post("/silent-alert")
async def send_silent_alert(request: Request):
    """Send a silent SOS alert.

    Body: { latitude: float, longitude: float, venue_id?: str, activation_method?: str }

    Actions:
    1. Persists the alert with GPS coords and a Google Maps link.
    2. If no `venue_id` supplied, resolves the closest Luna venue (within 2 km).
    3. Notifies in-app + push to:
         - the user's crew members (all crews they belong to)
         - every `venue_manager` / `venue_staff` / `staff` assigned to the matched venue
         - every `admin` / `super_admin` (Luna ops)
    4. Logs emergency contacts count (SMS dispatch will be wired to Twilio in a later pass).
    """
    from math import radians, sin, cos, asin, sqrt
    from routes.shared import send_push_notification_to_token

    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    user_id = current_user["user_id"]

    # --- Parse body (tolerant; a panic alert must never fail on bad JSON) ---
    body: dict = {}
    try:
        body = await request.json()
    except Exception:
        body = {}

    def _f(v):
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    latitude = _f(body.get("latitude"))
    longitude = _f(body.get("longitude"))
    venue_id = body.get("venue_id")
    activation_method = body.get("activation_method") or "button"
    message = body.get("message")

    # --- Resolve nearest Luna venue if not supplied ---
    def _haversine_km(lat1, lon1, lat2, lon2):
        r = 6371.0
        lat1r, lon1r, lat2r, lon2r = map(radians, [lat1, lon1, lat2, lon2])
        dlat = lat2r - lat1r
        dlon = lon2r - lon1r
        a = sin(dlat / 2) ** 2 + cos(lat1r) * cos(lat2r) * sin(dlon / 2) ** 2
        return 2 * r * asin(sqrt(a))

    resolved_venue_id = venue_id if venue_id in LUNA_VENUES else None
    nearest_distance_km: Optional[float] = None
    if not resolved_venue_id and latitude is not None and longitude is not None:
        closest_id: Optional[str] = None
        closest_km: Optional[float] = None
        for vid, v in LUNA_VENUES.items():
            coords = v.get("coordinates") or {}
            vlat, vlng = coords.get("lat"), coords.get("lng")
            if vlat is None or vlng is None:
                continue
            km = _haversine_km(latitude, longitude, vlat, vlng)
            if closest_km is None or km < closest_km:
                closest_km, closest_id = km, vid
        if closest_id is not None and closest_km is not None and closest_km <= 2.0:
            resolved_venue_id = closest_id
            nearest_distance_km = round(closest_km, 3)

    resolved_venue_name: Optional[str] = None
    if resolved_venue_id:
        resolved_venue_name = LUNA_VENUES[resolved_venue_id].get("name")

    location_link: Optional[str] = None
    if latitude is not None and longitude is not None:
        location_link = f"https://www.google.com/maps/search/?api=1&query={latitude},{longitude}"

    # --- Gather user, crews, contacts ---
    user_record = await db.users.find_one({"user_id": user_id}) or {}
    user_name = user_record.get("name") or "Luna member"

    emergency_contacts = await db.emergency_contacts.find(
        {"user_id": user_id}
    ).to_list(20)

    crews = await db.crews.find({"members.user_id": user_id}).to_list(20)
    crew_member_ids: set[str] = set()
    for crew in crews:
        for m in crew.get("members", []) or []:
            mid = m.get("user_id")
            if mid and mid != user_id:
                crew_member_ids.add(mid)

    # Venue staff (manager + any staff assigned to the matched venue)
    venue_staff_query: dict = {"role": {"$in": ["venue_manager", "venue_staff", "staff", "manager"]}}
    if resolved_venue_id:
        venue_staff_query = {
            "$or": [
                {"role": {"$in": ["venue_manager", "venue_staff", "staff", "manager"]}, "venue_id": resolved_venue_id},
                {"role": {"$in": ["venue_manager", "venue_staff", "staff", "manager"]}, "assigned_venue_id": resolved_venue_id},
            ]
        }
    venue_staff = await db.users.find(venue_staff_query, {"_id": 0, "user_id": 1, "push_tokens": 1, "name": 1, "role": 1}).to_list(50)

    # Luna ops admins (always notified)
    admin_users = await db.users.find(
        {"role": {"$in": ["admin", "super_admin"]}},
        {"_id": 0, "user_id": 1, "push_tokens": 1, "name": 1},
    ).to_list(20)

    # --- Persist alert ---
    now = datetime.now(timezone.utc)
    alert_id = str(uuid.uuid4())[:8].upper()
    alert_doc = {
        "id": alert_id,
        "user_id": user_id,
        "user_name": user_name,
        "alert_type": "silent_sos",
        "activation_method": activation_method,
        "status": "active",
        "resolved": False,
        "acknowledged_by": [],
        "message": message,
        "location": (
            {"latitude": latitude, "longitude": longitude, "link": location_link}
            if latitude is not None and longitude is not None
            else None
        ),
        "venue_id": resolved_venue_id,
        "venue_name": resolved_venue_name,
        "nearest_distance_km": nearest_distance_km,
        "emergency_contacts_count": len(emergency_contacts),
        "crew_members_count": len(crew_member_ids),
        "venue_staff_count": len(venue_staff),
        "admin_count": len(admin_users),
        "created_at": now,
    }
    await db.safety_alerts.insert_one(alert_doc)

    # --- Notify crew members ---
    notified_crew: List[str] = []
    for mid in crew_member_ids:
        try:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4())[:10],
                "user_id": mid,
                "type": "safety_alert",
                "title": "🚨 Crew Safety Alert",
                "message": f"{user_name} has triggered a silent alert. Tap for their live location.",
                "data": {
                    "alert_id": alert_id,
                    "triggered_by": user_id,
                    "latitude": latitude,
                    "longitude": longitude,
                    "location_link": location_link,
                    "venue_id": resolved_venue_id,
                    "venue_name": resolved_venue_name,
                    "screen": "safety-alert",
                },
                "priority": "high",
                "read": False,
                "created_at": now,
            })
            crew_user = await db.users.find_one({"user_id": mid}, {"_id": 0, "push_tokens": 1})
            for tok in (crew_user or {}).get("push_tokens", []) or []:
                try:
                    await send_push_notification_to_token(
                        token=tok,
                        title="🚨 Crew Safety Alert",
                        body=f"{user_name} needs help. Tap to see their live location.",
                        data={"type": "safety_alert", "alert_id": alert_id, "screen": "safety-alert"},
                    )
                except Exception:
                    pass
            notified_crew.append(mid)
        except Exception:
            pass

    # --- Notify venue staff/manager with the exact location ---
    notified_venue_staff: List[str] = []
    for staff in venue_staff:
        sid = staff.get("user_id")
        if not sid:
            continue
        try:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4())[:10],
                "user_id": sid,
                "type": "safety_alert_staff",
                "title": f"🚨 Patron Silent Alert{' — ' + resolved_venue_name if resolved_venue_name else ''}",
                "message": (
                    f"{user_name} triggered a silent SOS."
                    + (f" GPS: {latitude:.6f}, {longitude:.6f}" if latitude is not None and longitude is not None else "")
                ),
                "data": {
                    "alert_id": alert_id,
                    "triggered_by": user_id,
                    "user_name": user_name,
                    "latitude": latitude,
                    "longitude": longitude,
                    "location_link": location_link,
                    "venue_id": resolved_venue_id,
                    "venue_name": resolved_venue_name,
                    "nearest_distance_km": nearest_distance_km,
                    "screen": "admin-safety",
                },
                "priority": "high",
                "read": False,
                "created_at": now,
            })
            for tok in staff.get("push_tokens", []) or []:
                try:
                    loc_suffix = (
                        f" — {latitude:.5f}, {longitude:.5f}"
                        if latitude is not None and longitude is not None
                        else ""
                    )
                    await send_push_notification_to_token(
                        token=tok,
                        title=f"🚨 Silent SOS{' at ' + resolved_venue_name if resolved_venue_name else ''}",
                        body=f"{user_name} needs help.{loc_suffix}",
                        data={
                            "type": "safety_alert_staff",
                            "alert_id": alert_id,
                            "location_link": location_link,
                            "screen": "admin-safety",
                        },
                    )
                except Exception:
                    pass
            notified_venue_staff.append(sid)
        except Exception:
            pass

    # --- Notify admins (Luna ops) ---
    notified_admins: List[str] = []
    for adm in admin_users:
        aid = adm.get("user_id")
        if not aid:
            continue
        try:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4())[:10],
                "user_id": aid,
                "type": "safety_alert_admin",
                "title": "🚨 Silent SOS — Luna Ops",
                "message": (
                    f"{user_name}{' at ' + resolved_venue_name if resolved_venue_name else ''} "
                    f"triggered a silent alert."
                ),
                "data": {
                    "alert_id": alert_id,
                    "triggered_by": user_id,
                    "user_name": user_name,
                    "latitude": latitude,
                    "longitude": longitude,
                    "location_link": location_link,
                    "venue_id": resolved_venue_id,
                    "venue_name": resolved_venue_name,
                    "screen": "admin-safety",
                },
                "priority": "high",
                "read": False,
                "created_at": now,
            })
            for tok in adm.get("push_tokens", []) or []:
                try:
                    await send_push_notification_to_token(
                        token=tok,
                        title="🚨 Silent SOS (Luna Ops)",
                        body=(
                            f"{user_name}"
                            + (f" at {resolved_venue_name}" if resolved_venue_name else "")
                            + " triggered an alert."
                        ),
                        data={"type": "safety_alert_admin", "alert_id": alert_id, "screen": "admin-safety"},
                    )
                except Exception:
                    pass
            notified_admins.append(aid)
        except Exception:
            pass

    return {
        "success": True,
        "alert_id": alert_id,
        "message": "Silent alert dispatched.",
        "location_link": location_link,
        "notified": {
            "crew": notified_crew,
            "emergency_contacts": [c.get("name") for c in emergency_contacts],
            "venue": resolved_venue_name,
            "venue_staff_count": len(notified_venue_staff),
            "admin_count": len(notified_admins),
        },
    }
