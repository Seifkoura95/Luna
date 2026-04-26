"""
Rewards and missions related data models
"""

from pydantic import BaseModel
from typing import Optional


class MissionProgressRequest(BaseModel):
    mission_id: str
    progress_increment: int = 1
    user_id: Optional[str] = None  # admin override target (optional)
