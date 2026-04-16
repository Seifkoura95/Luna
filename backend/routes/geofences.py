"""
Geofence Routes - Location-based push notifications
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone, timedelta
import uuid
import math
import logging

from database import db
from utils.auth import get_current_user
from utils.mongo import clean_mongo_doc, clean_mongo_docs

router = APIRouter(prefix="/geofences", tags=["geofences"])
logger = logging.getLogger(__name__)


# ============ Models ============

class GeofenceCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    radius: float = 200  # meters
    notification_title: str
    notification_body: str
    venue_id: Optional[str] = None
    is_active: bool = True


class GeofenceUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius: Optional[float] = None
    notification_title: Optional[str] = None
    notification_body: Optional[str] = None
    venue_id: Optional[str] = None
    is_active: Optional[bool] = None


class GeofenceTrigger(BaseModel):
    geofence_id: str
    latitude: float
    longitude: float


class LocationUpdate(BaseModel):
    latitude: float
    longitude: float


# ============ Helper Functions ============

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the distance between two points on Earth using Haversine formula.
    Returns distance in meters.
    """
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


async def has_triggered_today(user_id: str, geofence_id: str) -> bool:
    """Check if user has already triggered this geofence today"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    trigger = await db.geofence_triggers.find_one({
        "user_id": user_id,
        "geofence_id": geofence_id,
        "triggered_at": {"$gte": today_start}
    })
    
    return trigger is not None


async def send_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo"""
    import httpx
    
    message = {
        "to": push_token,
        "sound": "default",
        "title": title,
        "body": body,
        "data": data or {}
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://exp.host/--/api/v2/push/send",
            json=message,
            headers={"Content-Type": "application/json"}
        )
        return response.json()


# ============ Public Endpoints ============

@router.get("")
async def get_active_geofences(authorization: str = Header(None)):
    """Get all active geofence zones for the mobile app"""
    get_current_user(authorization)  # Validate auth
    
    geofences = await db.geofences.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"geofences": geofences}



# ============ Notification Message Library ============
# Messages are time-aware and ONLY sent during venue operating hours.
# Each venue has messages for: pre_open (1hr before), prime (peak hours), late_night
# The system picks one at random based on time of day + weekend.

import random
from datetime import datetime, timezone, timedelta

AEST = timezone(timedelta(hours=10))

def _now_aest():
    return datetime.now(AEST)


# Operating hours: {day_of_week: (open_hour, close_hour)} close > 24 = next day
VENUE_HOURS = {
    "eclipse":           {4: (21, 27), 5: (21, 27)},
    "after_dark":        {4: (21, 27), 5: (21, 27)},
    "su_casa_brisbane":  {2: (17, 27), 3: (17, 27), 4: (15, 27), 5: (15, 27), 6: (16, 27)},
    "night_market":      {3: (21, 27), 4: (21, 27), 5: (21, 27), 6: (21, 27)},
    "ember_ash":         {2: (18, 22.5), 3: (18, 23), 4: (18, 23), 5: (18, 23)},
    "su_casa_gold_coast": {2: (18, 24), 3: (18, 24), 4: (18, 24), 5: (18, 24), 6: (18, 22)},
    "juju":              {2: (12, 24), 3: (12, 24), 4: (12, 24), 5: (12, 24), 6: (11, 24)},
    "bavarian":          {4: (21, 27), 5: (21, 27)},
}


def _is_venue_open(venue_id: str) -> bool:
    now = _now_aest()
    dow = now.weekday()
    hour = now.hour + now.minute / 60
    if hour < 5:
        dow = (dow - 1) % 7
        hour += 24
    hours = VENUE_HOURS.get(venue_id, {})
    if dow not in hours:
        return False
    open_h, close_h = hours[dow]
    return (open_h - 1) <= hour <= close_h


def _get_venue_time_slot(venue_id: str) -> str:
    now = _now_aest()
    dow = now.weekday()
    hour = now.hour + now.minute / 60
    if hour < 5:
        dow = (dow - 1) % 7
        hour += 24
    hours = VENUE_HOURS.get(venue_id, {})
    if dow not in hours:
        return "prime"
    open_h, close_h = hours[dow]
    if hour < open_h:
        return "pre_open"
    elif hour >= close_h - 2:
        return "late_night"
    else:
        return "prime"


def _is_weekend() -> bool:
    return _now_aest().weekday() >= 4


# ═══════════════════════════════════════════════════════════════════════════════
# VENUE MESSAGE LIBRARY
# ═══════════════════════════════════════════════════════════════════════════════

