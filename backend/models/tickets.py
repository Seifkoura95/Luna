"""
Tickets and crew related data models
"""

from pydantic import BaseModel
from typing import Optional


class PurchaseTicketRequest(BaseModel):
    event_id: str
    quantity: int = 1
    ticket_type: str = "general"  # general, vip, booth


class AddGuestRequest(BaseModel):
    ticket_id: str
    guest_name: str
    guest_email: Optional[str] = None


class CreateCrewRequest(BaseModel):
    name: str
    event_id: Optional[str] = None


class InviteToCrewRequest(BaseModel):
    crew_id: str
    email: Optional[str] = None
    user_id: Optional[str] = None


class CrewBoothBidRequest(BaseModel):
    crew_id: str
    auction_id: str
    amount: float
    split_method: str = "equal"  # equal, custom
