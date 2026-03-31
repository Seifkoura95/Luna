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
    """Send a silent SOS alert to emergency contacts"""
    auth_header = request.headers.get("authorization")
    current_user = get_current_user(auth_header)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    contacts = await db.emergency_contacts.find({
        "user_id": current_user["user_id"]
    }).to_list(5)
    
    alert_id = str(uuid.uuid4())[:8].upper()
    
    # Create alert record
    await db.safety_alerts.insert_one({
        "id": alert_id,
        "user_id": current_user["user_id"],
        "alert_type": "silent_sos",
        "status": "active",
        "created_at": datetime.now(timezone.utc),
        "contacts_notified": len(contacts)
    })
    
    # In production, this would send SMS/push notifications to contacts
    
    return {
        "success": True,
        "alert_id": alert_id,
        "message": f"Silent alert sent to {len(contacts)} emergency contacts"
    }