VENUE_MESSAGES = {
    # ── ECLIPSE — Fri/Sat 9PM-3AM — Nightclub ────────────────────────────────
    "eclipse": {
        "pre_open": [
            {"title": "Your table is waiting", "body": "Eclipse has something special on tonight. Open the app to see what's happening."},
            {"title": "Lock in your night", "body": "Eclipse is about to open and it's going to be a big one. Check the lineup."},
            {"title": "Pre-game intel", "body": "See what Eclipse has on tonight before everyone else does."},
            {"title": "Tonight's looking good", "body": "Eclipse is setting up for something special. Check the app for details."},
            {"title": "Doors open soon", "body": "Eclipse is almost ready. Get your name on the list in the app."},
        ],
        "prime": [
            {"title": "The DJ just took over", "body": "Eclipse is warming up nicely. Check the app to see tonight's vibe."},
            {"title": "VIP tables are filling up", "body": "It's going to be a big one at Eclipse. See what's on tonight."},
            {"title": "New cocktail menu just dropped", "body": "Eclipse has some new creations behind the bar. Worth checking out."},
            {"title": "The night is young", "body": "Eclipse is building momentum. Open the app to see the vibe."},
            {"title": "The energy is building", "body": "Eclipse is heating up. Check the app to get involved."},
            {"title": "Booth service is on", "body": "Premium tables available at Eclipse tonight. Check the app."},
            {"title": "The crowd is electric", "body": "Eclipse is filling up fast. Skip the line with the app."},
        ],
        "late_night": [
            {"title": "The party's in full swing", "body": "Eclipse is going off right now. Skip the line with your app."},
            {"title": "Still time to join", "body": "Eclipse is buzzing. Open the app to get in quick."},
            {"title": "Last call for VIP", "body": "A few VIP spots left at Eclipse tonight. Check the app."},
            {"title": "The energy is unreal right now", "body": "Eclipse is peaking. Your name could be on the list."},
            {"title": "Peak hour at Eclipse", "body": "This is when Eclipse is at its best. Open the app."},
            {"title": "The dancefloor is calling", "body": "Eclipse is in full effect. Fast-track in the app."},
        ],
        "weekend": [
            {"title": "It's the weekend", "body": "Eclipse is going to be packed. Check the app to secure your spot."},
            {"title": "Saturday night sorted", "body": "Eclipse has the best lineup this weekend. See it in the app."},
            {"title": "Weekend mode activated", "body": "Eclipse is ready. Are you? Check what's happening tonight."},
            {"title": "Friday night at Eclipse", "body": "The best way to start the weekend. Check the app."},
        ],
    },

    # ── AFTER DARK — Fri/Sat 9PM-3AM — R&B / Hip-Hop Club ────────────────────
    "after_dark": {
        "pre_open": [
            {"title": "Tonight's lineup just dropped", "body": "After Dark has a stacked night ahead. Check your app for the details."},
            {"title": "Get on the list early", "body": "After Dark fills up fast. Open the app to plan ahead."},
            {"title": "The underground is calling", "body": "After Dark has something special tonight. Open the app to find out."},
            {"title": "Dress code: ready for anything", "body": "After Dark is setting up for a big night. See what's on."},
            {"title": "Warm up the playlist", "body": "After Dark has the soundtrack for tonight ready. Check the app."},
        ],
        "prime": [
            {"title": "The bass is about to drop", "body": "After Dark's DJ has a fire set planned. Check the app."},
            {"title": "R&B all night", "body": "After Dark is in its element tonight. Check the app for the vibe."},
            {"title": "The sound is right", "body": "After Dark has the perfect playlist going. See what's happening."},
            {"title": "Afrobeats and chill", "body": "The energy at After Dark is building. Open the app."},
            {"title": "Hip-hop heads unite", "body": "After Dark is curating something special tonight. Check the app."},
            {"title": "The vibe is immaculate", "body": "After Dark is hitting different tonight. Open the app."},
            {"title": "Smooth R&B sessions", "body": "After Dark has the perfect mix going. Check the app."},
        ],
        "late_night": [
            {"title": "The dancefloor is packed", "body": "After Dark is in full effect. Fast-track entry in the app."},
            {"title": "It's getting wild", "body": "After Dark is going off. Open the app to jump the queue."},
            {"title": "After Dark. After hours.", "body": "The night's just getting started here. Check the app."},
            {"title": "The vibe is peaking", "body": "After Dark is at its best right now. Get in via the app."},
            {"title": "Last sets of the night", "body": "After Dark's DJ is saving the best for now. Check the app."},
        ],
        "weekend": [
            {"title": "Friday night. After Dark.", "body": "You know where to be. Check the app for tonight's details."},
            {"title": "The weekend starts here", "body": "After Dark is the move. See what's on in the app."},
            {"title": "Best night of the week", "body": "After Dark on a weekend is unmatched. Check the app."},
        ],
    },

    # ── SU CASA BRISBANE — Wed-Sun — Rooftop Bar ─────────────────────────────
    "su_casa_brisbane": {
        "pre_open": [
            {"title": "Rooftop weather is perfect right now", "body": "Su Casa has a vibe tonight. Tap to see what's on and skip the line."},
            {"title": "Golden hour is approaching", "body": "Su Casa has the best sunset spot. Plan your evening in the app."},
            {"title": "Sundowner plans?", "body": "Su Casa's rooftop is calling. See what's on tonight in the app."},
            {"title": "Cocktails at sunset", "body": "Su Casa is about to light up. Check the app for tonight's specials."},
            {"title": "The sky is putting on a show", "body": "Su Casa's rooftop has the best view. Open the app."},
        ],
        "prime": [
            {"title": "Sunset sessions in full swing", "body": "Su Casa's rooftop is the place to be tonight. Check the app."},
            {"title": "The cocktails are flowing", "body": "Su Casa has a great night lined up. Open the app for details."},
            {"title": "Rooftop life", "body": "Perfect evening for Su Casa. See tonight's vibe in the app."},
            {"title": "Sky-high vibes", "body": "Su Casa is on another level tonight. Check the app."},
            {"title": "The view is worth it", "body": "Su Casa's rooftop never disappoints. Open the app to see what's on."},
            {"title": "Above the city", "body": "Su Casa has the best perspective in Brisbane. Check the app."},
        ],
        "late_night": [
            {"title": "The rooftop is alive", "body": "Su Casa is in full party mode. Skip the wait with the app."},
            {"title": "Views and vibes", "body": "Su Casa's rooftop is electric right now. Check the app to get in."},
            {"title": "Late night on the roof", "body": "Su Casa is still going strong. Open the app."},
            {"title": "City lights and good times", "body": "Su Casa after dark is something else. Check the app."},
        ],
        "weekend": [
            {"title": "Weekend on the rooftop", "body": "Su Casa is the spot this weekend. See what's happening in the app."},
            {"title": "Rooftop Saturday", "body": "Su Casa has a packed weekend ahead. Check it out."},
            {"title": "Sunday sessions", "body": "Su Casa does Sundays right. See what's on in the app."},
        ],
    },

    # ── NIGHT MARKET — Thu-Sun 9PM-3AM — Asian Street Food + Bar ─────────────
    "night_market": {
        "pre_open": [
            {"title": "The woks are firing up", "body": "Night Market is getting ready for a great night. Open the app for specials."},
            {"title": "Asian street food calling", "body": "Night Market has something new. Open the app to see what's cooking."},
            {"title": "Neon lights. Great bites.", "body": "Night Market is about to open. Check the app for tonight's dishes."},
            {"title": "The laneway awaits", "body": "Night Market is setting the mood. Check the app for tonight's menu."},
        ],
        "prime": [
            {"title": "The woks are firing tonight", "body": "Night Market has new dishes and late-night energy. Open the app for tonight's specials."},
            {"title": "Street food. Neon lights.", "body": "Night Market is in full swing. See the menu in the app."},
            {"title": "Hungry? We thought so.", "body": "Night Market has something for every craving tonight. Check the app."},
            {"title": "The laneway is buzzing", "body": "Night Market's energy is building. Open the app for tonight's specials."},
            {"title": "Dumplings and cocktails", "body": "Night Market has the perfect combo tonight. See the menu."},
            {"title": "Bao buns are calling", "body": "Night Market has fresh bao on tonight's menu. Check the app."},
        ],
        "late_night": [
            {"title": "Late night cravings sorted", "body": "Night Market is still serving. Open the app for the late menu."},
            {"title": "The kitchen's still open", "body": "Night Market has late-night bites ready. Check the app."},
            {"title": "Midnight munchies?", "body": "Night Market is serving until late. See what's left on the menu."},
            {"title": "2AM noodles", "body": "Night Market has exactly what you need right now. Check the app."},
        ],
        "weekend": [
            {"title": "Weekend feast mode", "body": "Night Market is packed with flavour this weekend. See the specials."},
            {"title": "Saturday night bites", "body": "Night Market has the best late-night food. Check it out."},
        ],
    },

    # ── EMBER & ASH — Wed-Sat 6PM-11PM — Premium Dining ──────────────────────
    "ember_ash": {
        "pre_open": [
            {"title": "Tonight's menu is looking fire", "body": "Ember & Ash has something special planned. Reserve in the app."},
            {"title": "Premium dining tonight", "body": "Ember & Ash has the perfect evening waiting. Check the app."},
            {"title": "The flames are being lit", "body": "Ember & Ash is prepping for a great night. Open the app."},
            {"title": "Reserve your table", "body": "Ember & Ash fills up on nights like this. Book ahead in the app."},
        ],
        "prime": [
            {"title": "Fire-grilled perfection awaits", "body": "Ember & Ash has premium cuts and cocktails ready. Check your app for tonight's menu."},
            {"title": "The flames are lit", "body": "Ember & Ash is serving up something special tonight. See the menu."},
            {"title": "Date night sorted", "body": "Ember & Ash has the perfect setting tonight. Check the app."},
            {"title": "Steak night done right", "body": "Ember & Ash has premium cuts on the grill. Open the app for the menu."},
            {"title": "Charcoal and cocktails", "body": "Ember & Ash is in its element tonight. Check the app."},
            {"title": "The wagyu is calling", "body": "Ember & Ash has premium selections tonight. See the menu."},
        ],
        "late_night": [
            {"title": "Last seating available", "body": "Ember & Ash has a few tables left. Book in the app."},
            {"title": "Dessert and nightcaps", "body": "Ember & Ash is winding down beautifully. Check the app."},
        ],
        "weekend": [
            {"title": "Weekend indulgence", "body": "Ember & Ash has the best cuts this weekend. Book in the app."},
            {"title": "Saturday night dining", "body": "Ember & Ash has a special weekend menu. Check it out."},
            {"title": "Treat yourself", "body": "Ember & Ash is the perfect weekend reward. Reserve in the app."},
        ],
    },

    # ── SU CASA GOLD COAST — Wed-Sun 6PM-12AM — Coastal Bar ──────────────────
    "su_casa_gold_coast": {
        "pre_open": [
            {"title": "Coast vibes are calling", "body": "Something good is happening tonight. Open the app and see what's on."},
            {"title": "Tonight on the coast", "body": "Su Casa GC has something planned. Check the app to get ahead."},
            {"title": "Beachside plans?", "body": "Su Casa Gold Coast is setting up for a great night. See the app."},
        ],
        "prime": [
            {"title": "The Gold Coast is heating up", "body": "Su Casa GC has a great night ahead. Check the app."},
            {"title": "Beachside energy tonight", "body": "Su Casa Gold Coast has the vibe. See what's on in the app."},
            {"title": "Coastal cocktails flowing", "body": "Su Casa GC has the drinks and atmosphere sorted. Check the app."},
            {"title": "The coast is alive", "body": "Su Casa Gold Coast is in full swing. Open the app."},
            {"title": "Salt air and good times", "body": "Su Casa GC is the spot tonight. Check the app."},
        ],
        "late_night": [
            {"title": "The coast doesn't sleep", "body": "Su Casa GC is going strong. Open the app to skip the line."},
            {"title": "Last drinks on the coast", "body": "Su Casa GC is wrapping up a great night. Check the app."},
        ],
        "weekend": [
            {"title": "Gold Coast weekends hit different", "body": "Su Casa GC is the place to be. See what's happening."},
            {"title": "Weekend on the coast", "body": "Su Casa Gold Coast has the best vibes this weekend."},
            {"title": "Coast life", "body": "Su Casa GC is ready for a big weekend. Check it out."},
        ],
    },

    # ── JUJU — Wed-Sun 12PM-12AM — Mermaid Beach Restaurant ──────────────────
    "juju": {
        "pre_open": [
            {"title": "Lunch at Juju?", "body": "Fresh menu, great atmosphere. Open the app to see today's specials."},
            {"title": "Mermaid Beach is calling", "body": "Juju has something good on today. Check the app."},
            {"title": "Table for two?", "body": "Juju has the perfect lunch spot. Check today's menu in the app."},
        ],
        "prime": [
            {"title": "Good food, good night", "body": "Juju has your favourite dishes and a great atmosphere tonight. Check it out."},
            {"title": "Fresh flavours tonight", "body": "Juju's kitchen is firing on all cylinders. See the menu in the app."},
            {"title": "The perfect spot", "body": "Juju has the food and the vibe sorted. Open the app."},
            {"title": "Mermaid Beach vibes", "body": "Juju is the place to be tonight. Check the app for specials."},
            {"title": "Feed the craving", "body": "Juju has exactly what you're looking for. See the menu."},
            {"title": "Chef's specials are on", "body": "Juju has something new tonight. Check the app."},
        ],
        "late_night": [
            {"title": "Late night at Juju", "body": "Still serving, still vibing. Check the app for what's left on the menu."},
            {"title": "Last orders at Juju", "body": "Kitchen closing soon. Open the app for the late menu."},
        ],
        "weekend": [
            {"title": "Weekend at Juju", "body": "Great food, great vibes, great weekend. Check it out in the app."},
            {"title": "Sunday sessions at Juju", "body": "Juju does weekends right. See today's specials."},
            {"title": "Brunch to dinner", "body": "Juju has you covered all day. Check the menu in the app."},
        ],
    },

    # ── THE BAVARIAN — Fri/Sat 9PM-3AM — German Beer Hall ────────────────────
    "bavarian": {
        "pre_open": [
            {"title": "Pretzels and steins on tap", "body": "The Bavarian is getting ready for a great night. Check the app."},
            {"title": "Prost!", "body": "The Bavarian is about to open. Check the app for specials."},
            {"title": "The hall is being prepared", "body": "The Bavarian has a big night ahead. See what's on."},
        ],
        "prime": [
            {"title": "Schnitzel weather", "body": "The Bavarian has comfort food and cold beers ready. See the menu."},
            {"title": "Steins are flowing", "body": "The Bavarian is in full swing tonight. Check the app."},
            {"title": "The hall is filling up", "body": "The Bavarian has a great atmosphere tonight. Open the app."},
            {"title": "Beer, food, good times", "body": "The Bavarian has it all tonight. Check the app for details."},
            {"title": "Oktoberfest energy", "body": "The Bavarian is bringing the good times. Check the app."},
        ],
        "late_night": [
            {"title": "Still pouring", "body": "The Bavarian is keeping the steins flowing. Check the app."},
            {"title": "Late night schnitzel run", "body": "The Bavarian is still serving. Open the app."},
            {"title": "One more round", "body": "The Bavarian isn't done yet. Check the app."},
        ],
        "weekend": [
            {"title": "Weekend at The Bavarian", "body": "Big steins, big vibes, big weekend. Check it out."},
            {"title": "Saturday night steins", "body": "The Bavarian on a weekend is unbeatable. See what's on."},
        ],
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
# CLUSTER MESSAGE LIBRARY
# ═══════════════════════════════════════════════════════════════════════════════

CLUSTER_MESSAGES = {
    "brisbane_cbd": {
        "pre_open": [
            {"title": "Tonight's shaping up", "body": "Big things happening across the city tonight. Plan ahead in the app."},
            {"title": "Lock in your plans", "body": "Multiple venues have great nights ahead. Check the app."},
            {"title": "The night starts now", "body": "Plan your evening — the best venues are about to open. Check the app."},
        ],
        "prime": [
            {"title": "Big night ahead", "body": "There's a lot happening tonight. Open the app to see what's on."},
            {"title": "The city's alive tonight", "body": "Multiple spots are going off. Check the app to pick your vibe."},
            {"title": "Where to tonight?", "body": "So many options, one app. See what's happening right now."},
            {"title": "Your night, your choice", "body": "Several great nights happening at once. Open the app to explore."},
            {"title": "Pick your adventure", "body": "Brisbane's best venues are all within reach. Check the app."},
        ],
        "late_night": [
            {"title": "The city isn't sleeping", "body": "The best nights are still going. Check the app to find your spot."},
            {"title": "Still early by our standards", "body": "Multiple venues going strong. Open the app to jump in."},
            {"title": "Second wind?", "body": "The best spots are still going. See what's happening in the app."},
        ],
        "weekend": [
            {"title": "Weekend in the city", "body": "The best spots are ready for you. See what's on in the app."},
            {"title": "This is going to be good", "body": "Brisbane's best venues are all firing this weekend. Check the app."},
            {"title": "Brisbane after dark", "body": "The city comes alive on weekends. See what's on tonight."},
        ],
    },
    "gold_coast_surfers": {
        "pre_open": [
            {"title": "Tonight on the coast", "body": "Great nights ahead in Surfers. Plan ahead in the app."},
        ],
        "prime": [
            {"title": "The coast is buzzing tonight", "body": "Check your app — there's something for everyone tonight."},
            {"title": "Surfers is going off", "body": "Multiple venues are heating up. Open the app to see what's on."},
            {"title": "Gold Coast nights", "body": "The best spots on the coast are ready. Check the app."},
        ],
        "late_night": [
            {"title": "The coast doesn't quit", "body": "Still going strong in Surfers. Check the app for the best spot."},
            {"title": "Surfers after midnight", "body": "The party's still going. Open the app to find your spot."},
        ],
        "weekend": [
            {"title": "Gold Coast weekend sorted", "body": "The best spots are all within reach. See what's on."},
            {"title": "This is what weekends are for", "body": "The coast has something for everyone. Check the app."},
        ],
    },
}


# ─── SELECTION FUNCTIONS ──────────────────────────────────────────────────────

def pick_notification(venue_id: str) -> dict:
    """Pick a contextual notification. Returns None if venue is closed."""
    if not _is_venue_open(venue_id):
        return None
    time_slot = _get_venue_time_slot(venue_id)
    weekend = _is_weekend()
    venue_msgs = VENUE_MESSAGES.get(venue_id, {})
    if not venue_msgs:
        return {"title": "Something good is happening", "body": "Open the app to see what's on tonight."}
    candidates = list(venue_msgs.get(time_slot, []))
    if weekend:
        candidates.extend(venue_msgs.get("weekend", []))
    if not candidates:
        candidates = list(venue_msgs.get("prime", [{"title": "Something good is happening", "body": "Open the app to see what's on."}]))
    return random.choice(candidates)


def pick_cluster_notification(cluster: str) -> dict:
    """Pick a contextual cluster notification based on time of day"""
    now = _now_aest()
    hour = now.hour
    weekend = _is_weekend()
    if hour < 5 or hour >= 21:
        slot = "late_night"
    elif hour >= 17:
        slot = "prime"
    else:
        slot = "pre_open"
    cluster_msgs = CLUSTER_MESSAGES.get(cluster, {})
    if not cluster_msgs:
        return {"title": "Big night ahead", "body": "There's a lot happening tonight. Open the app to see what's on."}
    candidates = list(cluster_msgs.get(slot, []))
    if weekend:
        candidates.extend(cluster_msgs.get("weekend", []))
    if not candidates:
        candidates = list(cluster_msgs.get("prime", [{"title": "Big night ahead", "body": "There's a lot happening tonight. Open the app to see what's on."}]))
    return random.choice(candidates)



async def has_triggered_cluster_today(user_id: str, cluster: str) -> bool:
    """Check if user has already received a notification for this cluster today"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    trigger = await db.geofence_triggers.find_one({
        "user_id": user_id,
        "cluster": cluster,
        "triggered_at": {"$gte": today_start}
    })
    return trigger is not None


@router.post("/check-location")
async def check_location(
    location: LocationUpdate,
    authorization: str = Header(None)
):
    """
    Check if user is within any geofence zones.
    If multiple venues in the same cluster are nearby, send ONE generic notification.
    Otherwise send the venue-specific message.
    """
    user = get_current_user(authorization)
    user_id = user.get("user_id")
    
    user_record = await db.users.find_one({"user_id": user_id})
    if not user_record:
        raise HTTPException(status_code=404, detail="User not found")
    
    prefs = user_record.get("notification_preferences", {})
    if prefs.get("location_alerts", True) is False:
        return {"triggered": [], "message": "Location notifications disabled"}
    
    geofences = await db.geofences.find({"is_active": True}).to_list(100)
    
    # Find all geofences the user is within
    nearby = []
    for gf in geofences:
        distance = haversine_distance(
            location.latitude, location.longitude,
            gf.get("latitude"), gf.get("longitude")
        )
        if distance <= gf.get("radius", 1000):
            nearby.append({**gf, "_distance": distance})
    
    if not nearby:
        return {"triggered": [], "notifications_sent": 0, "message": "Not in any geofence zones"}
    
    # Group by cluster
    clusters = {}
    for gf in nearby:
        cluster = gf.get("cluster", gf.get("id"))
        if cluster not in clusters:
            clusters[cluster] = []
        clusters[cluster].append(gf)
    
    triggered_zones = []
    notifications_sent = 0
    push_token = user_record.get("push_token")
    
    for cluster, venues in clusters.items():
        # Skip if already notified for this cluster today
        if await has_triggered_cluster_today(user_id, cluster):
            continue
        
        if len(venues) > 1:
            # Multiple venues in cluster — send ONE contextual cluster notification
            msg = pick_cluster_notification(cluster)
            title = msg["title"]
            body = msg["body"]
            data = {"type": "geofence", "action": "open_home", "cluster": cluster}
        else:
            # Single venue — send contextual venue-specific notification
            venue = venues[0]
            msg = pick_notification(venue.get("venue_id", ""))
            title = msg["title"]
            body = msg["body"]
            data = {"type": "geofence", "venue_id": venue.get("venue_id"), "action": "open_venue"}
        
        # Record the trigger (per cluster, not per venue)
        await db.geofence_triggers.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "cluster": cluster,
            "geofence_ids": [v.get("id") for v in venues],
            "venue_ids": [v.get("venue_id") for v in venues],
            "distance": round(min(v["_distance"] for v in venues), 2),
            "user_latitude": location.latitude,
            "user_longitude": location.longitude,
            "notification_title": title,
            "notification_body": body,
            "triggered_at": datetime.now(timezone.utc)
        })
        
        triggered_zones.extend([{"id": v.get("id"), "name": v.get("name"), "distance": round(v["_distance"], 2)} for v in venues])
        
        # Send ONE push per cluster
        if push_token:
            try:
                await send_push_notification(push_token, title, body, data)
                notifications_sent += 1
                logger.info(f"Geofence push: cluster={cluster}, venues={len(venues)}, user={user_id}")
            except Exception as e:
                logger.error(f"Geofence push failed: {e}")
    
    return {
        "triggered": triggered_zones,
        "notifications_sent": notifications_sent,
        "message": f"Entered {len(triggered_zones)} zone(s), {notifications_sent} notification(s) sent"
    }


@router.get("/my-triggers")
async def get_my_triggers(
    limit: int = 20,
    authorization: str = Header(None)
):
    """Get user's recent geofence trigger history"""
    user = get_current_user(authorization)
    
    triggers = await db.geofence_triggers.find(
        {"user_id": user.get("user_id")},
        {"_id": 0}
    ).sort("triggered_at", -1).limit(limit).to_list(limit)
    
    return {"triggers": triggers}


# ============ Admin Endpoints ============

@router.get("/admin/all")
async def get_all_geofences(authorization: str = Header(None)):
    """Get all geofences (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    geofences = await db.geofences.find({}, {"_id": 0}).to_list(100)
    return {"geofences": geofences, "total": len(geofences)}


@router.post("/admin/create")
async def create_geofence(
    geofence: GeofenceCreate,
    authorization: str = Header(None)
):
    """Create a new geofence zone (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    geofence_id = str(uuid.uuid4())[:8].upper()
    
    geofence_doc = {
        "id": f"GEO_{geofence_id}",
        "name": geofence.name,
        "latitude": geofence.latitude,
        "longitude": geofence.longitude,
        "radius": geofence.radius,
        "notification_title": geofence.notification_title,
        "notification_body": geofence.notification_body,
        "venue_id": geofence.venue_id,
        "is_active": geofence.is_active,
        "created_by": user.get("user_id"),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.geofences.insert_one(geofence_doc)
    
    # Remove _id for response
    geofence_doc.pop("_id", None)
    
    return {
        "success": True,
        "message": f"Geofence '{geofence.name}' created successfully",
        "geofence": clean_mongo_doc(geofence_doc)
    }


@router.put("/admin/{geofence_id}")
async def update_geofence(
    geofence_id: str,
    updates: GeofenceUpdate,
    authorization: str = Header(None)
):
    """Update a geofence zone (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.geofences.find_one({"id": geofence_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.geofences.update_one(
        {"id": geofence_id},
        {"$set": update_data}
    )
    
    updated = await db.geofences.find_one({"id": geofence_id}, {"_id": 0})
    
    return {
        "success": True,
        "message": "Geofence updated successfully",
        "geofence": clean_mongo_doc(updated)
    }


@router.delete("/admin/{geofence_id}")
async def delete_geofence(
    geofence_id: str,
    authorization: str = Header(None)
):
    """Delete a geofence zone (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    existing = await db.geofences.find_one({"id": geofence_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Geofence not found")
    
    await db.geofences.delete_one({"id": geofence_id})
    
    # Also delete associated triggers
    await db.geofence_triggers.delete_many({"geofence_id": geofence_id})
    
    return {
        "success": True,
        "message": f"Geofence '{existing.get('name')}' deleted successfully"
    }


@router.get("/admin/analytics")
async def get_geofence_analytics(
    period: str = "week",
    authorization: str = Header(None)
):
    """Get geofence trigger analytics (admin only)"""
    user = get_current_user(authorization)
    
    # Get user role from database
    user_record = await db.users.find_one({"user_id": user.get("user_id")})
    if not user_record or user_record.get("role") not in ["admin", "venue_manager"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "day":
        start_date = now - timedelta(days=1)
    elif period == "week":
        start_date = now - timedelta(weeks=1)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:
        start_date = now - timedelta(weeks=1)
    
    # Get trigger counts by geofence
    pipeline = [
        {"$match": {"triggered_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$geofence_id",
            "geofence_name": {"$first": "$geofence_name"},
            "count": {"$sum": 1},
            "unique_users": {"$addToSet": "$user_id"}
        }},
        {"$project": {
            "geofence_id": "$_id",
            "geofence_name": 1,
            "trigger_count": "$count",
            "unique_users": {"$size": "$unique_users"},
            "_id": 0
        }},
        {"$sort": {"trigger_count": -1}}
    ]
    
    stats = await db.geofence_triggers.aggregate(pipeline).to_list(100)
    
    # Total triggers
    total_triggers = await db.geofence_triggers.count_documents({"triggered_at": {"$gte": start_date}})
    
    # Total unique users
    unique_users_list = await db.geofence_triggers.distinct("user_id", {"triggered_at": {"$gte": start_date}})
    unique_users = len(unique_users_list)
    
    return {
        "period": period,
        "total_triggers": total_triggers,
        "unique_users": unique_users,
        "by_geofence": stats
    }


# ============ Seed Default Geofences ============

async def seed_default_geofences():
    """Create default geofences for Luna Group venues with 1km radius"""
    # Always reseed to update messages and radius
    await db.geofences.delete_many({})
    
    default_geofences = [
        {
            "id": "GEO_ECLIPSE",
            "name": "Eclipse Brisbane",
            "latitude": -27.4572,
            "longitude": 153.0347,
            "radius": 1000,
            "notification_title": "Your table is waiting",
            "notification_body": "Eclipse has something special on tonight. Open the app to see what's happening.",
            "venue_id": "eclipse",
            "cluster": "brisbane_cbd",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_AFTERDARK",
            "name": "After Dark Brisbane",
            "latitude": -27.4580,
            "longitude": 153.0345,
            "radius": 1000,
            "notification_title": "Tonight's lineup just dropped",
            "notification_body": "After Dark has a stacked night ahead. Check your app for the details.",
            "venue_id": "after_dark",
            "cluster": "brisbane_cbd",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_SUCASA_BNE",
            "name": "Su Casa Brisbane",
            "latitude": -27.4572,
            "longitude": 153.0347,
            "radius": 1000,
            "notification_title": "Rooftop weather is perfect right now",
            "notification_body": "Su Casa has a vibe tonight. Tap to see what's on and skip the line.",
            "venue_id": "su_casa_brisbane",
            "cluster": "brisbane_cbd",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_NIGHTMARKET",
            "name": "Night Market Brisbane",
            "latitude": -27.4575,
            "longitude": 153.0350,
            "radius": 1000,
            "notification_title": "The woks are firing tonight",
            "notification_body": "Night Market has new dishes and late-night energy. Open the app for tonight's specials.",
            "venue_id": "night_market",
            "cluster": "brisbane_cbd",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_EMBERASH",
            "name": "Ember & Ash",
            "latitude": -27.4698,
            "longitude": 153.0251,
            "radius": 1000,
            "notification_title": "Fire-grilled perfection awaits",
            "notification_body": "Ember & Ash has premium cuts and cocktails ready. Check your app for tonight's menu.",
            "venue_id": "ember_ash",
            "cluster": "brisbane_south",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_SUCASA_GC",
            "name": "Su Casa Gold Coast",
            "latitude": -28.0033,
            "longitude": 153.4300,
            "radius": 1000,
            "notification_title": "Coast vibes are calling",
            "notification_body": "Something good is happening tonight. Open the app and see what's on.",
            "venue_id": "su_casa_gold_coast",
            "cluster": "gold_coast_surfers",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_JUJU",
            "name": "Juju Mermaid Beach",
            "latitude": -28.0450,
            "longitude": 153.4380,
            "radius": 1000,
            "notification_title": "Good food, good night",
            "notification_body": "Juju has your favourite dishes and a great atmosphere tonight. Check it out.",
            "venue_id": "juju",
            "cluster": "gold_coast_mermaid",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "id": "GEO_BAVARIAN",
            "name": "The Bavarian Gold Coast",
            "latitude": -28.0028,
            "longitude": 153.4298,
            "radius": 1000,
            "notification_title": "Pretzels and steins on tap",
            "notification_body": "The Bavarian has a great night ahead. Open the app to see what's happening.",
            "venue_id": "bavarian",
            "cluster": "gold_coast_surfers",
            "is_active": True,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
    ]
    
    await db.geofences.insert_many(default_geofences)
    logger.info(f"Seeded {len(default_geofences)} geofences (1km radius, clustered)")
    return {"message": f"Seeded {len(default_geofences)} geofences", "count": len(default_geofences)}


@router.post("/seed")
async def seed_geofences():
    """Seed default geofences for Luna Group venues"""
    return await seed_default_geofences()
