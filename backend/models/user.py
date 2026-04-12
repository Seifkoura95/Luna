"""
User account related data models
"""

from pydantic import BaseModel
from typing import Optional


class RecordSpendingRequest(BaseModel):
    user_id: str
    venue_id: str
    amount: float
    category: str = "general"  # drinks, food, entry, booth, other


class SubscribeRequest(BaseModel):
    tier: str  # lunar, eclipse, aurora
    billing_period: str = "monthly"  # monthly, annual
