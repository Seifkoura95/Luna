"""
Venues API endpoints
"""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime, timezone, timedelta

from luna_venues_config import LUNA_VENUES
from database import db

router = APIRouter(prefix="/venues", tags=["Venues"])


# ── Default VIP Table Inventory per Venue ─────────────────────────────────────
VENUE_TABLES = {
    "eclipse": [
        {"id": "ecl_vip1", "name": "VIP Booth A", "location": "Main Floor - Left", "capacity": 8, "min_spend": 500, "deposit_amount": 200, "features": ["Bottle Service", "Dedicated Host", "Premium Sound"], "image_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600"},
        {"id": "ecl_vip2", "name": "VIP Booth B", "location": "Main Floor - Right", "capacity": 6, "min_spend": 400, "deposit_amount": 150, "features": ["Bottle Service", "Dedicated Host"], "image_url": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600"},
        {"id": "ecl_sky", "name": "Sky Lounge", "location": "Upper Level", "capacity": 12, "min_spend": 1200, "deposit_amount": 500, "features": ["Premium Bottles", "Private Bar", "City Views", "DJ Requests"], "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600"},
        {"id": "ecl_stage", "name": "Stage Side", "location": "DJ Stage", "capacity": 10, "min_spend": 800, "deposit_amount": 300, "features": ["Stage Access", "Bottle Service", "VIP Wristbands"], "image_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600"},
    ],
    "after_dark": [
        {"id": "ad_vip1", "name": "R&B Lounge", "location": "Main Room", "capacity": 8, "min_spend": 400, "deposit_amount": 150, "features": ["Bottle Service", "Dedicated Host"], "image_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600"},
        {"id": "ad_vip2", "name": "VIP Corner", "location": "Corner Booth", "capacity": 6, "min_spend": 300, "deposit_amount": 100, "features": ["Bottle Service", "Premium Sound"], "image_url": "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=600"},
        {"id": "ad_ultra", "name": "Ultra VIP Suite", "location": "Private Suite", "capacity": 15, "min_spend": 1500, "deposit_amount": 600, "features": ["Private Suite", "Personal Bar", "Guest List +10", "Security"], "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600"},
    ],
    "su_casa_brisbane": [
        {"id": "scb_roof1", "name": "Rooftop Booth", "location": "Rooftop Terrace", "capacity": 8, "min_spend": 350, "deposit_amount": 150, "features": ["City Views", "Bottle Service"], "image_url": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600"},
        {"id": "scb_roof2", "name": "Sunset Lounge", "location": "West Terrace", "capacity": 6, "min_spend": 250, "deposit_amount": 100, "features": ["Sunset Views", "Cocktail Menu"], "image_url": "https://images.unsplash.com/photo-1517263904808-5dc91e3e7044?w=600"},
        {"id": "scb_prem", "name": "Premium Deck", "location": "Upper Deck", "capacity": 12, "min_spend": 600, "deposit_amount": 250, "features": ["Panoramic Views", "Premium Bottles", "Private Area"], "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600"},
    ],
    "su_casa_gold_coast": [
        {"id": "scgc_vip1", "name": "VIP Section", "location": "Main Room", "capacity": 8, "min_spend": 400, "deposit_amount": 150, "features": ["Bottle Service", "Dedicated Host"], "image_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600"},
        {"id": "scgc_vip2", "name": "Ocean View Booth", "location": "Balcony", "capacity": 6, "min_spend": 300, "deposit_amount": 100, "features": ["Ocean Views", "Bottle Service"], "image_url": "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600"},
    ],
    "juju": [
        {"id": "juju_prv", "name": "Private Dining Room", "location": "Back Room", "capacity": 10, "min_spend": 500, "deposit_amount": 100, "features": ["Private Room", "Custom Menu", "Dedicated Staff"], "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600"},
        {"id": "juju_terr", "name": "Terrace Table", "location": "Outdoor Terrace", "capacity": 6, "min_spend": 200, "deposit_amount": 50, "features": ["Outdoor Seating", "Ocean Breeze"], "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600"},
    ],
    "night_market": [
        {"id": "nm_grp", "name": "Group Table", "location": "Main Hall", "capacity": 8, "min_spend": 200, "deposit_amount": 50, "features": ["Group Dining", "Shared Plates"], "image_url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600"},
        {"id": "nm_prv", "name": "Private Laneway", "location": "Hidden Laneway", "capacity": 12, "min_spend": 400, "deposit_amount": 100, "features": ["Private Area", "Custom Menu", "Neon Decor"], "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600"},
    ],
    "ember_and_ash": [
        {"id": "ea_fire", "name": "Fireside Table", "location": "Main Dining", "capacity": 4, "min_spend": 300, "deposit_amount": 75, "features": ["Fire View", "Premium Cuts"], "image_url": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600"},
        {"id": "ea_chef", "name": "Chef's Table", "location": "Kitchen View", "capacity": 6, "min_spend": 600, "deposit_amount": 150, "features": ["Chef's Tasting", "Wine Pairing", "Kitchen View"], "image_url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600"},
        {"id": "ea_roof", "name": "Rooftop Private", "location": "Rooftop", "capacity": 10, "min_spend": 800, "deposit_amount": 250, "features": ["Private Rooftop", "Cocktail Bar", "City Views"], "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600"},
    ],
    "pump": [
        {"id": "pump_vip", "name": "Mainstage Booth", "location": "Stage Front", "capacity": 8, "min_spend": 500, "deposit_amount": 200, "features": ["Stage Front", "LED Wall", "Bottle Service"], "image_url": "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600"},
        {"id": "pump_ultra", "name": "Ultra VIP", "location": "Mezzanine", "capacity": 12, "min_spend": 1000, "deposit_amount": 400, "features": ["Mezzanine View", "Premium Bottles", "Security", "DJ Requests"], "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600"},
    ],
    "mamacita": [
        {"id": "mama_vip", "name": "Latin Lounge", "location": "Main Floor", "capacity": 8, "min_spend": 400, "deposit_amount": 150, "features": ["Bottle Service", "Latin Vibes", "Dedicated Host"], "image_url": "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=600"},
        {"id": "mama_prv", "name": "Fiesta Suite", "location": "Private Room", "capacity": 15, "min_spend": 1200, "deposit_amount": 500, "features": ["Private Suite", "Personal DJ", "Unlimited Entry"], "image_url": "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600"},
    ],
}

# Operating hours for closure detection
VENUE_OPERATING_DAYS = {
    "eclipse": ["friday", "saturday"],
    "after_dark": ["friday", "saturday"],
    "su_casa_brisbane": ["wednesday", "thursday", "friday", "saturday", "sunday"],
    "su_casa_gold_coast": ["thursday", "friday", "saturday", "sunday"],
    "juju": ["wednesday", "thursday", "friday", "saturday", "sunday"],
    "night_market": ["wednesday", "thursday", "friday", "saturday"],
    "ember_and_ash": ["wednesday", "thursday", "friday", "saturday", "sunday"],
    "pump": ["friday", "saturday"],
    "mamacita": ["friday", "saturday"],
}


async def _get_venue_overrides_map() -> dict:
    """Load all venue overrides keyed by venue_id."""
    docs = await db.venue_overrides.find({}, {"_id": 0}).to_list(100)
    return {d["venue_id"]: d for d in docs}


def _merge_override(venue: dict, override: Optional[dict]) -> dict:
    if not override:
        return venue
    merged = venue.copy()
    skip = {"venue_id", "updated_at", "created_at"}
    for k, v in override.items():
        if k in skip or v is None:
            continue
        merged[k] = v
    return merged


@router.get("")
async def get_venues(region: Optional[str] = None):
    """Get all venues, optionally filtered by region. Merges Lovable Hub overrides."""
    overrides = await _get_venue_overrides_map()
    venues = []
    for vid, v in LUNA_VENUES.items():
        merged = _merge_override(v, overrides.get(vid))
        if merged.get("is_hidden"):
            continue
        venues.append(merged)
    if region:
        venues = [v for v in venues if v.get("region") == region]
    return venues


@router.get("/{venue_id}/tables")
async def get_venue_tables(venue_id: str, date: Optional[str] = None):
    """Get available VIP tables for a venue on a given date"""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")

    venue = LUNA_VENUES[venue_id]
    tables = [t.copy() for t in VENUE_TABLES.get(venue_id, [])]

    # Check if venue is open on the requested date
    if date:
        try:
            req_date = datetime.strptime(date, "%Y-%m-%d")
            day_name = req_date.strftime("%A").lower()
            open_days = VENUE_OPERATING_DAYS.get(venue_id, [])
            if day_name not in open_days:
                return {
                    "venue_id": venue_id,
                    "tables": [],
                    "venue_closed": True,
                    "closed_reason": f"{venue['name']} is not open on {day_name.title()}s",
                }
        except ValueError:
            pass

    # Check existing bookings to mark availability
    if date:
        booked = await db.table_bookings.find(
            {"venue_id": venue_id, "date": date, "status": {"$in": ["confirmed", "pending"]}},
            {"table_id": 1, "_id": 0},
        ).to_list(100)
        booked_ids = {b["table_id"] for b in booked}
        for t in tables:
            t["available"] = t["id"] not in booked_ids
    else:
        for t in tables:
            t["available"] = True

    return {"venue_id": venue_id, "tables": tables, "venue_closed": False}


@router.get("/{venue_id}")
async def get_venue(venue_id: str):
    """Get a specific venue by ID with live status. Merges Lovable Hub overrides."""
    if venue_id not in LUNA_VENUES:
        raise HTTPException(status_code=404, detail="Venue not found")
    override = await db.venue_overrides.find_one({"venue_id": venue_id}, {"_id": 0})
    venue = _merge_override(LUNA_VENUES[venue_id].copy(), override)
    now = datetime.now(timezone.utc)
    hour = now.hour
    # If Lovable set an explicit status override, respect it; otherwise compute
    if not (override and override.get("status")):
        if venue["type"] in ["nightclub", "bar"]:
            if 22 <= hour or hour < 3:
                venue["status"] = "busy"
            elif 20 <= hour < 22:
                venue["status"] = "open"
            else:
                venue["status"] = "closed"
    return venue
