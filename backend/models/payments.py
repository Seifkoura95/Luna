"""
Payment related data models
"""

from pydantic import BaseModel
from typing import Optional, List


class PaymentIntentRequest(BaseModel):
    amount: float
    currency: str = "aud"
    description: Optional[str] = None


class SplitPaymentRequest(BaseModel):
    crew_id: str
    total_amount: float
    split_method: str = "equal"  # equal, custom, host_pays


class ApplyPromoRequest(BaseModel):
    promo_code: str
