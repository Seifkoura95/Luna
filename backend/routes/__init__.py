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
from routes.bookings import router as bookings_router
from routes.subscriptions import router as subscriptions_router
from routes.points import router as points_router
from routes.tickets import router as tickets_router
from routes.friends import router as friends_router
from routes.notifications import router as notifications_router
from routes.venue_admin import router as venue_admin_router
from routes.geofences import router as geofences_router
from routes.birthday import router as birthday_router
from routes.leaderboard import router as leaderboard_router
from routes.ai import router as ai_router
from routes.payments import router as payments_router
from routes.webhook import router as webhook_router
from routes.stories import router as stories_router
from routes.websocket import router as websocket_router
from routes.churn import router as churn_router

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
    "bookings_router",
    "subscriptions_router",
    "points_router",
    "tickets_router",
    "friends_router",
    "notifications_router",
    "venue_admin_router",
    "geofences_router",
    "birthday_router",
    "leaderboard_router",
    "ai_router",
    "payments_router",
    "webhook_router",
    "stories_router",
    "websocket_router",
    "churn_router",
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
    bookings_router,
    subscriptions_router,
    points_router,
    tickets_router,
    friends_router,
    notifications_router,
    venue_admin_router,
    geofences_router,
    birthday_router,
    leaderboard_router,
    ai_router,
    payments_router,
    webhook_router,
    stories_router,
    websocket_router,
    churn_router,
]
