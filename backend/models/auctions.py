"""
Auction related data models
"""

from pydantic import BaseModel
from typing import Optional


class PlaceBidRequest(BaseModel):
    auction_id: str
    amount: float
    max_bid: Optional[float] = None  # For auto-bidding
    notify_outbid: bool = True  # Opt-in for outbid notifications


class AuctionSubscribeRequest(BaseModel):
    auction_id: str
