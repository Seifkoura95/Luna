"""
Social features data models
"""

from pydantic import BaseModel
from typing import Optional


class FriendRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None


class LostItemReport(BaseModel):
    venue_id: str
    item_description: str
    item_category: str  # phone, wallet, keys, bag, clothing, jewelry, other
    lost_date: str
    lost_time_approx: Optional[str] = None
    contact_phone: Optional[str] = None
    photo_url: Optional[str] = None


class FoundItemReport(BaseModel):
    venue_id: str
    item_description: str
    item_category: str
    found_date: str
    found_location: Optional[str] = None  # e.g., "near bar", "bathroom", "dance floor"
    photo_url: Optional[str] = None


class LostFoundMessage(BaseModel):
    item_id: str
    message: str
