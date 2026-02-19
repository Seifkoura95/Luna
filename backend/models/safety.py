"""
Safety related data models
"""

from pydantic import BaseModel
from typing import Optional


class IncidentReportRequest(BaseModel):
    venue_id: str
    incident_type: str  # harassment, emergency, other
    description: str
    location_details: Optional[str] = None


class LostPropertyRequest(BaseModel):
    venue_id: str
    item_description: str
    date_lost: str
    contact_phone: Optional[str] = None


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    heading: Optional[float] = None
    speed: Optional[float] = None


class SafetyAlertRequest(BaseModel):
    alert_type: str  # "emergency", "uncomfortable", "need_help", "lost"
    latitude: float
    longitude: float
    venue_id: Optional[str] = None


class EmergencyContact(BaseModel):
    name: str
    phone: str
    relationship: str  # friend, family, partner, other
    email: Optional[str] = None


class SilentAlertRequest(BaseModel):
    latitude: float
    longitude: float
    venue_id: Optional[str] = None
    activation_method: str = "button"  # button, shake, hidden
