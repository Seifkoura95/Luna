"""
Venues API endpoints
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone

from luna_venues_config import LUNA_VENUES

router = APIRouter(prefix="/venues", tags=["Venues"])


@router.get("")
async def get_venues(region: Optional[str] = None):
    """Get all venues, optionally filtered by region"""
    venues = list(LUNA_VENUES.values())
    if region:
        venues = [v for v in venues if v["region"] == region]
    return venues


@router.get("/{venue_id}")
async def get_venue(venue_id: str):
    """Get a specific venue by ID with live status"""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    venue = LUNA_VENUES[venue_id].copy()
    now = datetime.now(timezone.utc)
    hour = now.hour
    if venue["type"] in ["nightclub", "bar"]:
        if 22 <= hour or hour < 3:
            venue["status"] = "busy"
        elif 20 <= hour < 22:
            venue["status"] = "open"
        else:
            venue["status"] = "closed"
    return venue
