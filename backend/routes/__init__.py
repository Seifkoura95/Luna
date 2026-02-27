"""
Routes package for Luna Group VIP API

This package contains all API route modules organized by domain.
Import routers from this package to include them in the main application.
"""

from routes.health import router as health_router
from routes.auth import router as auth_router
from routes.venues import router as venues_router
from routes.rewards import router as rewards_router
from routes.missions import router as missions_router
from routes.referrals import router as referrals_router
from routes.events import router as events_router
from routes.auctions import router as auctions_router
from routes.boosts import router as boosts_router
from routes.photos import router as photos_router
from routes.venue_dashboard import router as venue_dashboard_router

# Export all routers for easy importing
__all__ = [
    "health_router",
    "auth_router", 
    "venues_router",
    "rewards_router",
    "missions_router",
    "referrals_router",
    "events_router",
    "auctions_router",
    "boosts_router",
    "photos_router",
    "venue_dashboard_router",
]

# List of all routers for bulk registration
ALL_ROUTERS = [
    health_router,
    auth_router,
    venues_router,
    rewards_router,
    missions_router,
    referrals_router,
    events_router,
    auctions_router,
    boosts_router,
    photos_router,
    venue_dashboard_router,
]
