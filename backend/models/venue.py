"""
Venue related data models
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class ScanQRRequest(BaseModel):
    qr_code: str
    venue_id: str


class VenueStaffRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    venue_id: str
    role: str = "staff"


class BookingRequest(BaseModel):
    venue_id: str
    date: str  # YYYY-MM-DD format
    time: str  # HH:MM format
    party_size: int
    special_requests: Optional[str] = None
    occasion: Optional[str] = None


class GuestlistRequest(BaseModel):
    venue_id: str
    date: str  # YYYY-MM-DD format
    party_size: int
    arrival_time: Optional[str] = None
    vip_booth: bool = False


class TableBookingRequest(BaseModel):
    venue_id: str
    date: str
    time: str
    guests: int


class TableDepositRequest(BaseModel):
    booking_id: str
    amount: float
