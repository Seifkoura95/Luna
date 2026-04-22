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
from routes.notification_ws import router as notification_ws_router
from routes.scheduled_jobs import router as scheduled_jobs_router
from routes.crews import router as crews_router
from routes.safety import router as safety_router
from routes.location import router as location_router
from routes.promo import router as promo_router
from routes.vouchers import router as vouchers_router
# Instagram integration removed — replaced by Social feed
from routes.admin import router as admin_router
from routes.admin import public_router as public_config_router
from routes.users import router as users_router
from routes.campaigns import router as campaigns_router
from routes.loyalty import router as loyalty_router
from routes.perks import router as perks_router
from routes.milestones import router as milestones_router
from routes.push_broadcasts import router as push_broadcasts_router
from routes.push_broadcasts import engagement_router as engagement_tracking_router
from routes.social import router as social_router
from routes.venue_menus import router as venue_menus_router
from routes.entry_tickets import router as entry_tickets_router
from routes.cherryhub import router as cherryhub_router

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
    "notification_ws_router",
    "scheduled_jobs_router",
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
    notification_ws_router,
    scheduled_jobs_router,
    crews_router,
    safety_router,
    location_router,
    promo_router,
    vouchers_router,
    # instagram_router removed
    admin_router,
    users_router,
    campaigns_router,
    perks_router,
    loyalty_router,
    milestones_router,
    push_broadcasts_router,
    engagement_tracking_router,
    social_router,
    venue_menus_router,
    entry_tickets_router,
    cherryhub_router,
    public_config_router,
]
