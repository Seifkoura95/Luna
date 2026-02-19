"""
Event related data models
"""

from pydantic import BaseModel
from typing import Optional


class EventRSVP(BaseModel):
    event_id: str
    status: str  # going, interested, not_going
    is_private: bool = False
