"""
Notifications related data models
"""

from pydantic import BaseModel
from typing import Optional, Dict, Any


class NotificationPreferences(BaseModel):
    events: bool = True
    auctions: bool = True
    rewards: bool = True
    social: bool = True
    marketing: bool = False


class PrivacySettings(BaseModel):
    profile_visible: bool = True
    location_sharing: bool = True
    activity_visible: bool = True
    friend_requests_enabled: bool = True
