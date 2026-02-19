"""
CherryHub integration data models
"""

from pydantic import BaseModel, EmailStr
from typing import Optional


class CherryHubRegisterRequest(BaseModel):
    sync_existing: bool = False


class WalletPassRequest(BaseModel):
    platform: str  # ios or android


class BuyPointsRequest(BaseModel):
    package_id: str
    points: int
    price: float
    bonus: int = 0
    payment_method: str = "card"  # card, apple_pay, google_pay
